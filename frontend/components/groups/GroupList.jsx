"use client";

import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Users } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { formatConversationTime, truncate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function GroupList({
  groups,
  activeGroupId,
  unreadMap,
  isLoading,
}) {
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-16 rounded-xl bg-background-secondary animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!groups.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6">
        <div className="w-14 h-14 rounded-full bg-background-secondary flex items-center justify-center mb-3">
          <Users className="w-7 h-7 text-foreground-secondary" />
        </div>
        <p className="font-medium text-foreground">No groups yet</p>
        <p className="text-sm text-foreground-secondary mt-1">
          Create your first group to start chatting together.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-2">
        <AnimatePresence initial={false}>
          {groups.map((group, index) => {
            const unread = unreadMap?.[group.id] || 0;
            const isActive = activeGroupId === group.id;

            return (
              <motion.button
                key={group.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15, delay: index * 0.03 }}
                onClick={() => router.push(`/groups/${group.id}`)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all mb-2 border",
                  isActive
                    ? "bg-primary/10 border-primary/25 shadow-sm"
                    : "hover:bg-background-secondary/70 border-border/70 bg-background",
                )}
              >
                <Avatar src={group.avatar} name={group.name} size="md" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {group.name}
                      </p>
                      {Number(group.joinFeeEth || 0) > 0 && (
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            group.onChainRegistered
                              ? "bg-emerald-500/15 text-emerald-500"
                              : "bg-amber-500/15 text-amber-500"
                          }`}
                        >
                          {group.onChainRegistered
                            ? `${Number(group.joinFeeEth).toFixed(3)} ETH`
                            : "On-chain pending"}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-foreground-secondary shrink-0">
                      {group.lastMessage?.timestamp
                        ? formatConversationTime(group.lastMessage.timestamp)
                        : ""}
                    </span>
                  </div>
                  <p className="text-sm text-foreground-secondary truncate">
                    {group.lastMessage?.content
                      ? truncate(group.lastMessage.content, 36)
                      : `${group.memberCount || 0} members`}
                  </p>
                </div>

                {unread > 0 && (
                  <span className="min-w-5 h-5 px-1 rounded-full bg-accent text-white text-xs flex items-center justify-center">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </ScrollArea>
  );
}
