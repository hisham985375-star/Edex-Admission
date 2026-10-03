// ─── Application Fee (authoritative — never trust browser) ──────────────────
export const APPLICATION_FEE_PAISE = 100_000; // ₹1,000 in paise (Razorpay uses paise)
// ─── Program Slugs ──────────────────────────────────────────────────────────
export const PROGRAMS = {
  EGX100: "EGX 100",
  EDEX_NEXT: "EDEX Next",
} as const;
export type Program = (typeof PROGRAMS)[keyof typeof PROGRAMS];

// ─── Draft Expiry ────────────────────────────────────────────────────────────
export const DRAFT_EXPIRY_DAYS = 30;

// ─── OTP Settings ────────────────────────────────────────────────────────────
export const OTP_EXPIRY_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_RESENDS = 3;
export const OTP_RESEND_COOLDOWN_SECONDS = 30;
export const OTP_RESEND_LOCKOUT_MINUTES = 10;

// ─── Token Expiry ────────────────────────────────────────────────────────────
export const CONFIRMATION_TOKEN_EXPIRY_DAYS = 30;

// ─── Payment Statuses ────────────────────────────────────────────────────────
export const PAYMENT_STATUS = {
  PENDING: "payment_pending",
  PAID: "paid",
  FAILED: "failed",
  EXPIRED: "expired",
} as const;



// ─── Contact Info ────────────────────────────────────────────────────────────
export const WHATSAPP_NUMBER = "919539752725"; // +91 95397 52725
export const ADMISSIONS_EMAIL = "hello@admission.edexlifeschool.com";
export const INSTAGRAM_URL = "https://www.instagram.com/edex_life_school/";
export const ADMISSIONS_DOMAIN = "https://admissions.edexlifeschool.com";

// ─── Google Drive ────────────────────────────────────────────────────────────
export const DRIVE_FOLDER_NAME = "Admissions Documents";
