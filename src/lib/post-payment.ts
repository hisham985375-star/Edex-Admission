import { createServiceClient } from "@/lib/supabase/server";
import { generateReceiptPDF, receiptFilename } from "@/lib/pdf/generate";
import { uploadToDrive } from "@/lib/google/drive";
import { syncToGoogleSheets } from "@/lib/google/sheets";
import { sendConfirmationEmail } from "@/lib/resend/emails";
import { DRIVE_FOLDER_NAME } from "@/lib/constants";

export interface PostPaymentParams {
  applicationId: string;
  razorpayPaymentId: string;
  name: string;
  email: string;
  program: string;
  paidAt: string; // ISO UTC timestamp
}

/**
 * Orchestrates all post-payment tasks after a verified payment.
 *
 * Order:
 * 1. Generate a sequential receipt number (DB sequence)
 * 2. Render PDF receipt
 * 3. Upload PDF to private Google Drive
 * 4. Store receipt record in DB
 * 5. Send confirmation email with receipt attached
 * 6. Sync application to Google Sheets
 *
 * Critical rule: if ANY step fails after payment, the application remains PAID.
 * Each step logs its failure independently. No failure propagates to the caller
 * in a way that would trigger re-payment.
 */
export async function runPostPaymentTasks(params: PostPaymentParams): Promise<void> {
  const { applicationId, razorpayPaymentId, name, email, program, paidAt } = params;
  const supabase = createServiceClient();

  // ─── 1. Check if receipt already exists (idempotency) ────────────────────
  const { data: existingReceipt } = await supabase
    .from("receipts")
    .select("receipt_number, drive_file_id")
    .eq("application_id", applicationId)
    .single();

  let receiptNumber: string;
  let driveFileId: string | null = null;

  if (existingReceipt) {
    // Receipt already created — use existing data for email resend
    receiptNumber = existingReceipt.receipt_number;
    driveFileId = existingReceipt.drive_file_id;
  } else {
    // ─── 2. Generate receipt number from DB sequence ───────────────────────
    const { data: seqResult } = await supabase.rpc("nextval", {
      sequence_name: "receipt_number_seq",
    });

    const seqNum = seqResult ? String(seqResult).padStart(5, "0") : Date.now().toString().slice(-5);
    receiptNumber = `EDX-REC-${seqNum}`;

    // ─── 3. Render PDF receipt ──────────────────────────────────────────────
    let receiptBuffer: Buffer | null = null;
    try {
      receiptBuffer = await generateReceiptPDF({
        receiptNumber,
        applicationId,
        applicantName: name,
        applicantEmail: email,
        program,
        razorpayPaymentId,
        paidAt,
      });
    } catch (e) {
      console.error("[PostPayment] PDF generation failed:", e);
      // Continue — we'll retry receipt generation separately
    }

    // ─── 4. Upload PDF to private Google Drive ──────────────────────────────
    if (receiptBuffer) {
      try {
        driveFileId = await uploadToDrive({
          buffer: receiptBuffer,
          filename: receiptFilename(receiptNumber),
          mimeType: "application/pdf",
          folderName: DRIVE_FOLDER_NAME,
        });
      } catch (e) {
        console.error("[PostPayment] Drive upload failed:", e);
        // Continue — receipt record can be updated when Drive recovers
      }
    }

    // ─── 5. Store receipt record ────────────────────────────────────────────
    const { error: receiptInsertErr } = await supabase.from("receipts").insert({
      receipt_number: receiptNumber,
      application_id: applicationId,
      amount: 1000,
      razorpay_payment_id: razorpayPaymentId,
      drive_file_id: driveFileId,
    });

    if (receiptInsertErr) {
      console.error("[PostPayment] Receipt DB insert failed:", receiptInsertErr.message);
    }
  }

  // ─── 6. Send confirmation email ────────────────────────────────────────────
  // Re-generate PDF for attachment if we have the data
  try {
    const pdfBuffer = await generateReceiptPDF({
      receiptNumber,
      applicationId,
      applicantName: name,
      applicantEmail: email,
      program,
      razorpayPaymentId,
      paidAt,
    });

    await sendConfirmationEmail({
      to: email,
      name,
      program,
      applicationId,
      receiptBuffer: pdfBuffer,
      receiptFilename: receiptFilename(receiptNumber),
    });
  } catch (e) {
    console.error("[PostPayment] Confirmation email failed:", e);
    // Application remains PAID — email can be resent later
  }

  // ─── 7. Sync to Google Sheets ───────────────────────────────────────────────
  // Fetch full application for Sheets row
  const { data: app } = await supabase
    .from("applications")
    .select("mobile, district, state, highest_qualification")
    .eq("id", applicationId)
    .single();

  syncToGoogleSheets({
    type: "application",
    applicationId,
    program,
    firstName: name.split(" ")[0],
    lastName: name.split(" ").slice(1).join(" "),
    mobile: app?.mobile ?? "",
    email,
    district: app?.district ?? "",
    state: app?.state ?? "",
    highestQualification: app?.highest_qualification ?? "",
    paymentStatus: "paid",
    paidAt,
    razorpayPaymentId,
  }).catch((e) => console.error("[PostPayment] Sheets sync error:", e));

  // ─── 8. Invalidate resume token (application completed) ───────────────────
  const { data: draft } = await supabase
    .from("application_drafts")
    .select("id")
    .eq("email", email)
    .eq("program", program)
    .single();

  if (draft) {
    await supabase.from("resume_tokens").delete().eq("draft_id", draft.id);
    await supabase.from("application_drafts").delete().eq("id", draft.id);
  }

  console.log(`[PostPayment] Completed for application ${applicationId}`);
}
