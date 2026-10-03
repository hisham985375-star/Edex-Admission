import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { onboardingSchema } from "@/lib/validations/application";
import { verifyTurnstile } from "@/lib/turnstile";
import { onboardingLimiter, getIdentifier } from "@/lib/rate-limit";
import { ok, err, tooManyRequests, serverError } from "@/lib/api-response";

/**
 * POST /api/onboarding
 * Saves initial lead information to the applications table and Google Sheets.
 * Server-side validation — never trust the client.
 */
export async function POST(req: NextRequest) {
  // Rate limit
  const id = getIdentifier(req, "onboarding");
  const { allowed } = onboardingLimiter(id);
  if (!allowed) return tooManyRequests();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err("Invalid request body");
  }

  // Server-side Zod validation
  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Validation failed");
  }

  const { firstName, lastName, mobile, email, reason, turnstileToken } = parsed.data;

  // Verify Turnstile
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim();
  const turnstileOk = await verifyTurnstile(turnstileToken, ip);
  if (!turnstileOk) return err("Human verification failed. Please try again.", 400, "TURNSTILE_FAILED");

  const supabase = createServiceClient();

  try {
    // Check if a lead already exists for this email
    const { data: existing } = await supabase
      .from("applications")
      .select("id")
      .eq("email", email.toLowerCase())
      .is("program", null) // Only un-programmed onboarding leads
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Already onboarded — return success idempotently
      return ok({ success: true, leadId: existing.id });
    }

    // Generate a temporary lead ID (LEAD-xxxxx)
    const leadId = `LEAD-${Date.now()}`;

    const { error: insertError } = await supabase.from("applications").insert({
      id: leadId,
      first_name: firstName,
      last_name: lastName,
      mobile,
      email: email.toLowerCase(),
      onboarding_reason: reason,
      payment_status: "payment_pending",
      admission_status: "New",
    });

    if (insertError) {
      console.error("[Onboarding] DB insert error:", insertError);
      return err(`DB insert error: ${insertError.message}`);
    }

    // Sync to Google Sheets (fire-and-forget — don't block user on Sheets failure)
    syncToSheets({ leadId, firstName, lastName, mobile, email, reason }).catch((e) =>
      console.error("[Onboarding] Google Sheets sync failed:", e)
    );

    return ok({ success: true, leadId });
  } catch (e: any) {
    console.error("[Onboarding] Unexpected error:", e);
    return err(`Unexpected error: ${e.message || String(e)}`);
  }
}

async function syncToSheets(data: {
  leadId: string;
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  reason: string;
}) {
  const url = process.env.GOOGLE_APPS_SCRIPT_URL;
  if (!url) return;

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "onboarding_lead", ...data }),
  });
}
