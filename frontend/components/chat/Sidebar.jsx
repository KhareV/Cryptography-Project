"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Settings, Search } from "lucide-react";
import { useStore } from "@/store/useStore";
import { useConversations } from "@/hooks/useConversations";
import { Logo } from "@/components/shared/Logo";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { UserMenu } from "@/components/shared/UserMenu";
import { SearchInput } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import ConversationList from "./ConversationList";

export default function Sidebar() {
  const [searchQuery, setSearchQuery] = useState("");
  const { isSidebarOpen, setNewChatModalOpen, isMobileView } = useStore();
  const { conversations, isLoading } = useConversations();

  // Filter conversations based on search
  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;
    const otherUser = conv.otherParticipant;
    if (!otherUser) return false;

    const searchLower = searchQuery.toLowerCase();
    return (
      otherUser.username?.toLowerCase().includes(searchLower) ||
      otherUser.firstName?.toLowerCase().includes(searchLower) ||
      otherUser.lastName?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <motion.aside
      initial={{ x: -280 }}
      animate={{ x: 0 }}
      className={`
        w-full md:w-80 lg:w-120 h-screen flex flex-col
        bg-background border-r border-border
        ${isMobileView ? "absolute inset-0 z-40" : "relative"}
      `}
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <Logo size="sm" showText={false} className="md:hidden" />
          <Logo size="sm" className="hidden md:flex" />

          <div className="flex items-center gap-2">
            <UserMenu />
          </div>
        </div>

        {/* Search */}
        <SearchInput
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onClear={() => setSearchQuery("")}
        />
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-hidden">
        <ConversationList
          conversations={filteredConversations}
          isLoading={isLoading}
        />
      </div>

      {/* New Chat Button */}
      <div className="p-4 border-t border-border">
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={() => setNewChatModalOpen(true)}
          leftIcon={<Plus className="w-5 h-5" />}
        >
          New Conversation
        </Button>
      </div>
    </motion.aside>
  );
}
