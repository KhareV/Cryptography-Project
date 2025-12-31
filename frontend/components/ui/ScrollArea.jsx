"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const ScrollArea = forwardRef(({ className, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "overflow-auto scrollbar-thin",
        "scrollbar-track-transparent scrollbar-thumb-border",
        "hover:scrollbar-thumb-foreground-secondary",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

ScrollArea.displayName = "ScrollArea";

export { ScrollArea };
export default ScrollArea;
