import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { ok, err, serverError } from "@/lib/api-response";

/**
 * GET /api/admin/dashboard
 * Returns aggregated stats for the admin dashboard.
 * Supports date and program filters.
 */
export async function GET(req: NextRequest) {
  const authResult = await verifyAdmin(req);
  if (!authResult.authorized) return authResult.response;

  const { searchParams } = new URL(req.url);
  const program = searchParams.get("program") ?? "all";
  const dateRange = searchParams.get("dateRange") ?? "all";

  const supabase = createServiceClient();

  try {
    // Build date filter
    let dateFilter: string | null = null;
    const now = new Date();

    switch (dateRange) {
      case "today":
        dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        break;
      case "yesterday": {
        const d = new Date(now); d.setDate(d.getDate() - 1);
        dateFilter = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
        break;
      }
      case "7days":
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case "30days":
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case "thisMonth":
        dateFilter = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        break;
    }

    let query = supabase
      .from("applications")
      .select("id, program, payment_status, admission_status, created_at, first_name, last_name, email")
      .eq("is_deleted", false);

    if (program !== "all") {
      query = query.eq("program", program);
    }
    if (dateFilter) {
      query = query.gte("created_at", dateFilter);
    }

    const { data: applications, error } = await query;

    if (error) {
      console.error("[Admin Dashboard] Query error:", error.message);
      return serverError();
    }

    const apps = applications ?? [];

    const stats = {
      total: apps.length,
      paid: apps.filter((a) => a.payment_status === "paid").length,
      paymentPending: apps.filter((a) => a.payment_status === "payment_pending").length,
      failed: apps.filter((a) => a.payment_status === "failed").length,
      expired: apps.filter((a) => a.payment_status === "expired").length,
      byAdmissionStatus: {
        New: apps.filter((a) => a.admission_status === "New").length,
        Contacted: apps.filter((a) => a.admission_status === "Contacted").length,
        "Under Review": apps.filter((a) => a.admission_status === "Under Review").length,
        Selected: apps.filter((a) => a.admission_status === "Selected").length,
        Enrolled: apps.filter((a) => a.admission_status === "Enrolled").length,
      },
      byProgram: {
        "EGX 100": apps.filter((a) => a.program === "EGX 100").length,
        "EDEX Next": apps.filter((a) => a.program === "EDEX Next").length,
      },
      // 5 most recent paid applications
      recentApplications: apps
        .filter((a) => a.payment_status === "paid")
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .map((a) => ({
          id: a.id,
          name: `${a.first_name} ${a.last_name}`,
          email: a.email,
          program: a.program,
          admissionStatus: a.admission_status,
          createdAt: a.created_at,
        })),
    };

    return ok(stats);
  } catch (e) {
    console.error("[Admin Dashboard] Unexpected error:", e);
    return serverError();
  }
}
