"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

const Input = forwardRef(
  (
    {
      className,
      type = "text",
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      showPasswordToggle = false,
      clearable = false,
      onClear,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputType = type === "password" && showPassword ? "text" : type;

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {label}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-secondary">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            type={inputType}
            className={cn(
              "w-full px-4 py-2.5 rounded-xl",
              "bg-background-secondary border border-border",
              "text-foreground placeholder: text-foreground-secondary",
              "transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent",
              "disabled:opacity-50 disabled: cursor-not-allowed",
              leftIcon && "pl-10",
              (rightIcon || showPasswordToggle || clearable) && "pr-10",
              error && "border-red-500 focus:ring-red-500 focus:border-red-500",
              className
            )}
            {...props}
          />

          {(rightIcon || showPasswordToggle || clearable) && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {clearable && props.value && (
                <button
                  type="button"
                  onClick={onClear}
                  className="p-1 text-foreground-secondary hover: text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {showPasswordToggle && type === "password" && (
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-foreground-secondary hover: text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              )}

              {rightIcon && (
                <span className="text-foreground-secondary">{rightIcon}</span>
              )}
            </div>
          )}
        </div>

        {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}

        {hint && !error && (
          <p className="mt-1.5 text-sm text-foreground-secondary">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

// Search Input variant
const SearchInput = forwardRef(({ className, ...props }, ref) => {
  return (
    <Input
      ref={ref}
      type="search"
      leftIcon={<Search className="w-4 h-4" />}
      clearable
      className={cn("bg-background-tertiary", className)}
      {...props}
    />
  );
});

SearchInput.displayName = "SearchInput";

export { Input, SearchInput };
export default Input;
