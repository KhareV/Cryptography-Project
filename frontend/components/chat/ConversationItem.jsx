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
  const { activeConversationId, setActiveConversation } = useStore();

  const isActive = activeConversationId === conversation.id;
  const otherUser = conversation.otherParticipant;
  const lastMessage = conversation.lastMessage;

  const handleClick = () => {
    setActiveConversation(conversation.id);
    router.push(`/chat/${conversation.id}`);
  };

  const displayName = otherUser
    ? `${otherUser.firstName || ""} ${otherUser.lastName || ""}`.trim() ||
      otherUser.username
    : "Unknown User";

  const lastMessagePreview = lastMessage?.content
    ? truncate(lastMessage.content, 40)
    : "No messages yet";

  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={handleClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left",
        "hover:bg-background-secondary",
        isActive && "bg-background-secondary"
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
          <h3
            className={cn(
              "font-semibold truncate",
              conversation.unreadCount > 0
                ? "text-foreground"
                : "text-foreground"
            )}
          >
            {displayName}
          </h3>
          <span className="text-xs text-foreground-secondary flex-shrink-0 ml-2">
            {lastMessage?.timestamp &&
              formatConversationTime(lastMessage.timestamp)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <p
            className={cn(
              "text-sm truncate",
              conversation.unreadCount > 0
                ? "text-foreground font-medium"
                : "text-foreground-secondary"
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
