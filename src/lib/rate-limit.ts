import { NextRequest } from "next/server";

/** Simple in-memory rate limiter (process-level). For multi-instance production, use Redis. */
const store = new Map<string, { count: number; resetAt: number }>();

interface RateLimitOptions {
  windowMs: number;
  max: number;
}

export function rateLimit(options: RateLimitOptions) {
  return function check(identifier: string): { allowed: boolean; remaining: number } {
    // Disable rate limits in development to allow unlimited testing
    if (process.env.NODE_ENV !== "production") {
      return { allowed: true, remaining: 999 };
    }

    const now = Date.now();
    const record = store.get(identifier);

    if (!record || now >= record.resetAt) {
      store.set(identifier, { count: 1, resetAt: now + options.windowMs });
      return { allowed: true, remaining: options.max - 1 };
    }

    if (record.count >= options.max) {
      return { allowed: false, remaining: 0 };
    }

    record.count++;
    return { allowed: true, remaining: options.max - record.count };
  };
}

/** Get a consistent identifier from the request (IP or forwarded IP) */
export function getIdentifier(req: NextRequest, suffix = ""): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
  return suffix ? `${ip}:${suffix}` : ip;
}

// ─── Preconfigured limiters ──────────────────────────────────────────────────
export const onboardingLimiter = rateLimit({ windowMs: 60_000, max: 5 });
export const otpRequestLimiter = rateLimit({ windowMs: 60_000, max: 3 });
export const otpVerifyLimiter = rateLimit({ windowMs: 60_000, max: 10 });
export const paymentLimiter = rateLimit({ windowMs: 60_000, max: 5 });
export const draftSaveLimiter = rateLimit({ windowMs: 60_000, max: 30 });
