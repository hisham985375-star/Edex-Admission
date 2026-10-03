import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { draftSaveLimiter, getIdentifier } from "@/lib/rate-limit";
import { ok, err, tooManyRequests, serverError } from "@/lib/api-response";
import { DRAFT_EXPIRY_DAYS } from "@/lib/constants";
import { generateSecureToken, hashToken } from "@/lib/crypto";
import { z } from "zod";

const saveDraftSchema = z.object({
  email: z.string().email(),
  program: z.enum(["EGX 100", "EDEX Next"]),
  step: z.number().int().min(0).max(6),
  data: z.record(z.unknown()),
});

/**
 * POST /api/drafts
 * Upserts an application draft for email+program.
 * Enforces one-active-draft-per-email+program.
 * Returns a resume token on first creation.
 */
export async function POST(req: NextRequest) {
  const id = getIdentifier(req, "draft");
  const { allowed } = draftSaveLimiter(id);
  if (!allowed) return tooManyRequests();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err("Invalid request body");
  }

  const parsed = saveDraftSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Validation failed");

  const { email, program, step, data } = parsed.data;
  const supabase = createServiceClient();

  try {
    const expiresAt = new Date(Date.now() + DRAFT_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Check for existing draft
    const { data: existing } = await supabase
      .from("application_drafts")
      .select("id")
      .eq("email", email)
      .eq("program", program)
      .single();

    let draftId: string;
    let isNew = false;

    if (existing) {
      // Update existing draft
      const { error: updateError } = await supabase
        .from("application_drafts")
        .update({ data: { ...data, _step: step }, expires_at: expiresAt, updated_at: new Date().toISOString() })
        .eq("id", existing.id);

      if (updateError) {
        console.error("[Drafts] Update error:", updateError.message);
        return serverError("Failed to save draft. Please try again.");
      }

      draftId = existing.id;
    } else {
      // Insert new draft
      const { data: inserted, error: insertError } = await supabase
        .from("application_drafts")
        .insert({
          email,
          program,
          data: { ...data, _step: step },
          expires_at: expiresAt,
        })
        .select("id")
        .single();

      if (insertError || !inserted) {
        console.error("[Drafts] Insert error:", insertError?.message);
        return serverError("Failed to create draft. Please try again.");
      }

      draftId = inserted.id;
      isNew = true;
    }

    // Generate resume token only on first save
    let resumeToken: string | undefined;
    if (isNew) {
      const plainToken = generateSecureToken();
      const tokenHash = hashToken(plainToken);
      const tokenExpiresAt = expiresAt;

      await supabase.from("resume_tokens").insert({
        token_hash: tokenHash,
        draft_id: draftId,
        expires_at: tokenExpiresAt,
      });

      resumeToken = plainToken;
    }

    return ok({ success: true, draftId, ...(resumeToken ? { resumeToken } : {}) });
  } catch (e) {
    console.error("[Drafts] Unexpected error:", e);
    return serverError();
  }
}

/**
 * GET /api/drafts?email=&program=
 * Load an existing draft for this email+program.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  const program = searchParams.get("program");

  if (!email || !program) return err("Missing email or program");

  const supabase = createServiceClient();

  try {
    const { data: draft, error } = await supabase
      .from("application_drafts")
      .select("id, data, expires_at, updated_at")
      .eq("email", email)
      .eq("program", program)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (error || !draft) {
      return ok({ draft: null });
    }

    return ok({ draft });
  } catch (e) {
    console.error("[Drafts] GET error:", e);
    return serverError();
  }
}
