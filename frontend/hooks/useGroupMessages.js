"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useStore } from "@/store/useStore";
import { groupAPI, setAuthToken } from "@/lib/api";
import {
  sendGroupMessage as socketSendGroupMessage,
  joinGroupRoom,
  leaveGroupRoom,
} from "@/lib/socket";
import { debounce } from "@/lib/utils";
import toast from "react-hot-toast";

export function useGroupMessages(groupId) {
  const { getToken } = useAuth();
  const {
    user,
    isSocketConnected,
    getGroupMessages,
    setGroupMessages,
    addGroupMessage,
    prependGroupMessages,
    clearGroupUnread,
  } = useStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const pollingIntervalRef = useRef(null);
  const lastMessageIdRef = useRef(null);

  const messages = getGroupMessages(groupId);

  useEffect(() => {
    if (messages.length > 0) {
      lastMessageIdRef.current = messages[messages.length - 1].id;
    }
  }, [messages]);

  const withAuth = useCallback(
    async (fn) => {
      const token = await getToken();
      setAuthToken(token);
      return fn();
    },
    [getToken],
  );

  const fetchMessages = useCallback(
    async (pageNum = 1, append = false) => {
      if (!groupId) return;

      try {
        setIsLoading(true);
        const response = await withAuth(() =>
          groupAPI.getMessages(groupId, pageNum, 50),
        );
        const fetched = response.data || [];

        if (append) {
          prependGroupMessages(groupId, fetched);
        } else {
          setGroupMessages(groupId, fetched);
        }

        setHasMore(response.pagination?.hasNextPage || false);
        setPage(pageNum);
      } catch (error) {
        toast.error(error.message || "Failed to load group messages");
      } finally {
        setIsLoading(false);
      }
    },
    [groupId, withAuth, prependGroupMessages, setGroupMessages],
  );

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;
    await fetchMessages(page + 1, true);
  }, [isLoading, hasMore, page, fetchMessages]);

  const pollForMessages = useCallback(async () => {
    if (!groupId) return;

    try {
      const response = await withAuth(() =>
        groupAPI.getMessages(groupId, 1, 50),
      );
      const fetched = response.data || [];

      if (!fetched.length) return;

      const latestId = fetched[fetched.length - 1].id;
      if (latestId && latestId !== lastMessageIdRef.current) {
        setGroupMessages(groupId, fetched);
        lastMessageIdRef.current = latestId;
      }
    } catch (error) {
      console.error("Group polling failed:", error);
    }
  }, [groupId, withAuth, setGroupMessages]);

  useEffect(() => {
    if (!groupId) return;

    fetchMessages(1, false);
    clearGroupUnread(groupId);

    joinGroupRoom(groupId, () => {});

    pollingIntervalRef.current = setInterval(pollForMessages, 4000);

    return () => {
      leaveGroupRoom(groupId, () => {});
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [groupId, fetchMessages, pollForMessages, clearGroupUnread]);

  const sendMessage = useCallback(
    async (content, type = "text", replyTo = null, fileUrl = null) => {
      if (!groupId || (!content?.trim() && !fileUrl)) return;

      const safeContent = content?.trim() || "";

      const optimistic = {
        id: `temp-group-${Date.now()}`,
        groupId,
        sender: {
          id: user?.id,
          clerkId: user?.id,
          username: user?.username,
          firstName: user?.firstName,
          lastName: user?.lastName,
          avatar: user?.avatar,
        },
        content: safeContent || fileUrl,
        type,
        status: "sending",
        replyTo,
        fileUrl,
        createdAt: new Date().toISOString(),
        isOptimistic: true,
      };

      try {
        setIsSending(true);
        addGroupMessage(groupId, optimistic);

        const socketResponse = await new Promise((resolve, reject) => {
          socketSendGroupMessage(
            {
              groupId,
              content: safeContent,
              type,
              replyTo,
              fileUrl,
            },
            (response) => {
              if (response?.success) {
                resolve(response);
              } else {
                reject(new Error(response?.error || "Failed to send message"));
              }
            },
          );
        });

        if (socketResponse?.message) {
          setGroupMessages(
            groupId,
            getGroupMessages(groupId).filter((msg) => msg.id !== optimistic.id),
          );
          // For connected sockets, rely on server echo event (group:message:new)
          // to avoid adding the same message twice on sender side.
          if (!isSocketConnected) {
            addGroupMessage(groupId, socketResponse.message);
          }
          return socketResponse.message;
        }

        return null;
      } catch (socketError) {
        try {
          const response = await withAuth(() =>
            groupAPI.sendMessage(groupId, {
              content: safeContent,
              type,
              replyTo,
              fileUrl,
            }),
          );

          setGroupMessages(
            groupId,
            getGroupMessages(groupId).filter((msg) => msg.id !== optimistic.id),
          );
          if (response.data?.message && !isSocketConnected) {
            addGroupMessage(groupId, response.data.message);
          }
          return response.data?.message;
        } catch (error) {
          setGroupMessages(
            groupId,
            getGroupMessages(groupId).filter((msg) => msg.id !== optimistic.id),
          );
          toast.error(error.message || "Failed to send group message");
          throw error;
        }
      } finally {
        setIsSending(false);
      }
    },
    [
      groupId,
      user,
      addGroupMessage,
      getGroupMessages,
      setGroupMessages,
      withAuth,
      isSocketConnected,
    ],
  );

  const handleTyping = useCallback(
    debounce(() => {
      // Typing for groups is intentionally no-op in this phase.
    }, 300),
    [],
  );

  return {
    messages,
    isLoading,
    isSending,
    hasMore,
    fetchMessages,
    loadMore,
    sendMessage,
    handleTyping,
  };
}

export default useGroupMessages;
