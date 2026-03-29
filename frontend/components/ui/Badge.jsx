"use client";

import { cn } from "@/lib/utils";

const badgeVariants = {
  default: "bg-accent text-white shadow-sm shadow-accent/25",
  secondary:
    "border border-border/70 bg-background-secondary text-foreground-secondary",
  success: "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30",
  warning: "bg-amber-500 text-white shadow-sm shadow-amber-500/30",
  danger: "bg-rose-500 text-white shadow-sm shadow-rose-500/30",
  outline: "border border-border/80 bg-background/60 text-foreground",
};

export function Badge({
  children,
  variant = "default",
  size = "md",
  className,
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold tracking-wide",
        size === "sm" && "px-2 py-0.5 text-[10px]",
        size === "md" && "px-2.5 py-0.5 text-xs",
        size === "lg" && "px-3 py-1 text-sm",
        badgeVariants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function NotificationBadge({ count, max = 99, className }) {
  if (!count || count <= 0) return null;

  const displayCount = count > max ? `${max}+` : count;

  return (
    <span
      className={cn(
        "absolute -top-1 -right-1",
        "min-w-[20px] h-[20px] px-1.5",
        "flex items-center justify-center",
        "rounded-full border border-background/90 bg-rose-500 text-white text-[11px] font-semibold shadow-sm shadow-rose-500/30",
        className,
      )}
    >
      {displayCount}
    </span>
  );
}

export default Badge;
