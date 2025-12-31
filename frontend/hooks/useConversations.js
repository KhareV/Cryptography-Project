"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useStore } from "@/store/useStore";
import { conversationAPI } from "@/lib/api";
import { setAuthToken } from "@/lib/api";
import toast from "react-hot-toast";

export function useConversations() {
  const { getToken } = useAuth();
  const {
    conversations,
    setConversations,
    addConversation,
    updateConversation,
    removeConversation,
    activeConversationId,
    setActiveConversation,
  } = useStore();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasFetched, setHasFetched] = useState(false);

  // Fetch all conversations
  const fetchConversations = useCallback(
    async (force = false) => {
      // Skip if already fetched and not forcing
      if (hasFetched && !force) return;

      try {
        setIsLoading(true);
        setError(null);

        const token = await getToken();
        setAuthToken(token);

        const response = await conversationAPI.getAll();
        setConversations(response.data || []);
        setHasFetched(true);
      } catch (err) {
        setError(err.message);
        toast.error("Failed to load conversations");
      } finally {
        setIsLoading(false);
      }
    },
    [getToken, setConversations, hasFetched]
  );

  // Create new conversation
  const createConversation = useCallback(
    async (participantIds, type = "direct", groupName = null) => {
      try {
        const token = await getToken();
        setAuthToken(token);

        const response = await conversationAPI.create(
          participantIds,
          type,
          groupName
        );
        const conversation = response.data?.conversation;

        if (conversation) {
          addConversation(conversation);
          setActiveConversation(conversation.id);
          return conversation;
        }
      } catch (err) {
        toast.error(err.message || "Failed to create conversation");
        throw err;
      }
    },
    [getToken, addConversation, setActiveConversation]
  );

  // Mark conversation as read
  const markAsRead = useCallback(
    async (conversationId) => {
      try {
        const token = await getToken();
        setAuthToken(token);

        await conversationAPI.markAsRead(conversationId);
        updateConversation(conversationId, { unreadCount: 0 });
      } catch (err) {
        console.error("Failed to mark as read:", err);
      }
    },
    [getToken, updateConversation]
  );

  // Pin/unpin conversation
  const togglePin = useCallback(
    async (conversationId, isPinned) => {
      try {
        const token = await getToken();
        setAuthToken(token);

        await conversationAPI.pin(conversationId, !isPinned);
        updateConversation(conversationId, { isPinned: !isPinned });
        toast.success(
          isPinned ? "Conversation unpinned" : "Conversation pinned"
        );
      } catch (err) {
        toast.error("Failed to update conversation");
      }
    },
    [getToken, updateConversation]
  );

  // Delete conversation
  const deleteConversation = useCallback(
    async (conversationId) => {
      try {
        const token = await getToken();
        setAuthToken(token);

        await conversationAPI.delete(conversationId);
        removeConversation(conversationId);
        toast.success("Conversation deleted");
      } catch (err) {
        toast.error("Failed to delete conversation");
      }
    },
    [getToken, removeConversation]
  );

  // Get active conversation details
  const getActiveConversation = useCallback(() => {
    return conversations.find((c) => c.id === activeConversationId);
  }, [conversations, activeConversationId]);

  // Initial fetch
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return {
    conversations,
    activeConversationId,
    activeConversation: getActiveConversation(),
    isLoading,
    error,
    fetchConversations,
    createConversation,
    markAsRead,
    togglePin,
    deleteConversation,
    setActiveConversation,
  };
}

export default useConversations;
