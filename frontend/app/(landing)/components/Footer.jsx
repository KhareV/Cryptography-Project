"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
  useMotionTemplate,
  useMotionValue,
} from "framer-motion";
import {
  Github,
  Twitter,
  Linkedin,
  Send,
  Check,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Plus_Jakarta_Sans } from "next/font/google";

// --- Font & Assets ---
const font = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
});

// --- Data ---
const footerLinks = {
  Product: [
    { label: "Features", href: "#" },
    { label: "Integrations", href: "#" },
    { label: "Enterprise", href: "#" },
    { label: "Changelog", href: "#" },
  ],
  Company: [
    { label: "About Us", href: "#" },
    { label: "Careers", href: "#" },
    { label: "Blog", href: "#" },
    { label: "Contact", href: "#" },
  ],
  Resources: [
    { label: "Community", href: "#" },
    { label: "Help Center", href: "#" },
    { label: "API Docs", href: "#" },
    { label: "Status", href: "#" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "#" },
    { label: "Security", href: "#" },
  ],
};

const socialLinks = [
  { icon: Twitter, href: "#", label: "Twitter" },
  { icon: Github, href: "#", label: "GitHub" },
  { icon: Linkedin, href: "#", label: "LinkedIn" },
];

// --- Components ---

// 1. Magnetic Social Button with Liquid Fill
const SocialButton = ({ icon: Icon, href }) => {
  return (
    <a
      href={href}
      className="group relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5 transition-all duration-300 hover:border-white/20"
    >
      <div className="absolute inset-0 translate-y-[100%] bg-white transition-transform duration-300 group-hover:translate-y-0" />
      <Icon className="relative z-10 h-5 w-5 text-zinc-400 transition-colors duration-300 group-hover:text-black" />
    </a>
  );
};

// 2. Animated Footer Link
const FooterLink = ({ href, label }) => {
  return (
    <Link href={href} className="group flex items-center gap-2 py-1">
      <span className="relative overflow-hidden text-zinc-500 transition-colors duration-300 group-hover:text-white">
        <span className="inline-block transition-transform duration-300 group-hover:-translate-y-full">
          {label}
        </span>
        <span className="absolute left-0 top-0 inline-block translate-y-full transition-transform duration-300 group-hover:translate-y-0">
          {label}
        </span>
      </span>
    </Link>
  );
};

// 3. Status Indicator
const StatusBadge = () => (
  <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1">
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
    </span>
    <span className="text-xs font-medium text-emerald-400">
      All systems normal
    </span>
  </div>
);

// 4. Newsletter Component
const Newsletter = () => {
  const [status, setStatus] = useState("idle"); // idle, loading, success

  const handleSubmit = (e) => {
    e.preventDefault();
    setStatus("loading");
    setTimeout(() => setStatus("success"), 1500);
  };

  return (
    <div className="relative w-full max-w-sm">
      <AnimatePresence mode="wait">
        {status === "success" ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 rounded-lg bg-emerald-500/10 p-4 text-emerald-400"
          >
            <Check className="h-5 w-5" />
            <span className="font-medium">Welcome to the inner circle.</span>
          </motion.div>
        ) : (
          <motion.form
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onSubmit={handleSubmit}
            className="relative"
          >
            <input
              type="email"
              placeholder="Enter your email"
              disabled={status === "loading"}
              required
              className="peer w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 pr-12 text-sm text-white placeholder-zinc-500 backdrop-blur-sm transition-all focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/10 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              {status === "loading" ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
            </button>
          </motion.form>
        )}
      </AnimatePresence>
      <p className="mt-3 text-xs text-zinc-500">
        Join 10,000+ developers. Unsubscribe anytime.
      </p>
    </div>
  );
};

export default function Footer() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  // Parallax effect for the big text
  const y = useTransform(scrollYProgress, [0, 1], [-100, 100]);

  // Mouse tracking for spotlight
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  return (
    <footer
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`relative overflow-hidden bg-black pt-20 ${font.variable} font-sans`}
    >
      {/* Spotlight Overlay */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-0 opacity-40 transition-opacity duration-300"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              1000px circle at ${mouseX}px ${mouseY}px,
              rgba(30, 58, 138, 0.15),
              transparent 80%
            )
          `,
        }}
      />

      {/* Grid Background Pattern */}
      <div className="absolute inset-0 z-0 opacity-20 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        {/* Top Section */}
        <div className="grid gap-12 border-b border-white/10 pb-16 lg:grid-cols-2 lg:gap-8">
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">
                ChatFlow
              </span>
            </div>
            <p className="max-w-md text-base leading-relaxed text-zinc-400">
              Pioneering the future of digital communication with double-ratchet
              encryption and zero-latency syncing. Built for speed, secure by
              design.
            </p>
            <div className="flex gap-4">
              {socialLinks.map((link, i) => (
                <SocialButton key={i} {...link} />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:items-end">
            <h3 className="text-lg font-semibold text-white">
              Stay ahead of the curve
            </h3>
            <Newsletter />
          </div>
        </div>

        {/* Links Grid - Architectural Layout */}
        <div className="grid grid-cols-2 gap-8 py-16 md:grid-cols-4 lg:gap-12">
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category} className="flex flex-col gap-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                {category}
              </h4>
              <ul className="flex flex-col gap-2">
                {links.map((link, i) => (
                  <li key={i}>
                    <FooterLink {...link} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col items-center justify-between gap-6 border-t border-white/10 py-10 md:flex-row">
          <div className="flex items-center gap-4 text-sm text-zinc-500">
            <span>© {new Date().getFullYear()} ChatFlow Inc.</span>
            <span className="hidden h-1 w-1 rounded-full bg-zinc-700 md:block" />
            <Link href="#" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="#" className="hover:text-white transition-colors">
              Terms
            </Link>
          </div>
          <StatusBadge />
        </div>
      </div>

      {/* Massive Watermark - Parallax & Clipped */}
      <div className="relative -mb-20 overflow-hidden pt-20 select-none pointer-events-none">
        <motion.div style={{ y }} className="text-center">
          <h1 className="text-[18vw] font-bold leading-[0.8] tracking-tighter text-white opacity-[0.03]">
            CHATFLOW
          </h1>
        </motion.div>

        {/* Gradient fade at very bottom to blend with page end */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black to-transparent" />
      </div>
    </footer>
  );
}
