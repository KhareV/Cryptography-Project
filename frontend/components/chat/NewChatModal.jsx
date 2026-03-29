"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, UserPlus, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { SearchInput } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { useConversations } from "@/hooks/useConversations";
import { userAPI, setAuthToken } from "@/lib/api";
import { useAuth } from "@clerk/nextjs";
import { debounce } from "@/lib/utils";
import toast from "react-hot-toast";

export default function NewChatModal({ isOpen, onClose }) {
  const router = useRouter();
  const { getToken } = useAuth();
  const { createConversation } = useConversations();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Debounced search
  const performSearch = useCallback(
    debounce(async (query) => {
      if (!query.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      try {
        setIsSearching(true);
        const token = await getToken();
        setAuthToken(token);

        const response = await userAPI.searchUsers(query.trim());
        setSearchResults(response.data?.users || []);
      } catch (error) {
        console.error("Search failed:", error);
        toast.error("Failed to search users");
      } finally {
        setIsSearching(false);
      }
    }, 300),
    [getToken],
  );

  // Handle search input change
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    performSearch(query);
  };

  // Start conversation with user
  const handleStartConversation = async (user) => {
    try {
      setIsCreating(true);
      const userId = user._id || user.id;

      if (!userId) {
        toast.error("Invalid user ID");
        return;
      }

      const conversation = await createConversation([userId.toString()]);

      if (conversation) {
        onClose();
        setSearchQuery("");
        setSearchResults([]);
        router.push(`/chat/${conversation.id}`);
        toast.success(`Started conversation with ${user.username}`);
      }
    } catch (error) {
      console.error("Failed to create conversation:", error);
      toast.error("Failed to start conversation");
    } finally {
      setIsCreating(false);
    }
  };

  // Handle modal close
  const handleClose = () => {
    setSearchQuery("");
    setSearchResults([]);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="New Conversation"
      description="Search for users to start a conversation"
      size="md"
      className="bg-background"
    >
      <div className="space-y-4">
        {/* Search Input */}
        <SearchInput
          placeholder="Search by username or name..."
          value={searchQuery}
          onChange={handleSearchChange}
          onClear={() => {
            setSearchQuery("");
            setSearchResults([]);
          }}
          autoFocus
        />

        {/* Results */}
        <ScrollArea className="max-h-[320px]">
          {isSearching ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-accent animate-spin" />
            </div>
          ) : searchResults.length > 0 ? (
            <div className="space-y-2 pr-1">
              <AnimatePresence>
                {searchResults.map((user, index) => (
                  <motion.button
                    key={user.id || user._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleStartConversation(user)}
                    disabled={isCreating}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl border border-border/70 bg-background-secondary/35 hover:bg-background-secondary/65 hover:border-border transition-colors disabled:opacity-50"
                  >
                    <Avatar
                      src={user.avatar}
                      name={user.firstName || user.username}
                      size="md"
                      showStatus
                      isOnline={user.status === "online"}
                    />
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-foreground truncate">
                        {user.firstName && user.lastName
                          ? `${user.firstName} ${user.lastName}`
                          : user.username}
                      </p>
                      <p className="text-sm text-foreground-secondary">
                        @{user.username}
                      </p>
                    </div>
                    <div className="h-9 w-9 rounded-xl border border-border/70 bg-background-secondary/80 flex items-center justify-center">
                      <UserPlus className="w-4 h-4 text-foreground-secondary" />
                    </div>
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          ) : searchQuery.trim() ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Search className="w-12 h-12 text-foreground-secondary/30 mb-3" />
              <p className="text-foreground-secondary">No users found</p>
              <p className="text-sm text-foreground-secondary/70">
                Try searching with a different username
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Search className="w-12 h-12 text-foreground-secondary/30 mb-3" />
              <p className="text-foreground-secondary">Search for users</p>
              <p className="text-sm text-foreground-secondary/70">
                Enter a username or name to find people
              </p>
            </div>
          )}
        </ScrollArea>
      </div>
    </Modal>
  );
}
