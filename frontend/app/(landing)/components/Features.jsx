"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  MessageCircle,
  Shield,
  Zap,
  Globe,
  Bell,
  Smartphone,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { Plus_Jakarta_Sans } from "next/font/google";

// Register plugins safely
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

const font = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
});

const features = [
  {
    icon: MessageCircle,
    title: "Real-Time Sync",
    description:
      "Instant delivery with optimistic UI updates. Feels faster than light.",
    gradient: "from-blue-400 to-cyan-300",
  },
  {
    icon: Shield,
    title: "End-to-End Encrypted",
    description:
      "Your data is locked with military-grade double-ratchet algorithms.",
    gradient: "from-emerald-400 to-teal-300",
  },
  {
    icon: Zap,
    title: "Instant Performance",
    description: "Built on edge networks. 0ms latency feeling globally.",
    gradient: "from-amber-400 to-orange-300",
  },
  {
    icon: Globe,
    title: "Global Mesh",
    description:
      "Automatic region routing ensures you're always on the fastest node.",
    gradient: "from-purple-400 to-pink-300",
  },
  {
    icon: Bell,
    title: "Smart Push",
    description: "AI-driven notifications that know when not to disturb you.",
    gradient: "from-rose-400 to-red-300",
  },
  {
    icon: Smartphone,
    title: "Native Feel",
    description:
      "Fluid gestures and haptics that feel right at home on any device.",
    gradient: "from-indigo-400 to-violet-300",
  },
];

/* -------------------------------------------------------------------------- */
/*                                SUB-COMPONENTS                              */
/* -------------------------------------------------------------------------- */

const FeatureCard = ({ feature, index }) => {
  const Icon = feature.icon;

  return (
    <div className="feature-card group relative h-full p-[1px] rounded-3xl overflow-hidden bg-gradient-to-b from-white/[0.08] to-transparent transition-transform duration-500 hover:scale-[1.01]">
      {/* Spotlight Effect Layer (controlled via CSS vars in parent) */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(600px circle at var(--mouse-x) var(--mouse-y), rgba(255,255,255,0.06), transparent 40%)`,
        }}
      />

      {/* Card Content */}
      <div className="relative h-full bg-[#080808] rounded-[23px] p-8 overflow-hidden z-10 border border-white/5">
        {/* Subtle Grain Overlay */}
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.05] mix-blend-overlay pointer-events-none" />

        <div className="relative z-10 flex flex-col h-full">
          <div className="flex justify-between items-start mb-8">
            {/* Icon Container */}
            <div className="relative w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center overflow-hidden group-hover:bg-white/[0.06] transition-colors duration-500">
              <Icon className="w-6 h-6 text-white relative z-10" />
              {/* Inner Glow */}
              <div
                className={`absolute inset-0 opacity-20 bg-gradient-to-br ${feature.gradient} blur-xl`}
              />
            </div>

            <ArrowUpRight className="w-5 h-5 text-white/20 group-hover:text-white group-hover:translate-x-1 group-hover:-translate-y-1 transition-all duration-300" />
          </div>

          <h3 className="text-xl font-medium text-white mb-3 tracking-tight">
            {feature.title}
          </h3>

          <p className="text-slate-400 text-sm leading-relaxed max-w-[90%]">
            {feature.description}
          </p>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                                MAIN COMPONENT                              */
/* -------------------------------------------------------------------------- */

export default function FeaturesGrid() {
  const containerRef = useRef(null);
  const gridRef = useRef(null);

  useGSAP(
    () => {
      // 1. Setup Initial States for Reveals
      gsap.set(".feature-header-reveal", { yPercent: 120, opacity: 0 }); // Start hidden below
      gsap.set(".feature-card", { y: 50, opacity: 0 });

      // 2. Text Reveal Sequence
      ScrollTrigger.batch(".feature-header-reveal", {
        start: "top 90%",
        onEnter: (elements) => {
          gsap.to(elements, {
            yPercent: 0,
            opacity: 1,
            duration: 1.2,
            ease: "power3.out",
            stagger: 0.1,
          });
        },
      });

      // 3. Grid Entry (Staggered)
      ScrollTrigger.batch(".feature-card", {
        start: "top 85%",
        onEnter: (elements) => {
          gsap.to(elements, {
            y: 0,
            opacity: 1,
            duration: 1.2,
            ease: "power3.out",
            stagger: 0.15,
          });
        },
      });

      // 4. Parallax Effect for Columns (The "Expensive" Feel)
      // We select columns by index (simulated) for desktop only
      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px)", () => {
        // Middle column moves faster (or slower) creating depth
        gsap.to(".feature-col-even", {
          y: -40, // Moves up slightly as you scroll down
          ease: "none",
          scrollTrigger: {
            trigger: gridRef.current,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.5, // Smooth scrub
          },
        });

        gsap.to(".feature-col-odd", {
          y: 20, // Moves down slightly (lag)
          ease: "none",
          scrollTrigger: {
            trigger: gridRef.current,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.5,
          },
        });
      });
    },
    { scope: containerRef }
  );

  // High-Performance Mouse Tracker
  // Updates CSS variables on the container so cards can read them without React renders
  const handleMouseMove = (e) => {
    if (!gridRef.current) return;
    const { left, top } = gridRef.current.getBoundingClientRect();
    const x = e.clientX - left;
    const y = e.clientY - top;
    gridRef.current.style.setProperty("--mouse-x", `${x}px`);
    gridRef.current.style.setProperty("--mouse-y", `${y}px`);
  };

  return (
    <section
      ref={containerRef}
      className={`relative py-32 bg-[#050505] text-slate-200 ${font.variable} font-sans overflow-hidden`}
    >
      {/* Background Ambience */}
      <div className="absolute inset-0 w-full h-full pointer-events-none">
        <div className="absolute top-[20%] left-[-10%] w-[600px] h-[600px] bg-blue-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[20%] right-[-10%] w-[500px] h-[500px] bg-purple-900/10 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
        {/* Header Section */}
        <div className="text-center max-w-3xl mx-auto mb-20 md:mb-32">
          {/* Badge */}
          <div className="flex justify-center mb-8 overflow-hidden">
            <div className="feature-header-reveal flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/5 backdrop-blur-sm">
              <Sparkles className="w-3 h-3 text-blue-400" />
              <span className="text-xs font-semibold text-blue-300 tracking-wider uppercase">
                System Architecture
              </span>
            </div>
          </div>

          {/* H2 Title */}
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-6 leading-[1.1]">
            <div className="overflow-hidden">
              <span className="block feature-header-reveal">
                Built for those who
              </span>
            </div>
            <div className="overflow-hidden">
              <span className="block feature-header-reveal text-white/50">
                demand excellence.
              </span>
            </div>
          </h2>

          {/* Description */}
          <div className="overflow-hidden">
            <p className="feature-header-reveal text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
              Every pixel polished, every interaction refined. Experience a
              platform engineered for the next generation of communication.
            </p>
          </div>
        </div>

        {/* The Grid */}
        <div
          ref={gridRef}
          onMouseMove={handleMouseMove}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 group"
        >
          {/* 
             We manually split the array to apply specific classes for the Parallax effect.
             col-span-1 allows us to control the column behavior.
          */}
          <div className="flex flex-col gap-6 lg:gap-8 feature-col-odd">
            <FeatureCard feature={features[0]} index={0} />
            <FeatureCard feature={features[1]} index={1} />
          </div>

          <div className="flex flex-col gap-6 lg:gap-8 feature-col-even lg:mt-12">
            <FeatureCard feature={features[2]} index={2} />
            <FeatureCard feature={features[3]} index={3} />
          </div>

          <div className="flex flex-col gap-6 lg:gap-8 feature-col-odd">
            <FeatureCard feature={features[4]} index={4} />
            <FeatureCard feature={features[5]} index={5} />
          </div>
        </div>
      </div>
    </section>
  );
}
