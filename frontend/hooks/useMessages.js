"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useStore } from "@/store/useStore";
import { messageAPI, setAuthToken } from "@/lib/api";
import {
  sendMessage as socketSendMessage,
  startTyping,
  stopTyping,
} from "@/lib/socket";
import toast from "react-hot-toast";
import { debounce } from "@/lib/utils";

export function useMessages(conversationId) {
  const { getToken } = useAuth();
  const {
    messages,
    setMessages,
    addMessage,
    updateMessage,
    removeMessage,
    prependMessages,
    getMessages,
    user,
  } = useStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const typingTimeoutRef = useRef(null);
  const lastMessageIdRef = useRef(null);
  const pollingIntervalRef = useRef(null);

  // Get messages for current conversation
  const conversationMessages = getMessages(conversationId);

  // Update last message ID when messages change
  useEffect(() => {
    if (conversationMessages && conversationMessages.length > 0) {
      lastMessageIdRef.current =
        conversationMessages[conversationMessages.length - 1].id;
    }
  }, [conversationMessages]);

  // Fetch messages
  const fetchMessages = useCallback(
    async (pageNum = 1, append = false) => {
      if (!conversationId) return;

      try {
        setIsLoading(true);

        const token = await getToken();
        setAuthToken(token);

        const response = await messageAPI.getMessages(
          conversationId,
          pageNum,
          50
        );
        const fetchedMessages = response.data || [];

        if (append) {
          prependMessages(conversationId, fetchedMessages);
        } else {
          setMessages(conversationId, fetchedMessages);
        }

        setHasMore(response.pagination?.hasNextPage || false);
        setPage(pageNum);
      } catch (err) {
        toast.error("Failed to load messages");
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId, getToken, setMessages, prependMessages]
  );

  // Load more messages (infinite scroll)
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;
    await fetchMessages(page + 1, true);
  }, [isLoading, hasMore, page, fetchMessages]);

  // Poll for new messages every 3 seconds
  const pollForNewMessages = useCallback(async () => {
    if (!conversationId) return;

    try {
      const token = await getToken();
      setAuthToken(token);

      const response = await messageAPI.getMessages(conversationId, 1, 50);
      const fetchedMessages = response.data || [];

      if (fetchedMessages.length > 0) {
        const latestMessageId = fetchedMessages[fetchedMessages.length - 1].id;

        // Check if there are new messages
        if (
          lastMessageIdRef.current &&
          latestMessageId !== lastMessageIdRef.current
        ) {
          console.log("📩 Polling detected new messages");
          setMessages(conversationId, fetchedMessages);
          lastMessageIdRef.current = latestMessageId;
        } else if (!lastMessageIdRef.current) {
          // First load
          lastMessageIdRef.current = latestMessageId;
        }
      }
    } catch (err) {
      console.error("Polling error:", err);
    }
  }, [conversationId, getToken, setMessages]);

  // Start polling when conversation changes
  useEffect(() => {
    if (!conversationId) return;

    console.log(
      "🔄 Starting message polling for conversation:",
      conversationId
    );

    // Initial fetch
    fetchMessages(1, false);

    // Start polling every 3 seconds
    pollingIntervalRef.current = setInterval(pollForNewMessages, 3000);

    return () => {
      if (pollingIntervalRef.current) {
        console.log("🛑 Stopping message polling");
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [conversationId, fetchMessages, pollForNewMessages]);

  // Send message
  const sendMessage = useCallback(
    async (content, type = "text", replyTo = null, fileUrl = null) => {
      if (!conversationId || (!content.trim() && !fileUrl)) return;

      try {
        setIsSending(true);

        // Stop typing indicator
        stopTyping(conversationId);

        // Create optimistic message
        const optimisticMessage = {
          id: `temp-${Date.now()}`,
          conversationId,
          sender: {
            clerkId: user?.id,
            username: user?.username,
            firstName: user?.firstName,
            lastName: user?.lastName,
            avatar: user?.avatar,
          },
          content: content.trim() || fileUrl,
          type,
          status: "sending",
          replyTo,
          fileUrl,
          createdAt: new Date().toISOString(),
          isOptimistic: true,
        };

        // Add optimistic message
        addMessage(conversationId, optimisticMessage);

        // Send via socket
        const response = await socketSendMessage({
          conversationId,
          content: content.trim() || fileUrl,
          type,
          replyTo,
          fileUrl,
        });

        // Replace optimistic message with real one
        if (response.message) {
          removeMessage(conversationId, optimisticMessage.id);
          addMessage(conversationId, response.message);
        }

        return response.message;
      } catch (err) {
        // Remove optimistic message on error
        toast.error("Failed to send message");
        throw err;
      } finally {
        setIsSending(false);
      }
    },
    [conversationId, user, addMessage, removeMessage]
  );

  // Handle typing
  const handleTyping = useCallback(
    debounce(() => {
      if (!conversationId) return;

      startTyping(conversationId);

      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set timeout to stop typing
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping(conversationId);
      }, 2000);
    }, 300),
    [conversationId]
  );

  // Mark message as read
  const markAsRead = useCallback(
    async (messageId) => {
      try {
        const token = await getToken();
        setAuthToken(token);

        await messageAPI.markAsRead(messageId);
        updateMessage(conversationId, messageId, { status: "read" });
      } catch (err) {
        console.error("Failed to mark message as read:", err);
      }
    },
    [conversationId, getToken, updateMessage]
  );

  // Edit message
  const editMessage = useCallback(
    async (messageId, newContent) => {
      try {
        const token = await getToken();
        setAuthToken(token);

        await messageAPI.editMessage(messageId, newContent);
        updateMessage(conversationId, messageId, {
          content: newContent,
          isEdited: true,
        });
        toast.success("Message edited");
      } catch (err) {
        toast.error("Failed to edit message");
      }
    },
    [conversationId, getToken, updateMessage]
  );

  // Delete message
  const deleteMessage = useCallback(
    async (messageId, forEveryone = false) => {
      try {
        const token = await getToken();
        setAuthToken(token);

        await messageAPI.deleteMessage(messageId, forEveryone);

        if (forEveryone) {
          removeMessage(conversationId, messageId);
        } else {
          updateMessage(conversationId, messageId, { isDeleted: true });
        }

        toast.success("Message deleted");
      } catch (err) {
        toast.error("Failed to delete message");
      }
    },
    [conversationId, getToken, removeMessage, updateMessage]
  );

  // Add reaction
  const addReaction = useCallback(
    async (messageId, emoji) => {
      try {
        const token = await getToken();
        setAuthToken(token);

        await messageAPI.addReaction(messageId, emoji);
      } catch (err) {
        toast.error("Failed to add reaction");
      }
    },
    [getToken]
  );

  return {
    messages: conversationMessages,
    isLoading,
    isSending,
    hasMore,
    fetchMessages,
    loadMore,
    sendMessage,
    handleTyping,
    markAsRead,
    editMessage,
    deleteMessage,
    addReaction,
  };
}

export default useMessages;
