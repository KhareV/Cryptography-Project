"use client";

import { motion } from "framer-motion";
import { X, Bell, BellOff, Trash2, Ban, Image, File, Link } from "lucide-react";
import { useStore } from "@/store/useStore";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { formatRelativeTime } from "@/lib/utils";

export default function RightPanel({ conversation }) {
  const { setRightPanelOpen } = useStore();

  const otherUser = conversation?.otherParticipant;

  const displayName = otherUser
    ? `${otherUser.firstName || ""} ${otherUser.lastName || ""}`.trim() ||
      otherUser.username
    : "Unknown User";

  return (
    <motion.aside
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="w-80 h-screen flex flex-col border-l border-border bg-background"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="font-semibold text-foreground">Contact Info</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setRightPanelOpen(false)}
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {/* Profile Section */}
        <div className="p-6 text-center border-b border-border">
          <Avatar
            src={otherUser?.avatar}
            name={displayName}
            size="2xl"
            showStatus
            isOnline={otherUser?.isOnline}
            className="mx-auto mb-4"
          />
          <h3 className="text-xl font-semibold text-foreground mb-1">
            {displayName}
          </h3>
          <p className="text-sm text-foreground-secondary mb-2">
            @{otherUser?.username}
          </p>
          <p className="text-sm text-foreground-secondary">
            {otherUser?.isOnline
              ? "Online"
              : otherUser?.lastSeen
              ? `Last seen ${formatRelativeTime(otherUser.lastSeen)}`
              : "Offline"}
          </p>

          {otherUser?.bio && (
            <p className="mt-4 text-sm text-foreground-secondary">
              {otherUser.bio}
            </p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="p-4 space-y-2 border-b border-border">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-background-secondary transition-colors text-left">
            <div className="w-10 h-10 rounded-full bg-background-tertiary flex items-center justify-center">
              <Bell className="w-5 h-5 text-foreground-secondary" />
            </div>
            <div>
              <p className="font-medium text-foreground">Notifications</p>
              <p className="text-sm text-foreground-secondary">Enabled</p>
            </div>
          </button>

          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover: bg-background-secondary transition-colors text-left">
            <div className="w-10 h-10 rounded-full bg-background-tertiary flex items-center justify-center">
              <Image className="w-5 h-5 text-foreground-secondary" />
            </div>
            <div>
              <p className="font-medium text-foreground">Media</p>
              <p className="text-sm text-foreground-secondary">
                Photos & Videos
              </p>
            </div>
          </button>

          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover: bg-background-secondary transition-colors text-left">
            <div className="w-10 h-10 rounded-full bg-background-tertiary flex items-center justify-center">
              <File className="w-5 h-5 text-foreground-secondary" />
            </div>
            <div>
              <p className="font-medium text-foreground">Files</p>
              <p className="text-sm text-foreground-secondary">Shared files</p>
            </div>
          </button>

          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover: bg-background-secondary transition-colors text-left">
            <div className="w-10 h-10 rounded-full bg-background-tertiary flex items-center justify-center">
              <Link className="w-5 h-5 text-foreground-secondary" />
            </div>
            <div>
              <p className="font-medium text-foreground">Links</p>
              <p className="text-sm text-foreground-secondary">Shared links</p>
            </div>
          </button>
        </div>

        {/* Danger Zone */}
        <div className="p-4 space-y-2">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover: bg-red-50 dark:hover:bg-red-950 transition-colors text-left group">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Ban className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="font-medium text-red-500">Block User</p>
              <p className="text-sm text-foreground-secondary">
                Stop receiving messages
              </p>
            </div>
          </button>

          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover: bg-red-50 dark:hover: bg-red-950 transition-colors text-left group">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="font-medium text-red-500">Delete Conversation</p>
              <p className="text-sm text-foreground-secondary">
                Remove all messages
              </p>
            </div>
          </button>
        </div>
      </ScrollArea>
    </motion.aside>
  );
}
