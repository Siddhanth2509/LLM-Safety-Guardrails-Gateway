"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Shield, 
  Lock, 
  Eye, 
  EyeOff, 
  Loader2, 
  ArrowRight, 
  ShieldAlert,
  Terminal,
  Activity,
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Handle submit
  const handleSubmit = async (e?: React.FormEvent, customPassword?: string) => {
    if (e) e.preventDefault();
    const pwd = customPassword !== undefined ? customPassword : password;

    if (!pwd) {
      setError("Password is required");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Authentication successful! Welcome back.");
        // Redirect to dashboard
        router.push("/");
        router.refresh();
      } else {
        setError(data.error || "Authentication failed");
        toast.error(data.error || "Authentication failed");
        setIsLoading(false);
      }
    } catch (err) {
      setError("Network error. Please verify the server is running.");
      toast.error("Could not connect to authentication services.");
      setIsLoading(false);
    }
  };

  // Quick fill and auto submit for recruiters
  const handleQuickAccess = () => {
    setPassword("admin");
    handleSubmit(undefined, "admin");
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#09090b] text-[#e4e4e7] antialiased selection:bg-emerald-500/30">
      {/* Dynamic Cyber Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f0f13_1px,transparent_1px),linear-gradient(to_bottom,#0f0f13_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-80" />

      {/* Cyberpunk Neon Glow Accents */}
      <div className="pointer-events-none absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 right-1/4 h-[500px] w-[500px] rounded-full bg-violet-600/10 blur-[120px]" />

      <div className="relative w-full max-w-md px-4">
        {/* Animated Brand Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8 text-center"
        >
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/20 bg-[#0d0d12] shadow-[0_0_20px_rgba(16,185,129,0.1)]">
            <Shield className="h-7 w-7 text-emerald-400" />
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            Guardrails Gateway
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            LLM Input/Output Safety Dashboard
          </p>
        </motion.div>

        {/* Auth Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl border border-white/[0.06] bg-[#0c0c0f]/80 p-6 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.4)]"
        >
          <div className="mb-6 flex items-center justify-between border-b border-white/[0.06] pb-4">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-zinc-500" />
              <span className="font-mono text-xs text-zinc-500">SYSTEM: ACCESS_CONTROL</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
              <Activity className="h-3 w-3 animate-pulse" />
              PROTECTED
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Security Code
                </Label>
                {error && (
                  <motion.span
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-xs font-medium text-red-400 flex items-center gap-1"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Invalid Code
                  </motion.span>
                )}
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                  <Lock className="h-4 w-4" />
                </div>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter administrator password"
                  className="w-full border-white/[0.06] bg-[#0d0d12] pl-10 pr-10 text-zinc-200 transition-all duration-300 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="relative w-full overflow-hidden border border-emerald-500/20 bg-emerald-600 font-medium text-white transition-all duration-300 hover:bg-emerald-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-[0.98]"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Decrypting Vault...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  Unlock Console
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          {/* Quick Recruiter Access Button - WOW factor */}
          <div className="mt-6 border-t border-white/[0.06] pt-6">
            <div className="text-center">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                Recruiter Portal Access
              </span>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleQuickAccess}
              disabled={isLoading}
              className="mt-3 flex w-full items-center justify-between rounded-xl border border-violet-500/20 bg-violet-950/20 px-4 py-3 text-left transition-all duration-300 hover:bg-violet-950/40 hover:border-violet-500/40"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
                  <CheckCircle2 className="h-4.5 w-4.5 text-violet-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-violet-300">Quick Access for Recruiters</p>
                  <p className="text-[10px] text-zinc-500">Auto-fill &apos;admin&apos; credentials & login</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-violet-400" />
            </motion.button>
          </div>
        </motion.div>

        {/* Security Compliance Badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-8 flex items-center justify-center gap-4 text-zinc-600 font-mono text-[10px]"
        >
          <span>SQLITE // ENCRYPTED</span>
          <span>•</span>
          <span>HMAC // VERIFIED</span>
          <span>•</span>
          <span>PII MASKING // ACTIVE</span>
        </motion.div>
      </div>
    </div>
  );
}
