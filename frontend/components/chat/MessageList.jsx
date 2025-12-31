"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useStore } from "@/store/useStore";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Button } from "@/components/ui/Button";
import { SkeletonMessage } from "@/components/ui/Skeleton";
import { formatDateSeparator, isDifferentDay } from "@/lib/utils";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

export default function MessageList({
  messages,
  isLoading,
  hasMore,
  onLoadMore,
  conversationId,
}) {
  const { user } = useUser();
  const { getTypingUsers } = useStore();
  const containerRef = useRef(null);
  const bottomRef = useRef(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);

  const typingUsers = getTypingUsers(conversationId);

  // Scroll to bottom
  const scrollToBottom = useCallback((behavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  // Auto-scroll on new messages if near bottom
  useEffect(() => {
    if (isNearBottom && messages.length > 0) {
      scrollToBottom("smooth");
    }
  }, [messages, isNearBottom, scrollToBottom]);

  // Initial scroll to bottom
  useEffect(() => {
    scrollToBottom("instant");
  }, [conversationId, scrollToBottom]);

  // Handle scroll events
  const handleScroll = useCallback(
    (e) => {
      const { scrollTop, scrollHeight, clientHeight } = e.target;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      setIsNearBottom(distanceFromBottom < 100);
      setShowScrollButton(distanceFromBottom > 300);

      // Load more when scrolled to top
      if (scrollTop < 100 && hasMore && !isLoading) {
        onLoadMore?.();
      }
    },
    [hasMore, isLoading, onLoadMore]
  );

  // Group messages by date
  const renderMessages = () => {
    const elements = [];

    messages.forEach((message, index) => {
      const prevMessage = messages[index - 1];
      const showDateSeparator =
        !prevMessage ||
        isDifferentDay(prevMessage.createdAt, message.createdAt);

      if (showDateSeparator) {
        elements.push(
          <div
            key={`date-${message.createdAt}`}
            className="flex items-center justify-center my-4"
          >
            <span className="px-3 py-1 text-xs font-medium text-foreground-secondary bg-background-secondary rounded-full">
              {formatDateSeparator(message.createdAt)}
            </span>
          </div>
        );
      }

      elements.push(
        <MessageBubble
          key={message.id}
          message={message}
          isOwn={message.sender?.clerkId === user?.id}
          showAvatar={
            !prevMessage || prevMessage.sender?.id !== message.sender?.id
          }
        />
      );
    });

    return elements;
  };

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex-1 p-4 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonMessage key={i} isOwn={i % 3 === 0} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex-1 relative overflow-hidden">
      <ScrollArea
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full px-4 py-2"
      >
        {/* Load More Indicator */}
        {isLoading && hasMore && (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Messages */}
        <AnimatePresence initial={false}>{renderMessages()}</AnimatePresence>

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex items-center gap-2 py-2"
          >
            <TypingIndicator users={typingUsers} showBubble />
          </motion.div>
        )}

        {/* Bottom Anchor */}
        <div ref={bottomRef} />
      </ScrollArea>

      {/* Scroll to Bottom Button */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute bottom-4 right-4"
          >
            <Button
              variant="secondary"
              size="icon"
              onClick={() => scrollToBottom()}
              className="rounded-full shadow-medium"
            >
              <ChevronDown className="w-5 h-5" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
