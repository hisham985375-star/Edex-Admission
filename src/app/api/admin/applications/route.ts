import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyAdmin, logAdminAction } from "@/lib/admin-auth";
import { ok, err, serverError } from "@/lib/api-response";
import { z } from "zod";

const PAGE_SIZE = 20;

/**
 * GET /api/admin/applications
 * Paginated, filterable, searchable application list.
 */
export async function GET(req: NextRequest) {
  const authResult = await verifyAdmin(req);
  if (!authResult.authorized) return authResult.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const search = searchParams.get("search") ?? "";
  const program = searchParams.get("program") ?? "all";
  const paymentStatus = searchParams.get("paymentStatus") ?? "all";
  const admissionStatus = searchParams.get("admissionStatus") ?? "all";
  const showDeleted = searchParams.get("showDeleted") === "true";

  const supabase = createServiceClient();
  const offset = (page - 1) * PAGE_SIZE;

  try {
    let query = supabase
      .from("applications")
      .select("id, program, first_name, last_name, email, mobile, payment_status, admission_status, created_at, is_deleted", { count: "exact" })
      .eq("is_deleted", showDeleted)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (program !== "all") query = query.eq("program", program);
    if (paymentStatus !== "all") query = query.eq("payment_status", paymentStatus);
    if (admissionStatus !== "all") query = query.eq("admission_status", admissionStatus);
    if (search) {
      // Search across ID, name, email, mobile
      query = query.or(
        `id.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,mobile.ilike.%${search}%`
      );
    }

    const { data, count, error } = await query;
    if (error) return serverError();

    return ok({ applications: data ?? [], total: count ?? 0, page, pageSize: PAGE_SIZE });
  } catch (e) {
    console.error("[Admin Applications] GET error:", e);
    return serverError();
  }
}

const updateSchema = z.object({
  applicationId: z.string().min(1),
  admissionStatus: z.enum(["New", "Contacted", "Under Review", "Selected", "Enrolled"]).optional(),
  internalNotes: z.string().max(2000).optional(),
  isDeleted: z.boolean().optional(),
});

/**
 * PATCH /api/admin/applications
 * Update admission status, notes, or soft-delete.
 * Payment data is immutable via this endpoint.
 */
export async function PATCH(req: NextRequest) {
  const authResult = await verifyAdmin(req);
  if (!authResult.authorized) return authResult.response;

  let body: unknown;
  try { body = await req.json(); } catch { return err("Invalid body"); }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Validation failed");

  const { applicationId, admissionStatus, internalNotes, isDeleted } = parsed.data;
  const supabase = createServiceClient();

  try {
    // Fetch current state for audit log
    const { data: current } = await supabase
      .from("applications")
      .select("admission_status, internal_notes, is_deleted")
      .eq("id", applicationId)
      .single();

    if (!current) return err("Application not found", 404);

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (admissionStatus !== undefined) updates.admission_status = admissionStatus;
    if (internalNotes !== undefined) updates.internal_notes = internalNotes;
    if (isDeleted !== undefined) updates.is_deleted = isDeleted;

    const { error: updateError } = await supabase
      .from("applications")
      .update(updates)
      .eq("id", applicationId);

    if (updateError) return serverError("Failed to update application");

    // Audit log
    await logAdminAction({
      adminId: authResult.adminId,
      action: isDeleted === true ? "SOFT_DELETE" : isDeleted === false ? "RESTORE" : "UPDATE",
      entity: "applications",
      entityId: applicationId,
      previousValues: current,
      newValues: updates,
    });

    return ok({ success: true });
  } catch (e) {
    console.error("[Admin Applications] PATCH error:", e);
    return serverError();
  }
}
