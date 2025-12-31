"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useSpring,
  useTransform,
  useScroll,
  useVelocity,
  useAnimationFrame,
} from "framer-motion";
import { Quote, Star, BadgeCheck, Globe, Zap, ShieldCheck } from "lucide-react";
import { Plus_Jakarta_Sans } from "next/font/google";

// --- Fonts & Assets ---
const font = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
});

const testimonials1 = [
  {
    name: "Sarah Johnson",
    role: "Product Designer @ Stripe",
    content:
      "The latency is non-existent. It feels like the person is in the room with you. Encryption gives us peace of mind.",
    image: "https://i.pravatar.cc/150?u=sarah",
  },
  {
    name: "Michael Chen",
    role: "Senior Dev @ Vercel",
    content:
      "I've dug into the API documentation and it is flawless. Integrated this into our internal dashboard in less than an hour.",
    image: "https://i.pravatar.cc/150?u=michael",
  },
  {
    name: "Emily Rodriguez",
    role: "CTO @ Linear",
    content:
      "We switched from Slack. The code snippet rendering and dark mode implementation are simply superior.",
    image: "https://i.pravatar.cc/150?u=emily",
  },
];

const testimonials2 = [
  {
    name: "David Kim",
    role: "Founder @ Raycast",
    content:
      "Fast, reliable, and beautiful. It's the first chat app that actually feels native on every platform.",
    image: "https://i.pravatar.cc/150?u=david",
  },
  {
    name: "Lisa Wang",
    role: "Eng Lead @ Airbnb",
    content:
      "The double-ratchet encryption implementation is textbook perfect. Finally, a secure messenger that doesn't suck to use.",
    image: "https://i.pravatar.cc/150?u=lisa",
  },
  {
    name: "James Wilson",
    role: "DevOps @ Netflix",
    content:
      "Zero downtime during our last three major incidents. This tool is mission-critical for our ops team.",
    image: "https://i.pravatar.cc/150?u=james",
  },
];

const stats = [
  { label: "Uptime", value: 99.99, suffix: "%", icon: Zap },
  { label: "Messages", value: 50, suffix: "M+", icon: Globe },
  { label: "Security", value: 256, suffix: "-bit", icon: ShieldCheck },
];

// --- Components ---

// 1. Animated HUD Counter
function Counter({ value, suffix, decimals = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, {
    damping: 50,
    stiffness: 100,
  });

  useEffect(() => {
    if (inView) {
      motionValue.set(value);
    }
  }, [inView, value, motionValue]);

  const [displayValue, setDisplayValue] = useState(0);

  useAnimationFrame(() => {
    const val = springValue.get();
    setDisplayValue(val.toFixed(decimals));
  });

  return (
    <span ref={ref} className="font-mono tabular-nums">
      {displayValue}
      {suffix}
    </span>
  );
}

// 2. Infinite Scroll Column
const TestimonialColumn = ({ testimonials, duration = 20, className }) => {
  return (
    <div className={className}>
      <motion.div
        animate={{
          y: ["-50%", "0%"],
        }}
        transition={{
          duration: duration,
          ease: "linear",
          repeat: Infinity,
        }}
        className="flex flex-col gap-6 pb-6"
      >
        {[...testimonials, ...testimonials].map((t, i) => (
          <div
            key={i}
            className="group relative rounded-2xl border border-white/5 bg-zinc-900/50 p-6 backdrop-blur-sm transition-colors hover:border-white/10 hover:bg-zinc-900/80"
          >
            <div className="mb-4 flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className="h-3 w-3 fill-yellow-500 text-yellow-500"
                />
              ))}
            </div>
            <p className="mb-6 text-sm leading-relaxed text-zinc-300">
              "{t.content}"
            </p>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-zinc-800 ring-2 ring-black">
                {/* Fallback avatar if image fails or use gradient */}
                <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-[10px] font-bold text-white">
                  {t.name.charAt(0)}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-white">
                    {t.name}
                  </span>
                  <BadgeCheck className="h-3 w-3 text-blue-500" />
                </div>
                <span className="text-xs text-zinc-500">{t.role}</span>
              </div>
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
};

export default function Testimonials() {
  return (
    <section
      className={`relative bg-black py-32 overflow-hidden ${font.variable} font-sans`}
    >
      {/* Background Decor */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-0 top-0 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/20 blur-[120px]" />
        <div className="absolute right-0 bottom-0 h-[500px] w-[500px] translate-x-1/2 translate-y-1/2 rounded-full bg-indigo-600/10 blur-[120px]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
      </div>

      <div className="container mx-auto px-4 md:px-6">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.5fr] lg:gap-20">
          {/* Left Side: Sticky Header & Stats */}
          <div className="flex flex-col justify-center">
            <div className="sticky top-32 space-y-10">
              <div className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400"
                >
                  <Globe className="h-3 w-3" />
                  <span>Global Adoption</span>
                </motion.div>

                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl"
                >
                  Loved by <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
                    builders.
                  </span>
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 }}
                  className="max-w-md text-lg text-zinc-400"
                >
                  Join thousands of teams who rely on ChatFlow for
                  mission-critical communication. Secure, fast, and native.
                </motion.p>
              </div>

              {/* HUD Stats Grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {stats.map((stat, i) => {
                  const Icon = stat.icon;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.2 + i * 0.1 }}
                      className="group relative overflow-hidden rounded-2xl border border-white/5 bg-zinc-900/30 p-6 backdrop-blur-sm transition-all hover:bg-zinc-800/50"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                      <div className="relative flex flex-col gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-zinc-400 ring-1 ring-white/10 transition-colors group-hover:bg-blue-500/20 group-hover:text-blue-400">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-3xl font-bold text-white">
                            <Counter
                              value={stat.value}
                              suffix={stat.suffix}
                              decimals={stat.label === "Uptime" ? 2 : 0}
                            />
                          </div>
                          <div className="text-sm font-medium text-zinc-500">
                            {stat.label}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Side: Infinite Scroll Masonry */}
          <div className="relative h-[800px] overflow-hidden rounded-3xl border border-white/5 bg-zinc-950/50 shadow-2xl">
            {/* Fade Gradients */}
            <div className="absolute top-0 left-0 right-0 z-10 h-32 bg-gradient-to-b from-black via-black/80 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 z-10 h-32 bg-gradient-to-t from-black via-black/80 to-transparent" />

            <div className="grid h-full grid-cols-1 gap-6 p-6 md:grid-cols-2">
              <TestimonialColumn testimonials={testimonials1} duration={40} />
              <TestimonialColumn
                testimonials={testimonials2}
                duration={55}
                className="pt-20"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
