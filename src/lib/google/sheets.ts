/**
 * Google Sheets sync via Google Apps Script Web App.
 *
 * The Apps Script Web App handles two tabs:
 *   Tab 1: Onboarding Leads
 *   Tab 2: Applications
 *
 * This module handles the HTTP POST to that endpoint with retry logic.
 * Supabase is always the source of truth — Sheets is secondary.
 * If Sheets fails, the application is NOT affected.
 */

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export type SheetsPayload =
  | { type: "onboarding_lead"; leadId: string; firstName: string; lastName: string; mobile: string; email: string; reason: string }
  | { type: "application"; applicationId: string; program: string; firstName: string; lastName: string; mobile: string; email: string; district: string; state: string; highestQualification: string; paymentStatus: string; paidAt: string; razorpayPaymentId: string; };

/**
 * Send a row to Google Sheets via Apps Script.
 * Retries up to MAX_RETRIES times with exponential backoff.
 * Never throws — caller receives a boolean result.
 */
export async function syncToGoogleSheets(payload: SheetsPayload): Promise<boolean> {
  const url = process.env.GOOGLE_APPS_SCRIPT_URL;
  if (!url) {
    console.warn("[Sheets] GOOGLE_APPS_SCRIPT_URL not configured — skipping sync");
    return false;
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000), // 8s timeout
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.success !== false) {
          return true;
        }
      }

      const text = await res.text().catch(() => "");
      console.warn(`[Sheets] Attempt ${attempt} failed (${res.status}):`, text.slice(0, 200));
    } catch (e: unknown) {
      console.warn(`[Sheets] Attempt ${attempt} error:`, e instanceof Error ? e.message : e);
    }

    if (attempt < MAX_RETRIES) {
      await delay(RETRY_DELAY_MS * attempt); // exponential backoff
    }
  }

  console.error("[Sheets] All retry attempts failed for payload type:", payload.type);
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
