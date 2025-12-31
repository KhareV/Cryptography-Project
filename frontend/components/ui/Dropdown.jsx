"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Dropdown({ trigger, children, align = "left", className }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="relative inline-block">
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute z-50 mt-2 min-w-[180px]",
              "bg-background border border-border rounded-xl",
              "shadow-large overflow-hidden",
              align === "left" && "left-0",
              align === "right" && "right-0",
              align === "center" && "left-1/2 -translate-x-1/2",
              className
            )}
            onClick={() => setIsOpen(false)}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function DropdownItem({
  children,
  icon,
  onClick,
  isActive,
  isDestructive,
  disabled,
  className,
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 text-left",
        "text-sm transition-colors",
        "hover:bg-background-secondary",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        isActive && "bg-background-secondary",
        isDestructive && "text-red-500 hover:bg-red-50 dark:hover:bg-red-950",
        className
      )}
    >
      {icon && (
        <span className="w-4 h-4 text-foreground-secondary">{icon}</span>
      )}
      <span className="flex-1">{children}</span>
      {isActive && <Check className="w-4 h-4 text-accent" />}
    </button>
  );
}

export function DropdownSeparator() {
  return <div className="h-px bg-border my-1" />;
}

export function DropdownLabel({ children, className }) {
  return (
    <div
      className={cn(
        "px-4 py-2 text-xs font-semibold text-foreground-secondary uppercase tracking-wide",
        className
      )}
    >
      {children}
    </div>
  );
}

export default Dropdown;
