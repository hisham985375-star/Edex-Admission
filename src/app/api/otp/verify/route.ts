import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { hashOTP, secureCompare } from "@/lib/crypto";
import { otpVerifyLimiter, getIdentifier } from "@/lib/rate-limit";
import { ok, err, tooManyRequests, serverError } from "@/lib/api-response";
import { OTP_MAX_ATTEMPTS } from "@/lib/constants";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  otp: z.string().length(6).regex(/^\d{6}$/, "OTP must be 6 digits"),
});

/**
 * POST /api/otp/verify
 * Verify a 6-digit OTP.
 * Rules enforced here:
 * - OTP must not be expired
 * - Max 5 attempts — then OTP is invalidated; user must request a new one
 * - Constant-time hash comparison to prevent timing attacks
 */
export async function POST(req: NextRequest) {
  const ip = getIdentifier(req, "otp-verify");
  const { allowed } = otpVerifyLimiter(ip);
  if (!allowed) return tooManyRequests();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err("Invalid request body");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Validation failed");

  const { email, otp } = parsed.data;
  const emailLower = email.toLowerCase();
  const supabase = createServiceClient();

  try {
    const { data: record, error: fetchError } = await supabase
      .from("email_verifications")
      .select("*")
      .eq("email", emailLower)
      .single();

    if (fetchError || !record) {
      return err("No pending verification found. Please request a new OTP.", 400, "NO_VERIFICATION");
    }

    // Already verified
    if (record.verified_at) {
      return ok({ success: true, alreadyVerified: true });
    }

    // Check expiry
    if (new Date(record.expires_at) < new Date()) {
      return err("OTP has expired. Please request a new one.", 400, "OTP_EXPIRED");
    }

    // Check attempt limit
    const attempts: number = record.attempts ?? 0;
    if (attempts >= OTP_MAX_ATTEMPTS) {
      return err(
        "Too many incorrect attempts. Please request a new OTP.",
        400,
        "OTP_LOCKED"
      );
    }

    // Constant-time comparison
    const inputHash = hashOTP(otp);
    const isValid = secureCompare(inputHash, record.otp_hash);

    if (!isValid) {
      const newAttempts = attempts + 1;

      if (newAttempts >= OTP_MAX_ATTEMPTS) {
        // Invalidate OTP by zeroing out the hash
        await supabase
          .from("email_verifications")
          .update({ attempts: newAttempts, otp_hash: "INVALIDATED" })
          .eq("email", emailLower);

        return err(
          "Too many incorrect attempts. Please request a new OTP.",
          400,
          "OTP_LOCKED"
        );
      }

      await supabase
        .from("email_verifications")
        .update({ attempts: newAttempts })
        .eq("email", emailLower);

      return err(
        `Incorrect OTP. ${OTP_MAX_ATTEMPTS - newAttempts} attempt(s) remaining.`,
        400,
        "OTP_INCORRECT"
      );
    }

    // ✓ OTP is valid — mark as verified
    await supabase
      .from("email_verifications")
      .update({ verified_at: new Date().toISOString(), otp_hash: "USED" })
      .eq("email", emailLower);

    return ok({ success: true, verified: true });
  } catch (e) {
    console.error("[OTP Verify] Unexpected error:", e);
    return serverError();
  }
}
