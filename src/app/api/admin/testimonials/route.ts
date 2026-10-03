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

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return err("Invalid form data");
  }

  const studentName = formData.get("studentName") as string;
  const place = formData.get("place") as string;
  const batch = formData.get("batch") as string;
  const displayOrder = parseInt((formData.get("displayOrder") as string) ?? "0");
  const videoFile = formData.get("video") as File | null;
  const thumbnailFile = formData.get("thumbnail") as File | null;

  if (!studentName || !place || !batch || !videoFile) {
    return err("studentName, place, batch, and video are required");
  }

  try {
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    const publicId = `${Date.now()}_${studentName.replace(/\s+/g, "_").toLowerCase()}`;

    // Upload video — server-side signed upload (secret never leaves server)
    const { secureUrl: videoUrl, thumbnailUrl: autoThumb } = await uploadVideoToCloudinary(
      videoBuffer,
      publicId,
      "testimonials"
    );

    let finalThumbnailUrl = autoThumb;

    // Upload custom thumbnail if provided
    if (thumbnailFile) {
      const thumbBuffer = Buffer.from(await thumbnailFile.arrayBuffer());
      const { secureUrl } = await uploadImageToCloudinary(
        thumbBuffer,
        `${publicId}_thumb`,
        "testimonials/thumbnails"
      );
      finalThumbnailUrl = secureUrl;
    }

    const supabase = createServiceClient();
    const { data: testimonial, error: insertErr } = await supabase
      .from("testimonials")
      .insert({
        student_name: studentName,
        place,
        batch,
        video_url: videoUrl,
        thumbnail_url: finalThumbnailUrl,
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
      newValues: { studentName, place, batch, videoUrl, thumbnailUrl: finalThumbnailUrl },
    });

    return ok({ success: true, testimonial });
  } catch (e) {
    console.error("[Admin Testimonials] Upload error:", e);
    return serverError("Failed to upload testimonial. Please try again.");
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

  const { id, studentName, place, batch, displayOrder, isActive, isDeleted } = parsed.data;
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

  const { error } = await supabase.from("testimonials").update(updates).eq("id", id);
  if (error) return serverError();

  await logAdminAction({
    adminId: authResult.adminId,
    action: isDeleted === true ? "SOFT_DELETE" : isDeleted === false ? "RESTORE" : "UPDATE",
    entity: "testimonials",
    entityId: id,
    previousValues: current,
    newValues: updates,
  });

  return ok({ success: true });
}
