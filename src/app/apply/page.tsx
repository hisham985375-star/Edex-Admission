import ApplicationWizard from "@/components/ApplicationWizard";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Apply | EDEX Life School",
  description: "Application wizard for EDEX Life School programs",
};

export default function ApplyPage() {
  return (
    <main className="min-h-screen bg-edex-charcoal text-edex-white">
      <ApplicationWizard />
    </main>
  );
}
