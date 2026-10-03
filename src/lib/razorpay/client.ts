import Razorpay from "razorpay";
import crypto from "crypto";
import { APPLICATION_FEE_PAISE } from "@/lib/constants";

let _razorpay: Razorpay | null = null;

function getRazorpay(): Razorpay {
  if (!_razorpay) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) throw new Error("Razorpay credentials not configured");
    _razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return _razorpay;
}

/**
 * Create a Razorpay order for ₹1,000 application fee.
 * Amount is ALWAYS enforced server-side — never trust client.
 */
export async function createRazorpayOrder(receipt: string) {
  const razorpay = getRazorpay();
  const order = await razorpay.orders.create({
    amount: APPLICATION_FEE_PAISE, // Always ₹1,000 — hardcoded server-side
    currency: "INR",
    receipt,
    notes: { purpose: "EDEX Life School Application Fee" },
  });
  return order;
}

/**
 * Verify Razorpay payment signature after checkout.
 * This MUST be called server-side before marking an application as paid.
 */
export function verifyPaymentSignature({
  orderId,
  paymentId,
  signature,
}: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) throw new Error("Razorpay secret not configured");

  const body = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(body)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Verify a Razorpay webhook signature.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string
): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error("Razorpay webhook secret not configured");

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

/**
 * Fetch a payment from Razorpay to verify amount server-side.
 */
export async function fetchPayment(paymentId: string) {
  const razorpay = getRazorpay();
  return razorpay.payments.fetch(paymentId);
}
