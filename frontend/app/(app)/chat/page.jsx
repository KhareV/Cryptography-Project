"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/store/useStore";
import { useConversations } from "@/hooks/useConversations";
import Sidebar from "@/components/chat/Sidebar";
import EmptyState from "@/components/chat/EmptyState";
import NewChatModal from "@/components/chat/NewChatModal";

export default function ChatPage() {
  const {
    isMobileView,
    setMobileView,
    isNewChatModalOpen,
    setNewChatModalOpen,
  } = useStore();
  const { conversations, isLoading } = useConversations();

  // Handle responsive view
  useEffect(() => {
    const handleResize = () => {
      setMobileView(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setMobileView]);

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content - Empty State */}
      <main className="flex-1 hidden md:flex items-center justify-center bg-background/60 chat-surface">
        <EmptyState />
      </main>

      {/* New Chat Modal */}
      <NewChatModal
        isOpen={isNewChatModalOpen}
        onClose={() => setNewChatModalOpen(false)}
      />
    </div>
  );
}
