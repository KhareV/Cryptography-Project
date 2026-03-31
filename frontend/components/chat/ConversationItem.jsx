"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useStore } from "@/store/useStore";
import { Avatar } from "@/components/ui/Avatar";
import { NotificationBadge } from "@/components/ui/Badge";
import { formatConversationTime, truncate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function ConversationItem({ conversation }) {
  const router = useRouter();
  const { activeConversationId, setActiveConversation, getMessages } =
    useStore();

  const isActive = activeConversationId === conversation.id;
  const otherUser = conversation.otherParticipant;
  const lastMessage = conversation.lastMessage;
  const localMessages = getMessages(conversation.id);
  const localLastMessage =
    localMessages.length > 0 ? localMessages[localMessages.length - 1] : null;

  const handleClick = () => {
    setActiveConversation(conversation.id);
    router.push(`/chat/${conversation.id}`);
  };

  const displayName = otherUser
    ? `${otherUser.firstName || ""} ${otherUser.lastName || ""}`.trim() ||
      otherUser.username
    : "Unknown User";

  const previewSource =
    localLastMessage?.type === "text"
      ? localLastMessage.content
      : localLastMessage
        ? `[${localLastMessage.type || "file"}]`
        : lastMessage?.content;
  const previewTimestamp =
    localLastMessage?.createdAt || lastMessage?.timestamp;

  const lastMessagePreview = previewSource
    ? truncate(previewSource, 40)
    : "No messages yet";

  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={handleClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-2xl border transition-all text-left mb-2",
        "hover:bg-background-secondary/70 hover:border-border",
        isActive
          ? "bg-primary/10 border-primary/25 shadow-sm"
          : "bg-background border-border/70",
      )}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <Avatar
          src={otherUser?.avatar}
          name={displayName}
          size="lg"
          showStatus
          isOnline={otherUser?.isOnline}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-semibold truncate text-foreground">
              {displayName}
            </h3>
            <span className="shrink-0 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold text-sky-500">
              1:1
            </span>
          </div>
          <span className="text-xs text-foreground-secondary flex-shrink-0 ml-2">
            {previewTimestamp && formatConversationTime(previewTimestamp)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <p
            className={cn(
              "text-sm truncate",
              conversation.unreadCount > 0
                ? "text-foreground font-medium"
                : "text-foreground-secondary",
            )}
          >
            {lastMessagePreview}
          </p>

          {conversation.unreadCount > 0 && (
            <NotificationBadge
              count={conversation.unreadCount}
              className="relative top-0 right-0 ml-2"
            />
          )}
        </div>
      </div>
    </motion.button>
  );
}
