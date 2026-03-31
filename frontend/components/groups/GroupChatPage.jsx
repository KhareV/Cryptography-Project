"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Info, MessageSquare, Sparkles, Users } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/Button";
import { AvatarGroup } from "@/components/ui/Avatar";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { formatDateSeparator, isDifferentDay } from "@/lib/utils";
import MessageInput from "@/components/chat/MessageInput";
import GroupMessageBubble from "./GroupMessageBubble";
import AnchorBadge from "@/components/blockchain/AnchorBadge";

export default function GroupChatPage({
  group,
  messages,
  isLoading,
  isSending,
  hasMore,
  onLoadMore,
  onSend,
  onTyping,
  onBack,
  showBackButton,
  onOpenInfo,
}) {
  const { user } = useUser();

  const avatarGroup = useMemo(
    () =>
      (group?.members || []).slice(0, 4).map((member) => ({
        src: member.avatar,
        name:
          `${member.firstName || ""} ${member.lastName || ""}`.trim() ||
          member.username,
      })),
    [group],
  );

  return (
    <div className="flex-1 min-w-0 h-full flex flex-col bg-background">
      <header className="relative z-30 px-4 py-3 border-b border-border/70 bg-background/90 backdrop-blur flex items-center gap-3">
        {showBackButton && (
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl"
            onClick={onBack}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}

        <div className="flex items-center gap-3 flex-1 min-w-0">
          {avatarGroup.length > 0 ? (
            <AvatarGroup avatars={avatarGroup} size="sm" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-background-secondary flex items-center justify-center">
              <Users className="w-5 h-5 text-foreground-secondary" />
            </div>
          )}

          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground truncate">
              {group?.name}
            </h2>
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-xs text-foreground-secondary truncate">
                {group?.memberCount || group?.members?.length || 0} members
              </p>
              {group?.id && (
                <AnchorBadge type="group" id={group.id} title={group?.name} />
              )}
            </div>
          </div>
        </div>

        <Button
          variant="secondary"
          size="icon"
          className="h-9 w-9"
          onClick={onOpenInfo}
        >
          <Info className="w-5 h-5" />
        </Button>
      </header>

      <ScrollArea
        className="flex-1 min-h-0 px-4 py-3 chat-surface"
        onScroll={(e) => {
          if (e.currentTarget.scrollTop < 100 && hasMore && !isLoading) {
            onLoadMore?.();
          }
        }}
      >
        {isLoading && messages.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-16 rounded-xl bg-background-secondary animate-pulse"
              />
            ))}
          </div>
        ) : !isLoading && messages.length === 0 ? (
          <div className="flex min-h-[55vh] items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-b from-background/95 via-background/90 to-background-secondary/60 px-8 py-10 text-center shadow-sm backdrop-blur"
            >
              <div className="pointer-events-none absolute -top-10 -right-6 h-28 w-28 rounded-full bg-accent/10 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
              <span className="pointer-events-none absolute -right-3 top-2 text-[68px] font-black tracking-tight text-foreground/[0.04]">
                GROUP
              </span>

              <div className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-background/85 shadow-sm">
                <MessageSquare className="h-6 w-6 text-accent" />
              </div>

              <h3 className="relative text-lg font-semibold text-foreground">
                Start your group conversation
              </h3>
              <p className="relative mt-2 text-sm leading-relaxed text-foreground-secondary">
                Send the first message to kick off the discussion with everyone.
              </p>

              <div className="relative mt-5 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs text-foreground-secondary">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                On-chain integrity ready
              </div>
            </motion.div>
          </div>
        ) : (
          messages.map((message, index) => {
            const prevMessage = messages[index - 1];
            const showDate =
              !prevMessage ||
              isDifferentDay(prevMessage.createdAt, message.createdAt);
            const isOwn = message.sender?.clerkId === user?.id;

            return (
              <div key={message.id}>
                {showDate && (
                  <div className="flex justify-center my-4">
                    <span className="px-3 py-1 text-[11px] rounded-full bg-background/85 border border-border/70 text-foreground-secondary shadow-sm">
                      {formatDateSeparator(message.createdAt)}
                    </span>
                  </div>
                )}
                <GroupMessageBubble message={message} isOwn={isOwn} />
              </div>
            );
          })
        )}
      </ScrollArea>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <MessageInput
          onSend={onSend}
          onTyping={onTyping}
          isSending={isSending}
          disabled={!group}
        />
      </motion.div>
    </div>
  );
}
