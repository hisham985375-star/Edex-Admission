import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  verifyPaymentSignature,
  fetchPayment,
} from "@/lib/razorpay/client";
import { generateSecureToken, hashToken } from "@/lib/crypto";
import { ok, err, serverError } from "@/lib/api-response";
import {
  APPLICATION_FEE_PAISE,
  PAYMENT_STATUS,
  CONFIRMATION_TOKEN_EXPIRY_DAYS,
} from "@/lib/constants";
import { runPostPaymentTasks } from "@/lib/post-payment";
import { z } from "zod";

const schema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
  applicationId: z.string().min(1),
});

/**
 * POST /api/payment/verify
 *
 * Called by the client immediately after Razorpay Checkout succeeds.
 * Security: signature is verified server-side. Payment amount is verified
 * by fetching from Razorpay directly — the client cannot tamper with it.
 *
 * Idempotent: if the application is already marked PAID, return success.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err("Invalid request body");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Validation failed");

  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, applicationId } = parsed.data;
  const supabase = createServiceClient();

  try {
    // 1. Idempotency check — application already paid?
    const { data: app } = await supabase
      .from("applications")
      .select("id, payment_status, email, first_name, last_name, program")
      .eq("id", applicationId)
      .single();

    if (!app) return err("Application not found", 404);

    if (app.payment_status === PAYMENT_STATUS.PAID) {
      // Already paid — return confirmation token (idempotent)
      const { data: token } = await supabase
        .from("confirmation_tokens")
        .select("token_hash")
        .eq("application_id", applicationId)
        .single();

      return ok({ success: true, applicationId, alreadyPaid: true });
    }

    // 2. Verify Razorpay signature (constant-time)
    const signatureValid = verifyPaymentSignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });

    if (!signatureValid) {
      console.error("[Payment Verify] Invalid signature for application:", applicationId);
      return err("Payment verification failed. If you were charged, contact admissions.", 400, "SIGNATURE_INVALID");
    }

    // 3. Fetch actual payment from Razorpay to verify amount
    const payment = await fetchPayment(razorpayPaymentId);

    if (
      payment.status !== "captured" ||
      Number(payment.amount) !== APPLICATION_FEE_PAISE
    ) {
      console.error(
        "[Payment Verify] Amount mismatch or status not captured:",
        payment.status,
        payment.amount
      );
      return err(
        "Payment amount verification failed. Contact admissions.",
        400,
        "AMOUNT_MISMATCH"
      );
    }

    // 4. Mark application as paid (atomic update)
    const { error: updateError } = await supabase
      .from("applications")
      .update({
        payment_status: PAYMENT_STATUS.PAID,
        updated_at: new Date().toISOString(),
      })
      .eq("id", applicationId)
      .eq("payment_status", PAYMENT_STATUS.PENDING); // Optimistic lock

    if (updateError) {
      console.error("[Payment Verify] Application update error:", updateError.message);
      return serverError("Payment recorded but application update failed. Contact admissions.");
    }

    // 5. Update payment transaction record
    await supabase
      .from("payment_transactions")
      .update({
        razorpay_payment_id: razorpayPaymentId,
        status: "captured",
      })
      .eq("razorpay_order_id", razorpayOrderId);

    // 6. Generate confirmation token
    const plainToken = generateSecureToken();
    const tokenHash = hashToken(plainToken);
    const expiresAt = new Date(
      Date.now() + CONFIRMATION_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    await supabase.from("confirmation_tokens").insert({
      token_hash: tokenHash,
      application_id: applicationId,
      expires_at: expiresAt,
    });

    // 7. Trigger async post-payment tasks (receipt, email, Sheets sync)
    // We await this so Vercel doesn't kill the serverless function before the email is sent.
    await runPostPaymentTasks({
      applicationId,
      razorpayPaymentId,
      name: `${app.first_name} ${app.last_name}`,
      email: app.email,
      program: app.program ?? "EGX 100",
      paidAt: new Date().toISOString(),
    }).catch((e) => console.error("[Payment] Post-payment task error:", e));

    return ok({
      success: true,
      applicationId,
      confirmationToken: plainToken, // One-time plaintext token; hash stored in DB
    });
  } catch (e) {
    console.error("[Payment Verify] Unexpected error:", e);
    return serverError();
  }
}
