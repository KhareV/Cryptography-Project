"use client";

import { forwardRef } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = {
  primary:
    "bg-gradient-to-r from-sky-500 via-cyan-500 to-teal-500 text-white shadow-md shadow-cyan-500/25 hover:brightness-105 hover:shadow-lg hover:shadow-cyan-500/25",
  secondary:
    "bg-background/90 text-foreground hover:bg-background-secondary border border-border/80 shadow-sm backdrop-blur",
  ghost:
    "text-foreground hover:bg-background-secondary/80 hover:border-border/70 border border-transparent",
  danger: "bg-red-500 text-white hover:bg-red-600 shadow-sm shadow-red-500/20",
  outline: "border border-sky-500/40 text-sky-600 hover:bg-sky-500/10",
};

const buttonSizes = {
  sm: "px-3 py-1.5 text-sm rounded-xl",
  md: "px-4 py-2.5 text-sm rounded-xl",
  lg: "px-6 py-3 text-base rounded-2xl",
  xl: "px-8 py-4 text-lg rounded-2xl",
  icon: "p-2.5 rounded-xl",
};

const Button = forwardRef(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled = false,
      children,
      leftIcon,
      rightIcon,
      ...props
    },
    ref,
  ) => {
    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: disabled || isLoading ? 1 : 1.01 }}
        whileTap={{ scale: disabled || isLoading ? 1 : 0.99 }}
        className={cn(
          "relative inline-flex items-center justify-center gap-2",
          "font-semibold tracking-tight",
          "transition-all duration-200 ease-out",
          "active:translate-y-[1px]",
          "focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:ring-offset-2",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          buttonVariants[variant],
          buttonSizes[size],
          className,
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Please wait</span>
          </>
        ) : (
          <>
            {leftIcon && <span className="w-5 h-5">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="w-5 h-5">{rightIcon}</span>}
          </>
        )}
      </motion.button>
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants, buttonSizes };
export default Button;
