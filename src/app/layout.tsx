import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import React from "react";
import { ADMISSIONS_DOMAIN } from "@/lib/constants";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#161616",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(`https://${ADMISSIONS_DOMAIN}`),
  title: {
    default: "Admissions | EDEX Life School",
    template: "%s | EDEX Life School",
  },
  description: "Apply to EDEX Life School's premium programs including EGX 100 and EDEX Next. Build a career of consequence.",
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: `https://${ADMISSIONS_DOMAIN}`,
    siteName: "EDEX Admissions",
    title: "Admissions | EDEX Life School",
    description: "Apply to EDEX Life School's premium programs including EGX 100 and EDEX Next.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "EDEX Admissions",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Admissions | EDEX Life School",
    description: "Apply to EDEX Life School's premium programs including EGX 100 and EDEX Next.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  name: "EDEX Life School",
  url: `https://${ADMISSIONS_DOMAIN}`,
  logo: `https://${ADMISSIONS_DOMAIN}/logo.png`,
  description: "EDEX Life School offers premium educational programs focusing on holistic development.",
  sameAs: [
    "https://www.instagram.com/edexlifeschool",
    "https://www.linkedin.com/school/edex-life-school"
  ],
  potentialAction: {
    "@type": "ApplyAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `https://${ADMISSIONS_DOMAIN}/apply`
    }
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${spaceGrotesk.variable} h-full antialiased`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* Google Analytics (GA4) */}
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){window.dataLayer.push(arguments);}
                gtag('js', new Date());

                gtag('config', '${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}', {
                  page_path: window.location.pathname,
                });
              `}
            </Script>
          </>
        )}
      </head>
      <body className="min-h-full flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
