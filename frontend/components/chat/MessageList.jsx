"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, MessageSquare, Sparkles } from "lucide-react";
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
    [hasMore, isLoading, onLoadMore],
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
            <span className="px-3 py-1 text-[11px] font-medium text-foreground-secondary bg-background/85 border border-border/70 rounded-full shadow-sm backdrop-blur">
              {formatDateSeparator(message.createdAt)}
            </span>
          </div>,
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
        />,
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
    <div className="flex-1 relative overflow-hidden chat-surface">
      <ScrollArea
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full px-4 py-3"
      >
        {/* Load More Indicator */}
        {isLoading && hasMore && (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && messages.length === 0 && (
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
                CHAT
              </span>

              <div className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-background/85 shadow-sm">
                <MessageSquare className="h-6 w-6 text-accent" />
              </div>

              <h3 className="relative text-lg font-semibold text-foreground">
                Start your conversation
              </h3>
              <p className="relative mt-2 text-sm leading-relaxed text-foreground-secondary">
                Say hello, share an update, or ask anything to break the ice.
              </p>

              <div className="relative mt-5 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs text-foreground-secondary">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                End-to-end encrypted chat
              </div>
            </motion.div>
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
              className="rounded-full shadow-lg border border-border/70 bg-background/90"
            >
              <ChevronDown className="w-5 h-5" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
