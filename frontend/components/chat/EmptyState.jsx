"use client";

import { motion } from "framer-motion";
import { MessageCircle, ArrowLeft } from "lucide-react";
import { useStore } from "@/store/useStore";
import { Button } from "@/components/ui/Button";

export default function EmptyState() {
  const { setNewChatModalOpen } = useStore();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center p-8 text-center"
    >
      {/* Illustration */}
      <motion.div
        animate={{
          y: [0, -10, 0],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="relative mb-8"
      >
        <div className="absolute inset-0 bg-accent/20 rounded-full blur-3xl" />
        <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-accent to-blue-600 flex items-center justify-center">
          <MessageCircle className="w-16 h-16 text-white" />
        </div>
      </motion.div>

      {/* Text */}
      <h2 className="text-2xl font-bold text-foreground mb-2">
        Welcome to ChatFlow
      </h2>
      <p className="text-foreground-secondary max-w-md mb-8">
        Select a conversation from the sidebar or start a new one to begin
        messaging. Your messages are secure and delivered instantly.
      </p>

      {/* Action */}
      <Button
        variant="primary"
        size="lg"
        onClick={() => setNewChatModalOpen(true)}
      >
        Start a New Conversation
      </Button>

      {/* Keyboard Hint */}
      <div className="mt-8 flex items-center gap-2 text-sm text-foreground-secondary">
        <kbd className="px-2 py-1 bg-background-secondary rounded text-xs font-mono">
          Ctrl
        </kbd>
        <span>+</span>
        <kbd className="px-2 py-1 bg-background-secondary rounded text-xs font-mono">
          N
        </kbd>
        <span>to start a new chat</span>
      </div>
    </motion.div>
  );
}
