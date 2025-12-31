"use client";

import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";

export function ThemeToggle({ className }) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const ThemeIcon = resolvedTheme === "dark" ? Moon : Sun;

  return (
    <Dropdown
      trigger={
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            "p-2 rounded-xl",
            "text-foreground-secondary hover: text-foreground",
            "hover:bg-background-secondary",
            "transition-colors",
            className
          )}
        >
          <ThemeIcon className="w-5 h-5" />
        </motion.button>
      }
      align="right"
    >
      <DropdownItem
        icon={<Sun className="w-4 h-4" />}
        onClick={() => setTheme("light")}
        isActive={theme === "light"}
      >
        Light
      </DropdownItem>
      <DropdownItem
        icon={<Moon className="w-4 h-4" />}
        onClick={() => setTheme("dark")}
        isActive={theme === "dark"}
      >
        Dark
      </DropdownItem>
      <DropdownItem
        icon={<Monitor className="w-4 h-4" />}
        onClick={() => setTheme("system")}
        isActive={theme === "system"}
      >
        System
      </DropdownItem>
    </Dropdown>
  );
}

export default ThemeToggle;
