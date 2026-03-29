"use client";

import { useState } from "react";
import Image from "next/image";
import { cn, getInitials, getAvatarColor } from "@/lib/utils";

const avatarSizes = {
  xs: "w-6 h-6 text-xs",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-16 h-16 text-lg",
  "2xl": "w-20 h-20 text-xl",
};

export function Avatar({
  src,
  alt,
  name,
  size = "md",
  isOnline,
  showStatus = false,
  className,
}) {
  const [imageError, setImageError] = useState(false);
  const initials = getInitials(name || alt);
  const bgColor = getAvatarColor(name || alt);

  return (
    <div
      className={cn(
        "relative inline-block flex-shrink-0 rounded-full",
        avatarSizes[size],
        className,
      )}
    >
      {src && !imageError ? (
        <Image
          src={src}
          alt={alt || name || "Avatar"}
          fill
          className="rounded-full object-cover ring-1 ring-border/60 transition-transform duration-300"
          onError={() => setImageError(true)}
        />
      ) : (
        <div
          className={cn(
            "w-full h-full rounded-full flex items-center justify-center",
            "font-semibold text-white ring-1 ring-white/15 shadow-inner",
            bgColor,
          )}
        >
          {initials}
        </div>
      )}

      {showStatus && (
        <>
          {isOnline && (
            <span
              className={cn(
                "absolute bottom-0 right-0 block rounded-full bg-emerald-500/35 animate-ping",
                size === "xs" || size === "sm" ? "w-2 h-2" : "w-3 h-3",
              )}
            />
          )}
          <span
            className={cn(
              "absolute bottom-0 right-0 block rounded-full ring-2 ring-background shadow-sm",
              size === "xs" || size === "sm" ? "w-2 h-2" : "w-3 h-3",
              isOnline ? "bg-emerald-500" : "bg-gray-400",
            )}
          />
        </>
      )}
    </div>
  );
}

export function AvatarGroup({ avatars, max = 4, size = "sm" }) {
  const displayAvatars = avatars.slice(0, max);
  const remaining = avatars.length - max;

  return (
    <div className="flex -space-x-2">
      {displayAvatars.map((avatar, index) => (
        <Avatar
          key={index}
          src={avatar.src}
          name={avatar.name}
          size={size}
          className="ring-2 ring-background"
        />
      ))}

      {remaining > 0 && (
        <div
          className={cn(
            "flex items-center justify-center rounded-full",
            "bg-background-tertiary text-foreground-secondary",
            "ring-2 ring-background font-medium",
            avatarSizes[size],
          )}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}

export default Avatar;
