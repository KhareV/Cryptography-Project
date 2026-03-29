"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function TypingIndicator({ users, showBubble = false }) {
  if (!users || users.length === 0) return null;

  const displayText =
    users.length === 1
      ? `${users[0]?.firstName || users[0]?.username} is typing...`
      : users.length === 2
        ? `${users[0]?.firstName || users[0]?.username} and ${
            users[1]?.firstName || users[1]?.username
          } are typing...`
        : `${users.length} people are typing...`;

  const dots = (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className={cn(
            "w-2 h-2 rounded-full",
            showBubble ? "bg-foreground-secondary" : "bg-accent",
          )}
          animate={{
            y: [0, -4, 0],
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );

  if (showBubble) {
    return (
      <div className="flex items-center gap-2">
        <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-background border border-border/70 shadow-sm">
          {dots}
        </div>
        <span className="text-xs text-foreground-secondary truncate max-w-[14rem]">
          {displayText}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-accent">
      {dots}
      <span>{displayText}</span>
    </div>
  );
}
