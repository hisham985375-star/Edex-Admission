import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createRazorpayOrder } from "@/lib/razorpay/client";
import { fullApplicationSchema } from "@/lib/validations/application";
import { paymentLimiter, getIdentifier } from "@/lib/rate-limit";
import { ok, err, tooManyRequests, serverError } from "@/lib/api-response";
import { PAYMENT_STATUS } from "@/lib/constants";
import { syncToGoogleSheets } from "@/lib/google/sheets";

/**
 * POST /api/payment/create-order
 *
 * Flow:
 * 1. Validate that email has been OTP-verified
 * 2. Server-side validate all application data
 * 3. Generate a program-specific Application ID using a PostgreSQL sequence
 * 4. Insert the application record (payment_pending)
 * 5. Create a Razorpay order (amount always enforced server-side at ₹1,000)
 * 6. Store the order in payment_transactions
 * 7. Return order details to client for Razorpay Checkout
 *
 * The fee is NEVER sourced from the client request body.
 */
export async function POST(req: NextRequest) {
  const ip = getIdentifier(req, "payment-order");
  const { allowed } = paymentLimiter(ip);
  if (!allowed) return tooManyRequests();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err("Invalid request body");
  }

  // Full server-side validation — never trust the client
  const parsed = fullApplicationSchema.safeParse(body);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Validation failed");
  }

  const data = parsed.data;
  const emailLower = data.email.toLowerCase();

  const supabase = createServiceClient();

  try {
    // 1. Verify email OTP was completed
    const { data: verification } = await supabase
      .from("email_verifications")
      .select("verified_at")
      .eq("email", emailLower)
      .single();

    if (!verification?.verified_at) {
      return err("Email verification required before payment.", 400, "EMAIL_NOT_VERIFIED");
    }

    // Check verification is recent (within 30 minutes to prevent stale verifications)
    const verifiedAt = new Date(verification.verified_at);
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60_000);
    if (verifiedAt < thirtyMinutesAgo) {
      return err("Email verification expired. Please verify again.", 400, "VERIFICATION_EXPIRED");
    }

    // 2. Generate Application ID using PostgreSQL sequence (transaction-safe)
    const sequenceName =
      data.program === "EGX 100" ? "egx_application_id_seq" : "next_application_id_seq";

    const { data: seqResult, error: seqError } = await supabase.rpc("nextval", {
      sequence_name: sequenceName,
    });

    // Fallback: use timestamp-based ID if sequence not available
    let applicationId: string;
    if (seqError || !seqResult) {
      const timestamp = Date.now().toString().slice(-5);
      const prefix = data.program === "EGX 100" ? "EGX" : "NEXT";
      applicationId = `${prefix}-${timestamp.padStart(5, "0")}`;
    } else {
      const prefix = data.program === "EGX 100" ? "EGX" : "NEXT";
      applicationId = `${prefix}-${String(seqResult).padStart(5, "0")}`;
    }

    // 3. Check if this application already exists (idempotency)
    const { data: existingApp } = await supabase
      .from("applications")
      .select("id, payment_status")
      .eq("id", applicationId)
      .single();

    if (existingApp && existingApp.payment_status === PAYMENT_STATUS.PAID) {
      return err("This application has already been paid.", 409, "ALREADY_PAID");
    }

    // 4. Insert application record
    if (!existingApp) {
      const { error: insertError } = await supabase.from("applications").insert({
        id: applicationId,
        program: data.program,
        first_name: data.firstName,
        last_name: data.lastName,
        dob: data.dob,
        gender: data.gender,
        guardian_name: data.guardianName,
        guardian_contact: data.guardianContact,
        mobile: data.mobile,
        second_mobile: data.secondMobile || null,
        email: emailLower,
        house_name: data.houseName,
        area: data.area,
        post_office: data.postOffice,
        district: data.district,
        state: data.state,
        pincode: data.pincode,
        highest_qualification: data.highestQualification,
        custom_qualification: data.customQualification || null,
        payment_status: PAYMENT_STATUS.PENDING,
        admission_status: "New",
      });

      if (insertError) {
        console.error("[Payment] Application insert error:", insertError.message);
        return serverError("Failed to create application. Please try again.");
      }

      // Sync to Google Sheets (fire-and-forget)
      syncToGoogleSheets({
        type: "application",
        applicationId,
        program: data.program,
        firstName: data.firstName,
        lastName: data.lastName,
        mobile: data.mobile,
        email: emailLower,
        district: data.district,
        state: data.state,
        highestQualification: data.highestQualification,
        paymentStatus: PAYMENT_STATUS.PENDING,
        paidAt: "",
        razorpayPaymentId: "",
      }).catch((e) => console.error("[Payment] Sheets sync error:", e));
    }

    // 5. Create Razorpay order — amount is ALWAYS ₹1,000 server-side
    const order = await createRazorpayOrder(applicationId);

    // 6. Store payment transaction
    const { error: txError } = await supabase.from("payment_transactions").insert({
      application_id: applicationId,
      razorpay_order_id: order.id,
      amount: 1000, // ₹1,000 INR
      currency: "INR",
      status: "created",
    });

    if (txError) {
      console.error("[Payment] Transaction insert error:", txError.message);
      // Non-fatal — application and order are created; we can reconcile later
    }

    return ok({
      orderId: order.id,
      applicationId,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (e: any) {
    console.error("[Payment] Unexpected error:", e);
    return serverError(e.message || "An unexpected error occurred");
  }
}
