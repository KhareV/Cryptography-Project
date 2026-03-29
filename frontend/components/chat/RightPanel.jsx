"use client";

import { motion } from "framer-motion";
import {
  X,
  Bell,
  BellOff,
  Trash2,
  Ban,
  Image,
  File,
  Link,
  User,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { formatRelativeTime } from "@/lib/utils";

export default function RightPanel({ conversation }) {
  const { setRightPanelOpen } = useStore();

  const otherUser = conversation?.otherParticipant;
  const sharedLabel = conversation?.isGroup
    ? "Group Contact"
    : "Direct Contact";

  const displayName = otherUser
    ? `${otherUser.firstName || ""} ${otherUser.lastName || ""}`.trim() ||
      otherUser.username
    : "Unknown User";

  const quickActions = [
    {
      icon: Bell,
      title: "Notifications",
      subtitle: "Enabled",
      iconClass: "bg-blue-500/15 text-blue-500",
    },
    {
      icon: BellOff,
      title: "Mute Contact",
      subtitle: "Silence alerts",
      iconClass: "bg-amber-500/15 text-amber-500",
    },
    {
      icon: Image,
      title: "Media",
      subtitle: "Photos & videos",
      iconClass: "bg-violet-500/15 text-violet-500",
    },
    {
      icon: File,
      title: "Files",
      subtitle: "Shared documents",
      iconClass: "bg-cyan-500/15 text-cyan-500",
    },
    {
      icon: Link,
      title: "Links",
      subtitle: "Shared links",
      iconClass: "bg-emerald-500/15 text-emerald-500",
    },
  ];

  return (
    <motion.aside
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="w-full md:w-80 lg:w-[22rem] h-screen flex flex-col border-l border-border/70 bg-background/95 backdrop-blur"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/70 bg-gradient-to-b from-background to-background-secondary/40">
        <div>
          <h2 className="font-semibold text-foreground">Contact Info</h2>
          <p className="text-xs text-foreground-secondary">{sharedLabel}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-xl"
          onClick={() => setRightPanelOpen(false)}
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          <section className="rounded-3xl border border-border/70 bg-background/90 shadow-sm p-5 text-center">
            <Avatar
              src={otherUser?.avatar}
              name={displayName}
              size="2xl"
              showStatus
              isOnline={otherUser?.isOnline}
              className="mx-auto mb-4 ring-2 ring-background"
            />

            <h3 className="text-lg font-semibold text-foreground mb-1">
              {displayName}
            </h3>
            <p className="text-sm text-foreground-secondary mb-3">
              @{otherUser?.username || "unknown"}
            </p>

            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background-secondary/70 px-3 py-1 text-xs font-medium text-foreground-secondary">
              <User className="w-3.5 h-3.5" />
              {otherUser?.isOnline
                ? "Online now"
                : otherUser?.lastSeen
                  ? `Last seen ${formatRelativeTime(otherUser.lastSeen)}`
                  : "Offline"}
            </div>

            {otherUser?.bio && (
              <p className="mt-4 text-sm text-foreground-secondary leading-relaxed">
                {otherUser.bio}
              </p>
            )}
          </section>

          <section className="rounded-3xl border border-border/70 bg-background/90 shadow-sm p-3">
            <p className="px-2 pb-2 text-[11px] uppercase tracking-wide text-foreground-secondary font-semibold">
              Quick Actions
            </p>

            <div className="space-y-2">
              {quickActions.map((action) => (
                <button
                  key={action.title}
                  type="button"
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl border border-border/70 bg-background hover:bg-background-secondary/80 transition-colors text-left"
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${action.iconClass}`}
                  >
                    <action.icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {action.title}
                    </p>
                    <p className="text-sm text-foreground-secondary truncate">
                      {action.subtitle}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-red-300/50 dark:border-red-900/40 bg-red-50/40 dark:bg-red-950/15 p-3">
            <p className="px-2 pb-2 text-[11px] uppercase tracking-wide text-red-500 font-semibold">
              Danger Zone
            </p>

            <div className="space-y-2">
              <button
                type="button"
                className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl border border-red-200/70 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Ban className="w-5 h-5 text-red-500" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-red-500 truncate">
                    Block User
                  </p>
                  <p className="text-sm text-foreground-secondary truncate">
                    Stop receiving messages
                  </p>
                </div>
              </button>

              <button
                type="button"
                className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl border border-red-200/70 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-red-500 truncate">
                    Delete Conversation
                  </p>
                  <p className="text-sm text-foreground-secondary truncate">
                    Remove all messages
                  </p>
                </div>
              </button>
            </div>
          </section>
        </div>
      </ScrollArea>
    </motion.aside>
  );
}
