import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyAdmin, logAdminAction } from "@/lib/admin-auth";
import { ok, err, serverError } from "@/lib/api-response";
import { uploadVideoToCloudinary, uploadImageToCloudinary } from "@/lib/cloudinary/upload";
import { z } from "zod";

/**
 * GET /api/admin/testimonials — list all (including inactive/deleted)
 */
export async function GET(req: NextRequest) {
  const authResult = await verifyAdmin(req);
  if (!authResult.authorized) return authResult.response;

  const supabase = createServiceClient();
  const { searchParams } = new URL(req.url);
  const includeDeleted = searchParams.get("includeDeleted") === "true";

  let query = supabase
    .from("testimonials")
    .select("*")
    .order("batch", { ascending: true })
    .order("display_order", { ascending: true });

  if (!includeDeleted) query = query.eq("is_deleted", false);

  const { data, error } = await query;
  if (error) return serverError();
  return ok({ testimonials: data ?? [] });
}

/**
 * POST /api/admin/testimonials — upload video + optional thumbnail, create record
 * Expects multipart/form-data
 */
export async function POST(req: NextRequest) {
  const authResult = await verifyAdmin(req);
  if (!authResult.authorized) return authResult.response;

  let body: unknown;
  try { body = await req.json(); } catch { return err("Invalid body"); }

  const parsed = z.object({
    studentName: z.string().min(1),
    place: z.string().min(1),
    batch: z.string().min(1),
    displayOrder: z.number().int().default(0),
    videoUrl: z.string().url(),
    thumbnailUrl: z.string().url(),
  }).safeParse(body);

  if (!parsed.success) return err("Invalid payload");
  
  const { studentName, place, batch, displayOrder, videoUrl, thumbnailUrl } = parsed.data;

  try {
    const supabase = createServiceClient();
    const { data: testimonial, error: insertErr } = await supabase
      .from("testimonials")
      .insert({
        student_name: studentName,
        place,
        batch,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        display_order: displayOrder,
        is_active: true,
        is_deleted: false,
      })
      .select()
      .single();

    if (insertErr) return serverError("Failed to save testimonial");

    await logAdminAction({
      adminId: authResult.adminId,
      action: "CREATE",
      entity: "testimonials",
      entityId: testimonial.id,
      newValues: { studentName, place, batch, videoUrl, thumbnailUrl },
    });

    return ok({ success: true, testimonial });
  } catch (e) {
    console.error("[Admin Testimonials] Create error:", e);
    return serverError("Failed to save testimonial. Please try again.");
  }
}

const updateSchema = z.object({
  id: z.string().uuid(),
  studentName: z.string().min(1).max(100).optional(),
  place: z.string().min(1).max(100).optional(),
  batch: z.string().min(1).max(50).optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  isDeleted: z.boolean().optional(),
});

/**
 * PATCH /api/admin/testimonials — update metadata, activate/deactivate, soft-delete
 */
export async function PATCH(req: NextRequest) {
  const authResult = await verifyAdmin(req);
  if (!authResult.authorized) return authResult.response;

  let body: unknown;
  try { body = await req.json(); } catch { return err("Invalid body"); }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Validation failed");

  const { id, studentName, place, batch, displayOrder, isActive, isDeleted, thumbnailUrl } = parsed.data as any; // any because we need to extract thumbnailUrl too
  const supabase = createServiceClient();

  const { data: current } = await supabase.from("testimonials").select("*").eq("id", id).single();
  if (!current) return err("Testimonial not found", 404);

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (studentName !== undefined) updates.student_name = studentName;
  if (place !== undefined) updates.place = place;
  if (batch !== undefined) updates.batch = batch;
  if (displayOrder !== undefined) updates.display_order = displayOrder;
  if (isActive !== undefined) updates.is_active = isActive;
  if (isDeleted !== undefined) updates.is_deleted = isDeleted;
  if (thumbnailUrl !== undefined) updates.thumbnail_url = thumbnailUrl;

  const { error } = await supabase.from("testimonials").update(updates).eq("id", id);
  if (error) return serverError();

  await logAdminAction({
    adminId: authResult.adminId,
    action: "UPDATE",
    entity: "testimonials",
    entityId: id,
    previousValues: current,
    newValues: updates,
  });

  return ok({ success: true });
}
