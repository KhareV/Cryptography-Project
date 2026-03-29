"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, Play, Zap, CheckCircle2 } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { Logo } from "@/components/shared/Logo";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import WalletConnectButton from "@/components/blockchain/WalletConnectButton";
import { Plus_Jakarta_Sans } from "next/font/google";

// Register GSAP plugins
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

const font = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
});

/* -------------------------------------------------------------------------- */
/*                                UTILITY COMPONENTS                          */
/* -------------------------------------------------------------------------- */

// 1. Magnetic Button Wrapper (Physics-based cursor attraction)
const Magnetic = ({ children }) => {
  const ref = useRef(null);

  useGSAP(() => {
    const el = ref.current;
    if (!el) return;

    const xTo = gsap.quickTo(el, "x", {
      duration: 1,
      ease: "elastic.out(1, 0.3)",
    });
    const yTo = gsap.quickTo(el, "y", {
      duration: 1,
      ease: "elastic.out(1, 0.3)",
    });

    const handleMouseMove = (e) => {
      const { clientX, clientY } = e;
      const { left, top, width, height } = el.getBoundingClientRect();
      const x = clientX - (left + width / 2);
      const y = clientY - (top + height / 2);
      xTo(x * 0.35);
      yTo(y * 0.35);
    };

    const handleMouseLeave = () => {
      xTo(0);
      yTo(0);
    };

    el.addEventListener("mousemove", handleMouseMove);
    el.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      el.removeEventListener("mousemove", handleMouseMove);
      el.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return <div ref={ref}>{children}</div>;
};

// 2. Cinematic Shimmer Button (Refined)
const ShimmerButton = ({ children, className, ...props }) => {
  return (
    <button
      className={`group relative inline-flex h-12 overflow-hidden rounded-full p-[1px] focus:outline-none ${className}`}
      {...props}
    >
      <span className="absolute inset-[-1000%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)] opacity-70" />
      <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-[#0A0A0A] px-8 py-1 text-sm font-medium text-white backdrop-blur-3xl transition-all group-hover:bg-[#111]">
        {children}
      </span>
    </button>
  );
};

/* -------------------------------------------------------------------------- */
/*                            MAIN HERO COMPONENT                             */
/* -------------------------------------------------------------------------- */

export default function Hero() {
  const { isSignedIn } = useAuth();
  const containerRef = useRef(null);
  const heroRef = useRef(null);
  const mockupRef = useRef(null);

  // 1. The Master Sequence
  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      // Initial State Setup (Prevent FOUC)
      gsap.set(".hero-mask-reveal", { yPercent: 100 });
      gsap.set(".hero-fade-in", { opacity: 0, y: 20 });
      gsap.set(mockupRef.current, { rotationX: 20, y: 100, opacity: 0 });

      // Sequence
      tl.to(".hero-mask-reveal", {
        yPercent: 0,
        duration: 1.2,
        stagger: 0.1,
        ease: "power4.out", // "Expensive" easing
      })
        .to(
          ".hero-fade-in",
          {
            opacity: 1,
            y: 0,
            duration: 1,
            stagger: 0.1,
          },
          "-=0.8",
        )
        .to(
          mockupRef.current,
          {
            y: 0,
            opacity: 1,
            rotationX: 0,
            duration: 1.5,
            ease: "expo.out",
          },
          "-=0.8",
        );

      // Parallax on Scroll
      gsap.to(heroRef.current, {
        yPercent: 30,
        ease: "none",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });
    },
    { scope: containerRef },
  );

  return (
    <section
      ref={containerRef}
      className={`relative min-h-screen flex flex-col overflow-hidden bg-[#050505] text-slate-200 ${font.variable} font-sans selection:bg-indigo-500/30`}
    >
      {/* 2. Atmospheric Background (Alive) */}
      <div className="fixed inset-0 w-full h-full pointer-events-none z-0">
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.04] mix-blend-overlay" />
        <div className="absolute top-[-20%] left-[20%] w-[60vw] h-[60vw] bg-indigo-900/20 rounded-full blur-[120px] mix-blend-screen animate-pulse duration-[4s]" />
        <div className="absolute bottom-[-20%] right-[10%] w-[50vw] h-[50vw] bg-purple-900/10 rounded-full blur-[100px] mix-blend-screen" />
        {/* Subtle Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      {/* 3. Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/[0.06] bg-[#050505]/70 backdrop-blur-xl supports-[backdrop-filter]:bg-[#050505]/60">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <Logo size="md" />
          <div className="flex items-center gap-6">
            <WalletConnectButton className="hidden md:inline-flex" />
            <ThemeToggle />
            <div className="hidden md:flex items-center gap-4">
              {!isSignedIn && (
                <Link
                  href="/sign-in"
                  className="text-sm font-medium text-slate-400 hover:text-white transition-colors duration-300"
                >
                  Log in
                </Link>
              )}
              <Magnetic>
                <Link href={isSignedIn ? "/chat" : "/sign-up"}>
                  <button className="bg-slate-50 text-black px-6 py-2 rounded-full text-sm font-semibold hover:bg-white transition-colors">
                    {isSignedIn ? "Dashboard" : "Get Started"}
                  </button>
                </Link>
              </Magnetic>
            </div>
          </div>
        </div>
      </nav>

      {/* 4. Main Content Layer */}
      <div
        ref={heroRef}
        className="relative z-10 flex flex-col items-center justify-center pt-36 pb-20 px-4"
      >
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="hero-fade-in mb-8 flex justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm shadow-[0_0_20px_-10px_rgba(255,255,255,0.2)]">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              <span className="text-xs font-medium tracking-wide text-slate-300">
                v2.0 IS LIVE
              </span>
            </div>
          </div>

          {/* H1 - Masked Reveal for "Expensive" Feel */}
          <h1 className="text-5xl sm:text-7xl md:text-8xl font-bold tracking-tight text-white mb-8 leading-[1.1]">
            <div className="overflow-hidden">
              <span className="block hero-mask-reveal">Connect with</span>
            </div>
            <div className="overflow-hidden">
              <span className="block hero-mask-reveal bg-clip-text text-transparent bg-gradient-to-b from-blue-300 via-indigo-300 to-purple-400">
                everyone, instantly.
              </span>
            </div>
          </h1>

          {/* Paragraph */}
          <div className="overflow-hidden max-w-2xl mx-auto">
            <p className="hero-mask-reveal text-lg sm:text-xl text-slate-400 leading-relaxed font-light">
              Seamless real-time messaging. Encrypted, lightning-fast, and
              designed for the modern web. Experience the future of
              communication.
            </p>
          </div>

          {/* CTA Area */}
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6 hero-fade-in">
            <Magnetic>
              <Link href={isSignedIn ? "/chat" : "/sign-up"}>
                <ShimmerButton>
                  {isSignedIn ? "Launch App" : "Start for Free"}
                  <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                </ShimmerButton>
              </Link>
            </Magnetic>

            <Magnetic>
              <button className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors group px-4 py-2">
                <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 group-hover:scale-110 transition-all duration-500 ease-out">
                  <Play className="w-3 h-3 fill-current ml-0.5" />
                </div>
                <span className="font-medium text-sm tracking-wide">
                  Watch the film
                </span>
              </button>
            </Magnetic>
          </div>

          {/* 5. 3D Mockup - Rebuilt for Performance */}
          <div className="mt-20 perspective-[2000px]">
            <div
              ref={mockupRef}
              className="origin-center will-change-transform"
            >
              <RefinedChatMockup />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                            SUB-COMPONENT: MOCKUP                           */
/* -------------------------------------------------------------------------- */

const RefinedChatMockup = () => {
  const cardRef = useRef(null);

  // High-performance mouse follow using GSAP QuickTo
  useGSAP(() => {
    const el = cardRef.current;
    if (!el) return;

    // Setup rotation tweens
    const rotX = gsap.quickTo(el, "rotationX", {
      duration: 0.5,
      ease: "power2.out",
    });
    const rotY = gsap.quickTo(el, "rotationY", {
      duration: 0.5,
      ease: "power2.out",
    });

    const handleMouseMove = (e) => {
      const { clientX, clientY } = e;
      const { left, top, width, height } = el.getBoundingClientRect();
      const x = (clientX - (left + width / 2)) / width; // -0.5 to 0.5
      const y = (clientY - (top + height / 2)) / height; // -0.5 to 0.5

      rotY(x * 10); // Tilt intensity
      rotX(y * -10);
    };

    const handleMouseLeave = () => {
      rotX(0);
      rotY(0);
    };

    // Attach to window or a container for broader range
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div
      ref={cardRef}
      className="relative w-full max-w-[600px] mx-auto bg-[#0A0A0A] border border-white/[0.08] rounded-2xl p-1 shadow-[0_0_50px_-10px_rgba(0,0,0,0.5)] transform-style-3d"
    >
      {/* Glossy Overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.05] to-transparent rounded-2xl pointer-events-none z-50" />

      {/* Inner Content */}
      <div className="bg-[#050505] rounded-xl overflow-hidden border border-white/[0.05]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05] bg-white/[0.01]">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
          </div>
          <div className="text-[10px] tracking-widest text-slate-600 font-mono uppercase">
            End-to-End Encrypted
          </div>
        </div>

        {/* Chat Area */}
        <div className="p-6 space-y-6 min-h-[300px] font-sans relative">
          {/* Background Grid inside chat */}
          <div className="absolute inset-0 opacity-[0.03] bg-[size:20px_20px] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)]" />

          <MessageBubble align="left" delay={0.1}>
            Is the encryption really zero-knowledge?
          </MessageBubble>
          <MessageBubble align="right" delay={0.6} active>
            Absolutely. 256-bit AES. We can't even read it.
          </MessageBubble>
          <MessageBubble align="left" delay={1.4}>
            Sold. Deploying to production now.
          </MessageBubble>
        </div>
      </div>

      {/* Floating Elements (Parallaxed via CSS or simpler GSAP) */}
      <div className="absolute -right-8 -top-8 p-3 bg-[#111] rounded-xl border border-white/10 shadow-2xl hidden md:block animate-float-slow">
        <Zap className="w-5 h-5 text-amber-400" fill="currentColor" />
      </div>
      <div className="absolute -left-6 -bottom-6 p-3 bg-[#111] rounded-xl border border-white/10 shadow-2xl hidden md:block animate-float-slower">
        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
      </div>
    </div>
  );
};

const MessageBubble = ({ align, children, active, delay }) => {
  // Simple GSAP pop-in
  const ref = useRef(null);
  useGSAP(() => {
    gsap.fromTo(
      ref.current,
      { scale: 0.8, opacity: 0, y: 10 },
      {
        scale: 1,
        opacity: 1,
        y: 0,
        duration: 0.6,
        delay: 2 + delay,
        ease: "back.out(1.7)",
      },
    );
  }, []);

  return (
    <div
      ref={ref}
      className={`flex ${align === "right" ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`
        max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed border
        ${
          align === "right"
            ? "bg-blue-600/10 border-blue-500/20 text-blue-100 rounded-tr-sm"
            : "bg-white/5 border-white/5 text-slate-300 rounded-tl-sm"
        }
      `}
      >
        {children}
      </div>
    </div>
  );
};
