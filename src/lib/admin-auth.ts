import { createServiceClient } from "@/lib/supabase/server";
import { unauthorized, forbidden } from "@/lib/api-response";
import { NextRequest } from "next/server";

/**
 * Verify admin authentication for API routes.
 * Extracts the Bearer token from the Authorization header,
 * validates it with Supabase, and checks the admin role.
 *
 * Use this in every admin API route.
 */
export async function verifyAdmin(req: NextRequest): Promise<
  | { authorized: true; adminId: string }
  | { authorized: false; response: ReturnType<typeof unauthorized> }
> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { authorized: false, response: unauthorized() };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return { authorized: false, response: unauthorized() };
  }

  const supabase = createServiceClient();

  // Validate the JWT with Supabase
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { authorized: false, response: unauthorized("Invalid session") };
  }

  // Check admin role table
  const { data: admin } = await supabase
    .from("admins")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!admin) {
    return { authorized: false, response: forbidden("Not an admin") };
  }

  return { authorized: true, adminId: user.id };
}

/**
 * Log an admin action to the audit_logs table.
 * Audit logs are immutable — no update or delete operations.
 */
export async function logAdminAction({
  adminId,
  action,
  entity,
  entityId,
  previousValues,
  newValues,
}: {
  adminId: string;
  action: string;
  entity: string;
  entityId: string;
  previousValues?: object;
  newValues?: object;
}) {
  const supabase = createServiceClient();
  await supabase.from("audit_logs").insert({
    admin_id: adminId,
    action,
    entity,
    entity_id: entityId,
    previous_values: previousValues ?? null,
    new_values: newValues ?? null,
  });
}
