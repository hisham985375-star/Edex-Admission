import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyWebhookSignature } from "@/lib/razorpay/client";
import { ok, err, serverError } from "@/lib/api-response";
import { APPLICATION_FEE_PAISE, PAYMENT_STATUS } from "@/lib/constants";

/**
 * POST /api/webhooks/razorpay
 *
 * Handles Razorpay payment webhooks.
 * Security:
 * - Signature verified before any processing
 * - Idempotent via webhook_event_id unique constraint
 * - Retry-safe: same event processed only once
 * - Returns 200 even on already-processed events (so Razorpay stops retrying)
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-razorpay-signature");
  if (!signature) return err("Missing signature", 400);

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return err("Failed to read body");
  }

  // Verify signature before touching any data
  let signatureValid: boolean;
  try {
    signatureValid = verifyWebhookSignature(rawBody, signature);
  } catch (e) {
    console.error("[Webhook] Signature verification error:", e);
    return serverError();
  }

  if (!signatureValid) {
    console.error("[Webhook] Invalid signature");
    return err("Invalid signature", 401);
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return err("Invalid JSON payload");
  }

  const eventId: string = payload.id;
  const eventType: string = payload.event;

  if (!eventId || !eventType) {
    return err("Missing event id or type");
  }

  const supabase = createServiceClient();

  try {
    // ─── Idempotency: check if already processed ─────────────────────────────
    const { data: existingEvent } = await supabase
      .from("payment_webhook_events")
      .select("id, processed")
      .eq("event_id", eventId)
      .single();

    if (existingEvent?.processed) {
      // Already processed — return 200 so Razorpay stops retrying
      return ok({ received: true, status: "already_processed" });
    }

    // Record the event (insert or mark existing as being processed)
    if (!existingEvent) {
      await supabase.from("payment_webhook_events").insert({
        event_id: eventId,
        event_type: eventType,
        payload,
        processed: false,
      });
    }

    // ─── Handle specific events ────────────────────────────────────────────────
    if (eventType === "payment.captured") {
      await handlePaymentCaptured(payload, supabase);
    } else if (eventType === "payment.failed") {
      await handlePaymentFailed(payload, supabase);
    }

    // Mark event as processed
    await supabase
      .from("payment_webhook_events")
      .update({ processed: true })
      .eq("event_id", eventId);

    return ok({ received: true });
  } catch (e) {
    console.error("[Webhook] Processing error:", e);
    // Return 200 to prevent infinite retries; log for manual reconciliation
    return ok({ received: true, status: "error_logged" });
  }
}

async function handlePaymentCaptured(payload: any, supabase: any) {
  const payment = payload.payload?.payment?.entity;
  if (!payment) return;

  const orderId: string = payment.order_id;
  const paymentId: string = payment.id;
  const amount: number = payment.amount; // In paise

  // Amount guard
  if (amount !== APPLICATION_FEE_PAISE) {
    console.error("[Webhook] Amount mismatch:", amount, "expected:", APPLICATION_FEE_PAISE);
    return;
  }

  // Find the application by order_id
  const { data: tx } = await supabase
    .from("payment_transactions")
    .select("application_id")
    .eq("razorpay_order_id", orderId)
    .single();

  if (!tx) {
    console.error("[Webhook] Transaction not found for order:", orderId);
    return;
  }

  const applicationId: string = tx.application_id;

  // Check if already paid (idempotency)
  const { data: app } = await supabase
    .from("applications")
    .select("payment_status")
    .eq("id", applicationId)
    .single();

  if (app?.payment_status === PAYMENT_STATUS.PAID) return;

  // Mark application as paid
  await supabase
    .from("applications")
    .update({ payment_status: PAYMENT_STATUS.PAID, updated_at: new Date().toISOString() })
    .eq("id", applicationId);

  // Update transaction
  await supabase
    .from("payment_transactions")
    .update({ razorpay_payment_id: paymentId, status: "captured" })
    .eq("razorpay_order_id", orderId);

  console.log("[Webhook] Payment captured for:", applicationId);
}

async function handlePaymentFailed(payload: any, supabase: any) {
  const payment = payload.payload?.payment?.entity;
  if (!payment) return;

  const orderId: string = payment.order_id;

  const { data: tx } = await supabase
    .from("payment_transactions")
    .select("application_id")
    .eq("razorpay_order_id", orderId)
    .single();

  if (!tx) return;

  await supabase
    .from("payment_transactions")
    .update({ status: "failed" })
    .eq("razorpay_order_id", orderId);

  // Application remains payment_pending so applicant can retry
  console.log("[Webhook] Payment failed for application:", tx.application_id);
}
