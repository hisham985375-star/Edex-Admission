import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "../globals.css";
import React from "react";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Admin | EDEX Life School",
  description: "EDEX Admissions Administration",
  robots: { index: false, follow: false }, // Never index admin pages
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full font-sans bg-gray-950 text-white antialiased">
      {children}
    </div>
  );
}
