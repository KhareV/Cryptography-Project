"use client";

import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-background-secondary/80",
        "before:absolute before:inset-0 before:bg-shimmer before:bg-[length:200%_100%] before:animate-shimmer",
        className,
      )}
      {...props}
    />
  );
}

export function SkeletonText({ lines = 3, className }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-4", i === lines - 1 ? "w-4/5" : "w-full")}
        />
      ))}
    </div>
  );
}

export function SkeletonAvatar({ size = "md", className }) {
  const sizes = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
    xl: "w-16 h-16",
  };

  return <Skeleton className={cn("rounded-full", sizes[size], className)} />;
}

export function SkeletonConversationItem({ className }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-border/70 p-3",
        className,
      )}
    >
      <SkeletonAvatar size="lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <Skeleton className="h-3 w-10" />
    </div>
  );
}

export function SkeletonMessage({ isOwn = false, className }) {
  return (
    <div
      className={cn(
        "flex gap-2 mb-4",
        isOwn ? "flex-row-reverse" : "flex-row",
        className,
      )}
    >
      {!isOwn && <SkeletonAvatar size="sm" />}
      <div className={cn("space-y-2", isOwn ? "items-end" : "items-start")}>
        <Skeleton className={cn("h-10 rounded-2xl", isOwn ? "w-48" : "w-56")} />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export default Skeleton;
