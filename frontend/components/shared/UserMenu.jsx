"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { User, Settings, LogOut, HelpCircle } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import {
  Dropdown,
  DropdownItem,
  DropdownSeparator,
  DropdownLabel,
} from "@/components/ui/Dropdown";
import { cn } from "@/lib/utils";

export function UserMenu({ className }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  if (!user) return null;

  return (
    <Dropdown
      trigger={
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            "flex items-center gap-3 p-2 rounded-xl",
            "hover:bg-background-secondary transition-colors",
            className
          )}
        >
          <Avatar
            src={user.imageUrl}
            name={user.fullName || user.username}
            size="md"
            showStatus
            isOnline
          />
          <div className="text-left hidden sm:block">
            <p className="text-sm font-medium text-foreground">
              {user.fullName || user.username}
            </p>
            <p className="text-xs text-foreground-secondary">
              {user.primaryEmailAddress?.emailAddress}
            </p>
          </div>
        </motion.button>
      }
      align="right"
    >
      <DropdownLabel>Account</DropdownLabel>

      <DropdownItem
        icon={<User className="w-4 h-4" />}
        onClick={() => router.push("/chat? settings=profile")}
      >
        Profile
      </DropdownItem>

      <DropdownItem
        icon={<Settings className="w-4 h-4" />}
        onClick={() => router.push("/chat?settings=preferences")}
      >
        Settings
      </DropdownItem>

      <DropdownItem
        icon={<HelpCircle className="w-4 h-4" />}
        onClick={() => window.open("/help", "_blank")}
      >
        Help & Support
      </DropdownItem>

      <DropdownSeparator />

      <DropdownItem
        icon={<LogOut className="w-4 h-4" />}
        onClick={handleSignOut}
        isDestructive
      >
        Sign Out
      </DropdownItem>
    </Dropdown>
  );
}

export default UserMenu;
