import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { ReceiptDocument, ReceiptData } from "./receipt";

/**
 * Render a receipt PDF to a Buffer for storage or email attachment.
 * Must only be called server-side.
 */
export async function generateReceiptPDF(data: ReceiptData): Promise<Buffer> {
  const element = React.createElement(ReceiptDocument, { data });
  // Cast to any: @react-pdf/renderer's internal type differs from React's generic element type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any);
  return Buffer.from(buffer);
}

/**
 * Generate the receipt filename from the receipt number.
 * e.g. EDX-REC-00001.pdf
 */
export function receiptFilename(receiptNumber: string): string {
  return `${receiptNumber}.pdf`;
}
