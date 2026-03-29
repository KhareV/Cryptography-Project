"use client";

import { motion } from "framer-motion";
import { Logo } from "@/components/shared/Logo";
import { ThemeToggle } from "@/components/shared/ThemeToggle";

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen flex bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.08),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(16,185,129,0.08),transparent_45%)]">
      {/* Left Side - Branding */}
      <div className="relative hidden lg:flex lg:w-1/2 overflow-hidden border-r border-border/70 bg-gradient-to-br from-sky-600 via-cyan-600 to-emerald-500 p-12 flex-col justify-between">
        <div className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-white/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-black/10 blur-3xl" />
        <Logo size="lg" className="text-white [&_span]:text-white" />

        <div className="relative">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-4xl lg:text-5xl font-bold leading-tight text-white mb-6"
          >
            Private messaging,
            <br />
            built for speed.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="max-w-md text-lg text-white/85"
          >
            Send encrypted messages, launch calls instantly, and stay connected
            with communities from one secure hub.
          </motion.p>
        </div>

        <p className="relative text-white/65 text-sm">
          © {new Date().getFullYear()} ChatFlow. All rights reserved.
        </p>
      </div>

      {/* Right Side - Auth Form */}
      <div className="w-full lg:w-1/2 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 lg:p-6">
          <div className="lg:hidden">
            <Logo size="sm" />
          </div>
          <ThemeToggle />
        </div>

        {/* Auth Content */}
        <div className="flex-1 flex items-center justify-center p-4 lg:p-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-md rounded-3xl border border-border/80 bg-background/75 p-1 shadow-xl shadow-slate-900/10 backdrop-blur"
          >
            <div className="rounded-[22px] bg-background px-6 py-7 sm:px-8 sm:py-8">
              {children}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
