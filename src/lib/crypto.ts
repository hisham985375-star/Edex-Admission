import crypto from "crypto";

/**
 * Generate a cryptographically random token (URL-safe base64)
 */
export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

/**
 * Hash a plaintext token with SHA-256 for storage.
 * We NEVER store plaintext tokens — only hashes.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generate a 6-digit numeric OTP
 */
export function generateOTP(): string {
  const digits = crypto.randomInt(0, 1_000_000);
  return String(digits).padStart(6, "0");
}

/**
 * Hash an OTP for storage — we never store the raw OTP.
 */
export function hashOTP(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

/**
 * Constant-time comparison to prevent timing attacks.
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
