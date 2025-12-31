"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  UserPlus,
  MessageSquare,
  Users,
  Sparkles,
  ArrowRight,
  Zap,
} from "lucide-react";
import { Plus_Jakarta_Sans } from "next/font/google";

// Register GSAP
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

const font = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
});

const steps = [
  {
    id: "step-01",
    number: "01",
    icon: UserPlus,
    title: "Create Identity",
    description:
      "Sync your GitHub or Google account in seconds. Secure OAuth means no new passwords.",
    accent: "text-blue-400",
    gradient: "from-blue-500/20 to-cyan-500/20",
    border: "group-hover:border-blue-500/50",
  },
  {
    id: "step-02",
    number: "02",
    icon: Users,
    title: "Build Network",
    description:
      "Our graph algorithm suggests connections based on your stack. Expand your reach instantly.",
    accent: "text-purple-400",
    gradient: "from-violet-500/20 to-purple-500/20",
    border: "group-hover:border-purple-500/50",
  },
  {
    id: "step-03",
    number: "03",
    icon: MessageSquare,
    title: "Start Flowing",
    description:
      "Experience zero-latency messaging. Create channels and share code in real-time.",
    accent: "text-emerald-400",
    gradient: "from-emerald-500/20 to-teal-500/20",
    border: "group-hover:border-emerald-500/50",
  },
];

/* -------------------------------------------------------------------------- */
/*                                SUB-COMPONENTS                              */
/* -------------------------------------------------------------------------- */

// 1. The Energy Pulse (SVG)
const EnergyBeam = () => {
  return (
    <div className="absolute top-[3.5rem] left-0 w-full hidden md:block pointer-events-none z-0">
      <svg
        className="w-full h-20 overflow-visible"
        preserveAspectRatio="none"
        viewBox="0 0 1200 20"
      >
        <defs>
          <linearGradient id="beam-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="40%" stopColor="#6366f1" /> {/* Indigo */}
            <stop offset="60%" stopColor="#a855f7" /> {/* Purple */}
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* The Track (Faint Line) */}
        <path
          d="M0 10 L1200 10"
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="1"
        />

        {/* The Energy Pulse */}
        <path
          id="energy-path"
          d="M0 10 L1200 10"
          fill="none"
          stroke="url(#beam-gradient)"
          strokeWidth="3"
          strokeLinecap="round"
          filter="url(#glow)"
          className="opacity-0"
        />
      </svg>
    </div>
  );
};

// 2. Obsidian Card
const ObsidianCard = ({ step, index }) => {
  const Icon = step.icon;
  const cardRef = useRef(null);

  // High-performance spotlight
  const handleMouseMove = (e) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    el.style.setProperty("--x", `${x}px`);
    el.style.setProperty("--y", `${y}px`);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={`process-card opacity-0 relative h-full rounded-[20px] bg-[#0A0A0A] border border-white/[0.08] p-8 overflow-hidden transition-colors duration-500 ${step.border} group`}
    >
      {/* Dynamic Spotlight */}
      <div
        className="pointer-events-none absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(600px circle at var(--x) var(--y), rgba(255,255,255,0.06), transparent 40%)`,
        }}
      />

      {/* Active State Gradient (triggered by GSAP) */}
      <div
        className={`active-glow absolute inset-0 bg-gradient-to-br ${step.gradient} opacity-0 transition-opacity duration-700`}
      />

      <div className="relative z-10 flex flex-col h-full">
        {/* Icon & Connection Point */}
        <div className="flex items-center justify-between mb-8">
          <div className="relative w-12 h-12 rounded-xl bg-white/[0.05] flex items-center justify-center border border-white/[0.05]">
            <Icon className={`w-5 h-5 ${step.accent}`} />
          </div>

          {/* Connection Dot (Where the beam hits) */}
          <div className="hidden md:block w-3 h-3 rounded-full bg-[#1a1a1a] border border-white/20 shadow-inner relative z-20">
            <div
              className={`connection-dot absolute inset-0 rounded-full ${step.accent.replace(
                "text",
                "bg"
              )} opacity-0 scale-0`}
            />
          </div>
        </div>

        {/* Text */}
        <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
        <p className="text-slate-400 text-sm leading-relaxed flex-grow">
          {step.description}
        </p>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-white/[0.05] flex items-center justify-between">
          <span className="text-[4rem] font-bold text-white/[0.03] leading-none absolute bottom-4 right-4 select-none">
            {step.number}
          </span>
          <div className="flex items-center gap-2 text-xs font-medium text-white/40 group-hover:text-white transition-colors cursor-pointer">
            Explore
            <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                                MAIN COMPONENT                              */
/* -------------------------------------------------------------------------- */

export default function HowItWorks() {
  const containerRef = useRef(null);

  useGSAP(
    () => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 70%", // Start animation when section is 30% into view
          toggleActions: "play none none reverse",
        },
      });

      // 1. Reveal Header
      tl.fromTo(
        ".header-reveal",
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, stagger: 0.1, ease: "power3.out" }
      );

      // 2. Animate the Energy Beam
      tl.fromTo(
        "#energy-path",
        { strokeDasharray: 1200, strokeDashoffset: 1200, opacity: 1 },
        { strokeDashoffset: 0, duration: 2.5, ease: "power2.inOut" },
        "-=0.4"
      );

      // 3. Chain Reaction: Activate Cards as the beam passes them
      // Timings are approximations based on beam duration (2.5s)

      // Card 1 activates early
      tl.to(
        ".process-card",
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.3,
          ease: "power3.out",
        },
        "<0.2"
      ); // Starts shortly after beam starts

      // "Turn on" the internal lights of the cards sequentially
      tl.to(
        ".active-glow",
        { opacity: 0.4, duration: 0.5, stagger: 0.3 },
        "<0.5"
      );
      tl.to(
        ".connection-dot",
        { opacity: 1, scale: 1, duration: 0.3, stagger: 0.3 },
        "<"
      );
    },
    { scope: containerRef }
  );

  return (
    <section
      ref={containerRef}
      className={`relative py-32 bg-[#050505] overflow-hidden ${font.variable} font-sans`}
    >
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-blue-900/10 to-transparent blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center mb-24 max-w-3xl mx-auto">
          <div className="header-reveal inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/20 bg-indigo-500/5 mb-6">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span className="text-xs font-medium text-indigo-200 uppercase tracking-wide">
              Streamlined Process
            </span>
          </div>

          <h2 className="header-reveal text-4xl md:text-6xl font-bold text-white tracking-tight mb-6">
            From zero to hero in <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
              less than 60 seconds.
            </span>
          </h2>

          <p className="header-reveal text-slate-400 text-lg leading-relaxed">
            We've stripped away the complexity. No config files, no confusing
            dashboards. Just pure flow.
          </p>
        </div>

        {/* The Machine */}
        <div className="relative">
          {/* Connection Lines Layer */}
          <EnergyBeam />

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
            {steps.map((step, index) => (
              <ObsidianCard key={step.id} step={step} index={index} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
