"use client";

import { cn } from "@/lib/utils";

const badgeVariants = {
  default: "bg-accent text-white",
  secondary: "bg-background-tertiary text-foreground-secondary",
  success: "bg-green-500 text-white",
  warning: "bg-yellow-500 text-white",
  danger: "bg-red-500 text-white",
  outline: "border border-border text-foreground",
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
        "inline-flex items-center justify-center font-medium rounded-full",
        size === "sm" && "px-1.5 py-0.5 text-xs",
        size === "md" && "px-2 py-0.5 text-xs",
        size === "lg" && "px-2. 5 py-1 text-sm",
        badgeVariants[variant],
        className
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
        "min-w-[18px] h-[18px] px-1",
        "flex items-center justify-center",
        "bg-red-500 text-white text-xs font-bold rounded-full",
        className
      )}
    >
      {displayCount}
    </span>
  );
}

export default Badge;
