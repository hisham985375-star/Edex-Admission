"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Turnstile } from "@marsidev/react-turnstile";
import { Loader2 } from "lucide-react";

type OnboardingProps = {
  onComplete: () => void;
};

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    mobile: "",
    email: "",
    reason: "",
    turnstileToken: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const nextStep = () => setStep((s) => s + 1);
  
  const submitOnboarding = async () => {
    setIsSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      onComplete();
    } catch (err: any) {
      setSubmitError(err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center text-edex-white p-4 relative bg-cover bg-center"
      style={{ backgroundImage: "url('/images/bg-lecture-hall.png')" }}
    >
      <div className="absolute inset-0 bg-black/80 z-0" />
      <div className="relative z-10 flex w-full justify-center">
        <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center"
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-8">Welcome to EDEX Life School</h1>
            <button 
              onClick={nextStep}
              className="px-8 py-3 bg-edex-neon text-edex-charcoal font-bold rounded-full hover:opacity-90 transition-opacity"
            >
              Begin
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full max-w-md"
          >
            <h2 className="text-3xl font-bold mb-6">What's your name?</h2>
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="First name" 
                className="w-full p-4 bg-transparent border border-edex-white/20 rounded-lg focus:border-edex-neon focus:outline-none"
                value={formData.firstName}
                onChange={(e) => setFormData({...formData, firstName: e.target.value})}
              />
              <input 
                type="text" 
                placeholder="Last name" 
                className="w-full p-4 bg-transparent border border-edex-white/20 rounded-lg focus:border-edex-neon focus:outline-none"
                value={formData.lastName}
                onChange={(e) => setFormData({...formData, lastName: e.target.value})}
              />
              <button 
                onClick={nextStep}
                disabled={!formData.firstName || !formData.lastName}
                className="w-full p-4 bg-edex-neon text-edex-charcoal font-bold rounded-lg disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full max-w-md"
          >
            <h2 className="text-3xl font-bold mb-6">How can we reach you?</h2>
            <div className="space-y-4">
              <input 
                type="tel" 
                placeholder="Mobile Number (10 digits)" 
                className="w-full p-4 bg-transparent border border-edex-white/20 rounded-lg focus:border-edex-neon focus:outline-none"
                value={formData.mobile}
                onChange={(e) => setFormData({...formData, mobile: e.target.value})}
              />
              <input 
                type="email" 
                placeholder="Email Address" 
                className="w-full p-4 bg-transparent border border-edex-white/20 rounded-lg focus:border-edex-neon focus:outline-none"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
              <button 
                onClick={nextStep}
                disabled={!formData.mobile || !formData.email || formData.mobile.length !== 10}
                className="w-full p-4 bg-edex-neon text-edex-charcoal font-bold rounded-lg disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full max-w-md"
          >
            <h2 className="text-3xl font-bold mb-6">Why are you connecting with EDEX?</h2>
            <div className="space-y-4">
              <textarea 
                placeholder="Share your goals or what you're looking for..." 
                className="w-full p-4 bg-transparent border border-edex-white/20 rounded-lg focus:border-edex-neon focus:outline-none min-h-[150px]"
                value={formData.reason}
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
              />
              
              <div className="flex justify-center my-4">
                <Turnstile
                  siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"}
                  onSuccess={(token) => setFormData({...formData, turnstileToken: token})}
                  options={{ theme: "dark" }}
                />
              </div>

              {submitError && <p className="text-red-500 text-sm text-center">{submitError}</p>}

              <button 
                onClick={submitOnboarding}
                disabled={!formData.reason || !formData.turnstileToken || isSubmitting}
                className="w-full p-4 bg-edex-neon text-edex-charcoal font-bold rounded-lg disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
                Explore Programs
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
