"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [totp, setTotp] = useState("");
  const [step, setStep] = useState<"credentials" | "mfa">("credentials");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const supabase = createBrowserSupabaseClient();

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError("Invalid email or password.");
        return;
      }

      // Check if MFA is required
      if (data.session) {
        // Check if this user is an admin
        const { data: adminCheck } = await supabase
          .from("admins")
          .select("role")
          .eq("id", data.user.id)
          .single();

        if (!adminCheck) {
          await supabase.auth.signOut();
          setError("Access denied. Admin account required.");
          return;
        }

        // Redirect to dashboard
        window.location.href = "/admin/dashboard";
      } else {
        // MFA challenge pending
        setStep("mfa");
      }
    } catch (err: any) {
      setError(`Unexpected error: ${err.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleMFA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.listFactors();

      if (challengeError || !challengeData.totp.length) {
        setError("MFA not configured. Contact super admin.");
        return;
      }

      const factorId = challengeData.totp[0].id;
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: totp,
      });

      if (verifyError) {
        setError("Invalid authentication code.");
        return;
      }

      window.location.href = "/admin/dashboard";
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#CEFF00] mb-4">
            <Lock className="w-6 h-6 text-[#161616]" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Access</h1>
          <p className="text-gray-400 text-sm mt-1">EDEX Life School Admissions</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-900/30 border border-red-500/30 rounded-lg text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {step === "credentials" ? (
          <form onSubmit={handleCredentials} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 w-4 h-4 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-[#CEFF00] focus:outline-none"
                  placeholder="admin@edexlifeschool.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 w-4 h-4 text-gray-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-[#CEFF00] focus:outline-none"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-3.5 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#CEFF00] text-[#161616] font-bold rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Verifying..." : "Sign In"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleMFA} className="space-y-4">
            <p className="text-gray-400 text-sm text-center mb-4">
              Enter the 6-digit code from your authenticator app.
            </p>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Authentication Code</label>
              <input
                type="text"
                inputMode="numeric"
                value={totp}
                onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white text-center text-2xl tracking-widest focus:border-[#CEFF00] focus:outline-none"
                placeholder="000000"
                maxLength={6}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || totp.length !== 6}
              className="w-full py-3 bg-[#CEFF00] text-[#161616] font-bold rounded-lg hover:bg-white transition-colors disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify"}
            </button>
            <button
              type="button"
              onClick={() => { setStep("credentials"); setTotp(""); setError(""); }}
              className="w-full text-gray-500 text-sm hover:text-gray-300 transition-colors"
            >
              ← Back
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
