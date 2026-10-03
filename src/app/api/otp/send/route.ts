import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendOTPEmail } from "@/lib/resend/emails";
import { generateOTP, hashOTP } from "@/lib/crypto";
import { otpRequestLimiter, getIdentifier } from "@/lib/rate-limit";
import { ok, err, tooManyRequests, serverError } from "@/lib/api-response";
import {
  OTP_EXPIRY_MINUTES,
  OTP_MAX_RESENDS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_RESEND_LOCKOUT_MINUTES,
} from "@/lib/constants";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  program: z.enum(["EGX 100", "EDEX Next"]),
});

/**
 * POST /api/otp/send
 * Send or resend an OTP to the applicant's email.
 * Rules:
 * - Max 3 resends per session
 * - 30s cooldown between resends
 * - After 3 resends, enforce 10-minute lockout
 * - New OTP always invalidates the previous one
 * - OTP is never stored in plaintext
 */
export async function POST(req: NextRequest) {
  const ip = getIdentifier(req, "otp-send");
  const { allowed } = otpRequestLimiter(ip);
  if (!allowed) return tooManyRequests();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err("Invalid request body");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Validation failed");

  const { email, name, program } = parsed.data;
  const emailLower = email.toLowerCase();
  const supabase = createServiceClient();

  try {
    const now = new Date();
    const { data: existing } = await supabase
      .from("email_verifications")
      .select("*")
      .eq("email", emailLower)
      .maybeSingle();

    if (existing) {
      // Check resend limits
      const resends: number = existing.resends ?? 0;

      // 10-minute lockout after 3 resends
      if (resends >= OTP_MAX_RESENDS) {
        const createdAt = new Date(existing.created_at);
        const lockoutUntil = new Date(createdAt.getTime() + OTP_RESEND_LOCKOUT_MINUTES * 60_000);
        if (now < lockoutUntil) {
          const waitSecs = Math.ceil((lockoutUntil.getTime() - now.getTime()) / 1000);
          return err(`Too many resend attempts. Please wait ${waitSecs} seconds.`, 429, "OTP_LOCKED");
        }
        // Lockout expired — reset and allow a fresh send
      }

      // 30-second cooldown between resends
      if (existing.last_resend_at) {
        const lastResend = new Date(existing.last_resend_at);
        const cooldownUntil = new Date(lastResend.getTime() + OTP_RESEND_COOLDOWN_SECONDS * 1000);
        if (now < cooldownUntil) {
          const waitSecs = Math.ceil((cooldownUntil.getTime() - now.getTime()) / 1000);
          return err(`Please wait ${waitSecs} seconds before requesting another OTP.`, 429, "OTP_COOLDOWN");
        }
      }
    }

    // Generate new OTP — previous one is now invalidated by overwrite
    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60_000).toISOString();
    const newResendCount = existing ? Math.min((existing.resends ?? 0) + 1, OTP_MAX_RESENDS) : 0;

    // Upsert the verification record (invalidates previous OTP atomically)
    const { error: upsertError } = await supabase.from("email_verifications").upsert(
      {
        email: emailLower,
        otp_hash: otpHash,
        attempts: 0,
        resends: newResendCount,
        last_resend_at: now.toISOString(),
        expires_at: expiresAt,
        verified_at: null,
        created_at: existing ? existing.created_at : now.toISOString(),
      },
      { onConflict: "email" }
    );

    if (upsertError) {
      console.error("[OTP Send] Upsert error:", upsertError.message);
      return serverError();
    }

    // Send email (do NOT log the OTP)
    const { error: emailError } = await sendOTPEmail({
      to: emailLower,
      name,
      program,
      otp,
      expiryMinutes: OTP_EXPIRY_MINUTES,
    });

    if (emailError) {
      console.error("[OTP Send] Email error:", (emailError as any)?.message);
      return serverError("Failed to send verification email. Please try again.");
    }

    return ok({ success: true, expiresInMinutes: OTP_EXPIRY_MINUTES });
  } catch (e) {
    console.error("[OTP Send] Unexpected error:", e);
    return serverError();
  }
}
