"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle, Download, Printer, MessageCircle, ArrowLeft } from "lucide-react";
import { WHATSAPP_NUMBER, ADMISSIONS_DOMAIN } from "@/lib/constants";

interface ConfirmationData {
  applicationId: string;
  program: string;
  applicantName: string;
  email: string;
  receiptNumber: string;
  paidAt: string;
}

export default function ConfirmationPage() {
  const [data, setData] = useState<ConfirmationData | null>(null);

  useEffect(() => {
    // Load from sessionStorage (set by payment verify flow)
    const raw = sessionStorage.getItem("edex_confirmation");
    if (raw) {
      try {
        setData(JSON.parse(raw));
      } catch {
        // ignore
      }
    }
  }, []);

  if (!data) {
    return (
      <div className="min-h-screen bg-edex-charcoal text-edex-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Session expired</h1>
          <p className="text-edex-white/60 mb-8">Please check your email for your confirmation details.</p>
          <Link href="/" className="text-edex-neon underline">Return to home</Link>
        </div>
      </div>
    );
  }

  const whatsappMessage = encodeURIComponent(
    `Hi EDEX! My name is ${data.applicantName}. I've applied for ${data.program}. My Application ID is ${data.applicationId}.`
  );

  return (
    <div className="min-h-screen bg-edex-charcoal text-edex-white flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Success animation */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="flex justify-center mb-8"
        >
          <div className="w-24 h-24 rounded-full bg-edex-neon flex items-center justify-center">
            <CheckCircle className="w-12 h-12 text-edex-charcoal" strokeWidth={2.5} />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center mb-10"
        >
          <h1 className="text-4xl font-bold mb-3">Application Confirmed!</h1>
          <p className="text-edex-white/60 text-lg">
            Welcome to the EDEX journey, {data.applicantName.split(" ")[0]}.
          </p>
        </motion.div>

        {/* Details card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="bg-edex-white/5 border border-edex-white/10 rounded-2xl p-6 mb-6 space-y-4"
        >
          {[
            { label: "Application ID", value: data.applicationId, highlight: true },
            { label: "Program", value: data.program },
            { label: "Email", value: data.email },
            { label: "Application Fee", value: "₹1,000 — Paid", highlight: true },
          ].map(({ label, value, highlight }) => (
            <div key={label} className="flex justify-between items-center">
              <span className="text-edex-white/50 text-sm">{label}</span>
              <span className={`font-bold text-sm ${highlight ? "text-edex-neon" : "text-edex-white"}`}>
                {value}
              </span>
            </div>
          ))}
        </motion.div>

        {/* Next steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="mb-8 p-4 border border-edex-neon/20 rounded-xl bg-edex-neon/5"
        >
          <h3 className="font-bold text-edex-neon mb-3 text-sm uppercase tracking-wider">What happens next?</h3>
          <ol className="space-y-2 text-sm text-edex-white/70">
            <li className="flex gap-2"><span className="text-edex-neon font-bold">1.</span> Check your email for the confirmation and receipt.</li>
            <li className="flex gap-2"><span className="text-edex-neon font-bold">2.</span> Our admissions team will review your application.</li>
            <li className="flex gap-2"><span className="text-edex-neon font-bold">3.</span> You will be contacted within 3–5 business days.</li>
          </ol>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="grid grid-cols-2 gap-3 mb-4"
        >
          <a
            href={`/api/receipts/download?applicationId=${data.applicationId}&token=session`}
            className="flex items-center justify-center gap-2 p-3 border border-edex-white/20 rounded-xl font-bold text-sm hover:bg-edex-white/10 transition-colors"
            download
          >
            <Download className="w-4 h-4" />
            Download Receipt
          </a>
          <button
            onClick={() => window.print()}
            className="flex items-center justify-center gap-2 p-3 border border-edex-white/20 rounded-xl font-bold text-sm hover:bg-edex-white/10 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Receipt
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="space-y-3"
        >
          {/* WhatsApp — deep link, does NOT auto-send */}
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full p-4 bg-[#25D366] text-white rounded-xl font-bold hover:opacity-90 transition-opacity"
          >
            <MessageCircle className="w-5 h-5" />
            WhatsApp EDEX Admissions
          </a>

          <Link
            href="https://www.edexlifeschool.com"
            className="flex items-center justify-center gap-2 w-full p-4 border border-edex-white/10 text-edex-white/60 rounded-xl font-bold hover:text-edex-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to EDEX Website
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
