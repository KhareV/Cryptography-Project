"use client";

import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { SkeletonConversationItem } from "@/components/ui/Skeleton";
import ConversationItem from "./ConversationItem";

export default function ConversationList({ conversations, isLoading }) {
  if (isLoading) {
    return (
      <div className="p-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonConversationItem key={i} />
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-background-secondary flex items-center justify-center mb-4">
          <MessageSquare className="w-8 h-8 text-foreground-secondary" />
        </div>
        <h3 className="font-medium text-foreground mb-2">
          No conversations yet
        </h3>
        <p className="text-sm text-foreground-secondary">
          Start a new conversation to begin chatting
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-2">
        <AnimatePresence initial={false}>
          {conversations.map((conversation, index) => (
            <motion.div
              key={conversation.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
            >
              <ConversationItem conversation={conversation} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ScrollArea>
  );
}
