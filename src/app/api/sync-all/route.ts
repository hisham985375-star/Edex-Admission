import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { syncToGoogleSheets } from "@/lib/google/sheets";

export async function GET() {
  const supabase = createServiceClient();
  const { data: apps, error } = await supabase.from("applications").select("*").eq("payment_status", "payment_pending");

  if (error) {
    return NextResponse.json({ error });
  }

  const results = [];
  for (const app of apps) {
    const success = await syncToGoogleSheets({
      type: "application",
      applicationId: app.id,
      program: app.program,
      firstName: app.first_name,
      lastName: app.last_name,
      mobile: app.mobile,
      email: app.email,
      district: app.district,
      state: app.state,
      highestQualification: app.highest_qualification || "",
      paymentStatus: "payment_pending",
      paidAt: "",
      razorpayPaymentId: "",
    });
    results.push({ id: app.id, success });
  }

  return NextResponse.json({ synced: results.length, results });
}
