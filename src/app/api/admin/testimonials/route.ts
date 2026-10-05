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

  const contentType = req.headers.get("content-type") || "";
  const supabase = createServiceClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let id: string;
  let current: any;

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    id = formData.get("id") as string;
    const studentName = formData.get("studentName") as string | null;
    const place = formData.get("place") as string | null;
    const batch = formData.get("batch") as string | null;
    const displayOrder = formData.get("displayOrder") as string | null;
    const thumbnailFile = formData.get("thumbnail") as File | null;

    if (!id) return err("ID is required");

    const { data: cur } = await supabase.from("testimonials").select("*").eq("id", id).single();
    if (!cur) return err("Testimonial not found", 404);
    current = cur;

    if (studentName !== null) updates.student_name = studentName;
    if (place !== null) updates.place = place;
    if (batch !== null) updates.batch = batch;
    if (displayOrder !== null) updates.display_order = parseInt(displayOrder ?? "0");

    if (thumbnailFile) {
      const thumbBuffer = Buffer.from(await thumbnailFile.arrayBuffer());
      const publicId = `${Date.now()}_${(studentName || current.student_name).replace(/\s+/g, "_").toLowerCase()}_thumb`;
      const { secureUrl } = await uploadImageToCloudinary(
        thumbBuffer,
        publicId,
        "testimonials/thumbnails"
      );
      updates.thumbnail_url = secureUrl;
    }
  } else {
    let body: unknown;
    try { body = await req.json(); } catch { return err("Invalid body"); }

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Validation failed");

    id = parsed.data.id;
    const { data: cur } = await supabase.from("testimonials").select("*").eq("id", id).single();
    if (!cur) return err("Testimonial not found", 404);
    current = cur;

    if (parsed.data.studentName !== undefined) updates.student_name = parsed.data.studentName;
    if (parsed.data.place !== undefined) updates.place = parsed.data.place;
    if (parsed.data.batch !== undefined) updates.batch = parsed.data.batch;
    if (parsed.data.displayOrder !== undefined) updates.display_order = parsed.data.displayOrder;
    if (parsed.data.isActive !== undefined) updates.is_active = parsed.data.isActive;
    if (parsed.data.isDeleted !== undefined) updates.is_deleted = parsed.data.isDeleted;
  }

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
