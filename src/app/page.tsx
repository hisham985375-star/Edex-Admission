"use client";

import { useState, useEffect } from "react";
import Onboarding from "@/components/Onboarding";
import AdmissionsExperience from "@/components/AdmissionsExperience";

export default function Home() {
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if user has already onboarded
    try {
      const onboarded = localStorage.getItem("edex_onboarded");
      if (onboarded) {
        setHasOnboarded(true);
      } else {
        setHasOnboarded(false);
      }
    } catch (e) {
      console.error("localStorage access denied");
      setHasOnboarded(false); // Default to false if blocked
    }
  }, []);

  if (hasOnboarded === null) {
    return null; // or a minimal loading state
  }

  return (
    <main className="min-h-screen bg-edex-white text-edex-charcoal">
      {!hasOnboarded ? (
        <Onboarding onComplete={() => {
          localStorage.setItem("edex_onboarded", "true");
          setHasOnboarded(true);
        }} />
      ) : (
        <AdmissionsExperience />
      )}
    </main>
  );
}
