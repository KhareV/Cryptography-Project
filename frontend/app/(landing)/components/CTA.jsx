"use client";

import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import {
  motion,
  useScroll,
  useTransform,
  useMotionTemplate,
  useMotionValue,
  animate,
  AnimatePresence,
} from "framer-motion";
import { ArrowRight, Sparkles, Zap, Fingerprint, Star } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { Plus_Jakarta_Sans } from "next/font/google";

// --- Fonts & Assets ---
const font = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
});

/**
 * A spotlight effect card that follows the mouse movement
 */
const SpotlightCard = ({ children, className = "" }) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  return (
    <div
      onMouseMove={handleMouseMove}
      className={`group relative border border-white/10 bg-gray-900/40 overflow-hidden ${className}`}
    >
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              650px circle at ${mouseX}px ${mouseY}px,
              rgba(255,255,255,0.12),
              transparent 80%
            )
          `,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
};

/**
 * The background layer with animated orbs and grid patterns
 */
const AnimatedBackground = () => {
  return (
    <div className="absolute inset-0 -z-0 overflow-hidden bg-[#020617]">
      {/* Animated Orbs */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.15, 0.3, 0.15],
          x: [0, 50, 0],
          y: [0, -30, 0],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-[10%] left-[10%] w-[600px] h-[600px] rounded-full bg-blue-600/30 blur-[120px]"
      />
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.1, 0.25, 0.1],
          x: [0, -40, 0],
          y: [0, 40, 0],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
        className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-indigo-600/20 blur-[100px]"
      />

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

      {/* Vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#020617]" />
    </div>
  );
};

const ShimmerButton = ({ children, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="group relative inline-flex h-12 items-center justify-center overflow-hidden rounded-full bg-zinc-900 px-8 font-medium text-zinc-300 transition-all duration-300 hover:text-white hover:ring-2 hover:ring-zinc-700 hover:ring-offset-2 hover:ring-offset-zinc-950"
    >
      <div className="absolute inset-0 -z-10 translate-y-[100%] bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100" />
      <span className="relative flex items-center gap-2">{children}</span>
    </button>
  );
};

const PrimaryButton = ({ children, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="relative inline-flex h-12 items-center justify-center overflow-hidden rounded-full bg-white px-8 font-semibold text-black transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg shadow-white/10"
    >
      <span className="relative flex items-center gap-2">{children}</span>
    </button>
  );
};

export default function App() {
  const { isSignedIn } = useAuth();
  const containerRef = useRef(null);

  // Parallax scrolling effects
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

  return (
    <div
      className={`w-full bg-[#020617] min-h-screen ${font.variable} font-sans`}
    >
      <section
        ref={containerRef}
        className="relative min-h-[900px] flex items-center justify-center py-24 overflow-hidden"
      >
        <AnimatedBackground />

        <div className="container relative z-10 px-6 mx-auto">
          <motion.div style={{ y, opacity }} className="mx-auto max-w-5xl">
            {/* Main Premium Card */}
            <SpotlightCard className="rounded-[3rem] backdrop-blur-2xl border-white/10 shadow-3xl shadow-black/80">
              <div className="relative p-8 md:p-24 overflow-hidden">
                {/* Visual accents */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-30" />

                <div className="flex flex-col items-center text-center">
                  {/* Floating Badge */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.6 }}
                    className="mb-10 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 shadow-inner backdrop-blur-md"
                  >
                    <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-blue-100">
                      AI-Powered Workflow
                    </span>
                  </motion.div>

                  {/* Hero Header */}
                  <motion.h2
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="mb-8 max-w-4xl text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight text-white leading-[1.1]"
                  >
                    Build faster with <br />
                    <span className="relative">
                      <span className="absolute -inset-2 bg-indigo-500/20 blur-2xl rounded-full" />
                      <span className="relative bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                        Intelligence
                      </span>
                    </span>
                  </motion.h2>

                  {/* Description */}
                  <motion.p
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="mb-12 max-w-2xl text-lg text-slate-400 md:text-xl leading-relaxed"
                  >
                    Transform your development cycle with our next-generation
                    toolkit. Built for speed, secured by default, and powered by
                    the world's most advanced neural architectures.
                  </motion.p>

                  {/* Actions */}
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="flex flex-col sm:flex-row items-center gap-5"
                  >
                    <Link href={isSignedIn ? "/dashboard" : "/sign-up"}>
                      <PrimaryButton>
                        {isSignedIn ? "Go to Dashboard" : "Get Started Free"}
                        <ArrowRight className="w-4 h-4" />
                      </PrimaryButton>
                    </Link>

                    <Link href="/demo">
                      <ShimmerButton>
                        <Zap className="w-4 h-4 text-indigo-400" />
                        View Live Demo
                      </ShimmerButton>
                    </Link>
                  </motion.div>

                  {/* Trust Footer */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, delay: 0.6 }}
                    className="mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center gap-6 text-sm"
                  >
                    <div className="flex -space-x-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className="h-10 w-10 rounded-full border-2 border-[#020617] bg-slate-800 flex items-center justify-center text-[10px] text-slate-300 font-bold overflow-hidden"
                        >
                          <img
                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`}
                            alt="avatar"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex text-yellow-500">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className="w-4 h-4 fill-current" />
                        ))}
                      </div>
                      <p className="text-slate-500 font-medium">
                        Trusted by{" "}
                        <span className="text-slate-200">25,000+</span>{" "}
                        engineers worldwide
                      </p>
                    </div>
                  </motion.div>
                </div>
              </div>
            </SpotlightCard>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
