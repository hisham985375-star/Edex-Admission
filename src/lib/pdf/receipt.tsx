import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import React from "react";
import {
  ADMISSIONS_EMAIL,
  ADMISSIONS_DOMAIN,
  WHATSAPP_NUMBER,
} from "@/lib/constants";

// Register Space Grotesk if needed — fall back to Helvetica for PDF (web fonts may not be embeddable)
// For production, host font files on Cloudinary or public URL and register here

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
    padding: 0,
    flexDirection: "column",
  },
  // ─── Header band ─────────────────────────────────────────────────────────
  header: {
    backgroundColor: "#161616",
    padding: "32 40",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
  },
  headerSub: {
    color: "#CEFF00",
    fontSize: 9,
    marginTop: 2,
  },
  receiptLabel: {
    color: "#CEFF00",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
  },
  receiptNum: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
    marginTop: 2,
  },
  // ─── Confirmation badge ────────────────────────────────────────────────────
  badge: {
    backgroundColor: "#CEFF00",
    marginHorizontal: 40,
    marginTop: 32,
    padding: "16 20",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badgeText: {
    color: "#161616",
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
  },
  badgeSub: {
    color: "#161616",
    fontSize: 9,
    marginTop: 2,
  },
  // ─── Section ──────────────────────────────────────────────────────────────
  section: {
    marginHorizontal: 40,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#888888",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
    paddingBottom: 6,
  },
  row: {
    flexDirection: "row",
    marginBottom: 8,
  },
  label: {
    fontSize: 9,
    color: "#888888",
    width: 160,
    flexShrink: 0,
  },
  value: {
    fontSize: 9,
    color: "#161616",
    fontFamily: "Helvetica-Bold",
    flex: 1,
  },
  // ─── Amount box ────────────────────────────────────────────────────────────
  amountBox: {
    marginHorizontal: 40,
    marginTop: 24,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    borderRadius: 8,
    padding: "16 20",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  amountLabel: {
    fontSize: 11,
    color: "#161616",
    fontFamily: "Helvetica-Bold",
  },
  amountSub: {
    fontSize: 8,
    color: "#888888",
    marginTop: 2,
  },
  amountValue: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#161616",
  },
  // ─── Footer ────────────────────────────────────────────────────────────────
  footer: {
    marginTop: "auto",
    backgroundColor: "#F8F8F8",
    padding: "16 40",
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 8,
    color: "#888888",
  },
  footerLink: {
    fontSize: 8,
    color: "#161616",
  },
});

export interface ReceiptData {
  receiptNumber: string;
  applicationId: string;
  applicantName: string;
  applicantEmail: string;
  program: string;
  razorpayPaymentId: string;
  paidAt: string; // ISO timestamp
}

export function ReceiptDocument({ data }: { data: ReceiptData }) {
  const paidAtIST = toZonedTime(new Date(data.paidAt), "Asia/Kolkata");
  const formattedDate = format(paidAtIST, "dd MMM yyyy, hh:mm a 'IST'");

  return (
    <Document
      title={`${data.receiptNumber} — EDEX Life School`}
      author="EDEX Life School"
      subject="Application Fee Receipt"
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>EDEX Life School</Text>
            <Text style={styles.headerSub}>Admissions Platform</Text>
          </View>
          <View>
            <Text style={styles.receiptLabel}>PAYMENT RECEIPT</Text>
            <Text style={styles.receiptNum}>{data.receiptNumber}</Text>
          </View>
        </View>

        {/* Confirmation badge */}
        <View style={styles.badge}>
          <View>
            <Text style={styles.badgeText}>Payment Confirmed ✓</Text>
            <Text style={styles.badgeSub}>Application fee received and verified</Text>
          </View>
          <View>
            <Text style={[styles.badgeText, { textAlign: "right" }]}>{formattedDate}</Text>
          </View>
        </View>

        {/* Applicant details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Applicant Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{data.applicantName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{data.applicantEmail}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Application ID</Text>
            <Text style={styles.value}>{data.applicationId}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Program</Text>
            <Text style={styles.value}>{data.program}</Text>
          </View>
        </View>

        {/* Payment details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Receipt Number</Text>
            <Text style={styles.value}>{data.receiptNumber}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Payment Reference</Text>
            <Text style={styles.value}>{data.razorpayPaymentId}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Payment Date & Time</Text>
            <Text style={styles.value}>{formattedDate}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Payment Method</Text>
            <Text style={styles.value}>Online Payment via Razorpay</Text>
          </View>
        </View>

        {/* Amount */}
        <View style={styles.amountBox}>
          <View>
            <Text style={styles.amountLabel}>Application Fee</Text>
            <Text style={styles.amountSub}>Non-refundable admissions processing fee</Text>
          </View>
          <Text style={styles.amountValue}>₹1,000</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View>
            <Text style={styles.footerText}>EDEX Life School</Text>
            <Text style={styles.footerLink}>{ADMISSIONS_DOMAIN}</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={styles.footerText}>WhatsApp</Text>
            <Text style={styles.footerLink}>+91 {WHATSAPP_NUMBER.replace("91", "")}</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={styles.footerText}>Email</Text>
            <Text style={styles.footerLink}>{ADMISSIONS_EMAIL}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.footerText}>Instagram</Text>
            <Text style={styles.footerLink}>@edex_life_school</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
