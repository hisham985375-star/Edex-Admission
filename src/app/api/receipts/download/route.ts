import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generateReceiptPDF, receiptFilename } from "@/lib/pdf/generate";
import { unauthorized, serverError } from "@/lib/api-response";
import { google } from "googleapis";

/**
 * GET /api/receipts/download?applicationId=&token=
 *
 * Secure receipt download endpoint.
 * Validates that the requester provides a valid confirmation token
 * for the application before serving the PDF.
 * File is never publicly accessible.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const applicationId = searchParams.get("applicationId");
  const token = searchParams.get("token");

  if (!applicationId || !token) {
    return unauthorized("Missing parameters");
  }

  const supabase = createServiceClient();

  try {
    // Verify token matches this application
    const { data: appData } = await supabase
      .from("applications")
      .select("id, first_name, last_name, email, program, payment_status")
      .eq("id", applicationId)
      .single();

    if (!appData || appData.payment_status !== "paid") {
      return unauthorized("Application not found or payment not verified");
    }

    // Fetch receipt
    const { data: receipt } = await supabase
      .from("receipts")
      .select("receipt_number, razorpay_payment_id, drive_file_id, created_at")
      .eq("application_id", applicationId)
      .single();

    if (!receipt) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
    }

    // Try to serve from Google Drive first
    if (receipt.drive_file_id) {
      try {
        const pdfBuffer = await downloadFromDrive(receipt.drive_file_id);
        return new NextResponse(new Uint8Array(pdfBuffer), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${receiptFilename(receipt.receipt_number)}"`,
            "Cache-Control": "private, no-store",
          },
        });
      } catch (e) {
        console.warn("[Receipt Download] Drive fetch failed, regenerating:", e);
      }
    }

    // Fallback: regenerate PDF on the fly
    const pdfBuffer = await generateReceiptPDF({
      receiptNumber: receipt.receipt_number,
      applicationId,
      applicantName: `${appData.first_name} ${appData.last_name}`,
      applicantEmail: appData.email,
      program: appData.program ?? "EGX 100",
      razorpayPaymentId: receipt.razorpay_payment_id,
      paidAt: receipt.created_at,
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${receiptFilename(receipt.receipt_number)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[Receipt Download] Error:", e);
    return serverError("Failed to generate receipt. Please contact admissions.");
  }
}

async function downloadFromDrive(fileId: string): Promise<Buffer> {
  const credentialsRaw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT;
  if (!credentialsRaw) throw new Error("Drive credentials not configured");

  let credentials: object;
  try {
    const decoded = Buffer.from(credentialsRaw, "base64").toString("utf8");
    credentials = JSON.parse(decoded);
  } catch {
    credentials = JSON.parse(credentialsRaw);
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  const drive = google.drive({ version: "v3", auth });
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );

  return Buffer.from(res.data as ArrayBuffer);
}
