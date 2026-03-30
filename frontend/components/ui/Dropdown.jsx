"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Dropdown({
  trigger,
  children,
  align = "left",
  className,
  fullWidth = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    openUpward: false,
  });
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const updatePosition = () => {
    const triggerElement = triggerRef.current;
    const menuElement = menuRef.current;
    if (!triggerElement || !menuElement) return;

    const triggerRect = triggerElement.getBoundingClientRect();
    const menuRect = menuElement.getBoundingClientRect();
    const margin = 8;

    let left = triggerRect.left;
    if (align === "right") {
      left = triggerRect.right - menuRect.width;
    } else if (align === "center") {
      left = triggerRect.left + triggerRect.width / 2 - menuRect.width / 2;
    }

    left = Math.max(
      margin,
      Math.min(left, window.innerWidth - menuRect.width - margin),
    );

    const openDownTop = triggerRect.bottom + margin;
    const openUpTop = triggerRect.top - menuRect.height - margin;
    const canOpenDown =
      openDownTop + menuRect.height <= window.innerHeight - margin;
    const canOpenUp = openUpTop >= margin;
    const openUpward = !canOpenDown && canOpenUp;

    setPosition({
      top: openUpward ? openUpTop : openDownTop,
      left,
      openUpward,
    });
  };

  useLayoutEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleReposition = () => updatePosition();
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [isOpen, align]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const target = event.target;
      const clickedTrigger = dropdownRef.current?.contains(target);
      const clickedMenu = menuRef.current?.contains(target);

      if (!clickedTrigger && !clickedMenu) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div
      ref={dropdownRef}
      className={cn(
        "relative max-w-full",
        fullWidth ? "flex w-full" : "inline-flex",
      )}
    >
      <div
        ref={triggerRef}
        className={cn(fullWidth && "w-full")}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {trigger}
      </div>

      {isMounted &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, y: position.openUpward ? 8 : -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: position.openUpward ? 8 : -8 }}
                transition={{ duration: 0.15 }}
                style={{ top: position.top, left: position.left }}
                className={cn(
                  "fixed z-[120] min-w-[210px] max-w-[calc(100vw-1rem)]",
                  "bg-[#0b1020]/95 text-zinc-100 backdrop-blur-xl border border-white/20 rounded-2xl",
                  "shadow-2xl shadow-black/35 overflow-hidden",
                  className,
                )}
                onClick={() => setIsOpen(false)}
              >
                {children}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
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
        "w-full flex items-center gap-3 px-4 py-2.5 text-left rounded-none",
        "text-sm text-zinc-100 transition-colors",
        "hover:bg-white/10",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        isActive && "bg-white/10",
        isDestructive && "text-red-400 hover:bg-red-500/15 hover:text-red-300",
        className,
      )}
    >
      {icon && (
        <span
          className={cn(
            "w-4 h-4 text-zinc-400",
            isDestructive && "text-red-400",
          )}
        >
          {icon}
        </span>
      )}
      <span className="flex-1">{children}</span>
      {isActive && <Check className="w-4 h-4 text-accent" />}
    </button>
  );
}

export function DropdownSeparator() {
  return <div className="my-1 h-px bg-white/15" />;
}

export function DropdownLabel({ children, className }) {
  return (
    <div
      className={cn(
        "px-4 py-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide",
        className,
      )}
    >
      {children}
    </div>
  );
}

export default Dropdown;
