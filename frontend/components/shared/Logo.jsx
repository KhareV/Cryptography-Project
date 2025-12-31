"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ size = "md", showText = true, className }) {
  const sizes = {
    sm: { icon: 20, text: "text-lg" },
    md: { icon: 28, text: "text-xl" },
    lg: { icon: 36, text: "text-2xl" },
    xl: { icon: 48, text: "text-3xl" },
  };

  return (
    <Link href="/" className={cn("flex items-center gap-2", className)}>
      <motion.div
        whileHover={{ rotate: 15, scale: 1.1 }}
        transition={{ type: "spring", stiffness: 400 }}
        className="relative"
      >
        <div className="absolute inset-0 bg-accent rounded-xl blur-lg opacity-30" />
        <div className="relative bg-gradient-to-br from-accent to-blue-600 p-2 rounded-xl">
          <MessageCircle
            size={sizes[size].icon}
            className="text-white"
            strokeWidth={2.5}
          />
        </div>
      </motion.div>

      {showText && (
        <span className={cn("font-bold text-gradient", sizes[size].text)}>
          ChatFlow
        </span>
      )}
    </Link>
  );
}

export default Logo;
