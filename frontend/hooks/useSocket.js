"use client";

import { useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { useStore } from "@/store/useStore";
import {
  initSocket,
  disconnectSocket,
  getSocket,
  areListenersAttached,
  markListenersAttached,
  onNewMessage,
  onMessageDelivered,
  onMessageRead,
  onMessageDeleted,
  onTypingStart,
  onTypingStop,
  onUserOnline,
  onUserOffline,
  onConversationNew,
  onConversationUpdated,
  onGroupMessageNew,
  onGroupUpdated,
  onGroupMemberAdded,
  onGroupMemberRemoved,
} from "@/lib/socket";
import { playNotificationSound } from "@/lib/utils";
import toast from "react-hot-toast";

export function useSocket() {
  const { getToken, isSignedIn, userId } = useAuth();
  const {
    user,
    setSocketConnected,
    addMessage,
    updateMessage,
    removeMessage,
    addConversation,
    updateConversation,
    setTypingUser,
    removeTypingUser,
    setUserOnline,
    setUserOffline,
    setUserInCall,
    setUserCallEnded,
    addGroup,
    updateGroup,
    removeGroup,
    addGroupMessage,
    incrementGroupUnread,
    clearGroupUnread,
    activeConversationId,
    settings,
  } = useStore();

  // Handle new message
  const handleNewMessage = useCallback(
    (message) => {
      console.log("📨 Received new message:", message);
      addMessage(message.conversationId, message);

      const previewText = message.isEncrypted
        ? "[Encrypted message]"
        : message.content;

      // Update conversation's last message
      updateConversation(message.conversationId, {
        lastMessage: {
          content: previewText,
          sender: message.sender,
          timestamp: message.createdAt,
          type: message.type,
        },
      });

      // Play sound if not from current user and sound is enabled
      if (message.sender.clerkId !== user?.clerkId && settings.soundEnabled) {
        playNotificationSound();
      }

      // Show toast if not in active conversation
      if (
        message.conversationId !== activeConversationId &&
        message.sender.clerkId !== user?.clerkId
      ) {
        toast(`${message.sender.username}:  ${previewText.substring(0, 50)}`, {
          icon: "💬",
          duration: 3000,
        });
      }
    },
    [addMessage, updateConversation, user, settings, activeConversationId],
  );

  // Handle message delivered
  const handleMessageDelivered = useCallback(
    (data) => {
      updateMessage(data.conversationId, data.messageId, {
        status: "delivered",
      });
    },
    [updateMessage],
  );

  // Handle message read
  const handleMessageRead = useCallback(
    (data) => {
      updateMessage(data.conversationId, data.messageId, { status: "read" });
    },
    [updateMessage],
  );

  // Handle message deleted
  const handleMessageDeleted = useCallback(
    (data) => {
      if (data.deletedForEveryone) {
        removeMessage(data.conversationId, data.messageId);
      }
    },
    [removeMessage],
  );

  // Handle typing start
  const handleTypingStart = useCallback(
    (data) => {
      if (data.userId !== user?.id) {
        setTypingUser(data.conversationId, data.userId, data.user);
      }
    },
    [user, setTypingUser],
  );

  // Handle typing stop
  const handleTypingStop = useCallback(
    (data) => {
      removeTypingUser(data.conversationId, data.userId);
    },
    [removeTypingUser],
  );

  // Handle user online
  const handleUserOnline = useCallback(
    (data) => {
      setUserOnline(data.userId);
    },
    [setUserOnline],
  );

  // Handle user offline
  const handleUserOffline = useCallback(
    (data) => {
      setUserOffline(data.userId);
    },
    [setUserOffline],
  );

  const handleUserInCall = useCallback(
    (data) => {
      if (data?.userId) {
        setUserInCall(data.userId);
      }
    },
    [setUserInCall],
  );

  const handleUserCallEnded = useCallback(
    (data) => {
      if (data?.userId) {
        setUserCallEnded(data.userId);
      }
    },
    [setUserCallEnded],
  );

  // Handle new conversation
  const handleConversationNew = useCallback(
    (data) => {
      addConversation(data.conversation);
    },
    [addConversation],
  );

  // Handle conversation updated
  const handleConversationUpdated = useCallback(
    (data) => {
      updateConversation(data.conversationId, {
        lastMessage: data.lastMessage,
        unreadCount: data.unreadCount,
      });
    },
    [updateConversation],
  );

  const handleGroupMessage = useCallback(
    (message) => {
      if (!message?.groupId) return;

      const state = useStore.getState();
      const currentActiveGroupId = state.activeGroupId;
      const currentUserId = state.user?.clerkId;

      addGroupMessage(message.groupId, message);

      updateGroup(message.groupId, {
        lastMessage: {
          content:
            message.type === "text"
              ? message.content
              : `[${message.type || "file"}]`,
          sender: message.sender,
          timestamp: message.createdAt,
          type: message.type,
        },
      });

      if (
        currentActiveGroupId !== message.groupId &&
        message.sender?.clerkId !== currentUserId
      ) {
        incrementGroupUnread(message.groupId);
      } else if (currentActiveGroupId === message.groupId) {
        clearGroupUnread(message.groupId);
      }
    },
    [addGroupMessage, updateGroup, incrementGroupUnread, clearGroupUnread],
  );

  const handleGroupUpdated = useCallback(
    (payload) => {
      if (!payload) return;

      if (payload.action === "deleted" || payload.action === "left") {
        if (payload.groupId) {
          removeGroup(payload.groupId);
        }
        return;
      }

      if (payload.action === "removed-from-group") {
        if (payload.groupId) {
          removeGroup(payload.groupId);
        }
        return;
      }

      if (payload.group?.id) {
        const exists = useStore
          .getState()
          .groups.some((group) => group.id === payload.group.id);
        if (exists) {
          updateGroup(payload.group.id, payload.group);
        } else {
          addGroup(payload.group);
        }
      }
    },
    [addGroup, updateGroup, removeGroup],
  );

  const handleGroupMemberAdded = useCallback(
    (payload) => {
      if (payload?.groupId) {
        updateGroup(payload.groupId, { updatedAt: new Date().toISOString() });
      }
    },
    [updateGroup],
  );

  const handleGroupMemberRemoved = useCallback(
    (payload) => {
      if (payload?.groupId) {
        updateGroup(payload.groupId, { updatedAt: new Date().toISOString() });
      }
    },
    [updateGroup],
  );

  // Initialize socket connection and attach event listeners
  useEffect(() => {
    if (!isSignedIn) return;

    // Check if we already have a socket AND listeners attached
    const existingSocket = getSocket();
    if (existingSocket && areListenersAttached()) {
      console.log(
        "⏭️ Socket already initialized with listeners, skipping setup",
      );
      // If socket is connected, update state
      if (existingSocket.connected) {
        setSocketConnected(true);
      }
      return;
    }

    // Mark that we're setting up (prevents race conditions in Strict Mode)
    if (areListenersAttached()) {
      console.log("⏭️ Setup already in progress, skipping");
      return;
    }

    console.log("🚀 Starting socket setup...");
    markListenersAttached(); // Mark IMMEDIATELY to prevent double setup

    const setupSocketWithListeners = async () => {
      try {
        const token = await getToken();
        if (!token || !userId) {
          console.log("❌ No token or userId available");
          return;
        }

        console.log("📡 Initializing socket with token and userId:", userId);
        const socket = initSocket(token, userId);

        // Wait for socket to be ready
        if (!socket) {
          console.log("❌ Failed to get socket instance");
          return;
        }

        console.log("🔌 Socket instance obtained, attaching handlers...");

        // IMPORTANT: Always get socket from global storage to ensure we're using the same instance
        const globalSocket = getSocket();
        if (!globalSocket) {
          console.log("❌ Global socket not available");
          return;
        }

        globalSocket.on("connect", () => {
          console.log("✅ Socket connected:", globalSocket.id);
          setSocketConnected(true);
        });

        globalSocket.on("disconnect", () => {
          console.log("❌ Socket disconnected");
          setSocketConnected(false);
        });

        // Attach all event listeners
        globalSocket.on("message:new", (data) => {
          console.log("🔔 message:new event received:", data);
          handleNewMessage(data);
        });
        globalSocket.on("message:delivered", (data) => {
          console.log("✅ message:delivered event received:", data);
          handleMessageDelivered(data);
        });
        globalSocket.on("message:read", (data) => {
          console.log("👁️ message:read event received:", data);
          handleMessageRead(data);
        });
        globalSocket.on("message:deleted", (data) => {
          console.log("🗑️ message:deleted event received:", data);
          handleMessageDeleted(data);
        });
        globalSocket.on("typing:start", (data) => {
          console.log("⌨️ typing:start event received:", data);
          handleTypingStart(data);
        });
        globalSocket.on("typing:stop", (data) => {
          console.log("⏹️ typing:stop event received:", data);
          handleTypingStop(data);
        });
        globalSocket.on("user:online", (data) => {
          console.log("🟢 user:online event received:", data);
          handleUserOnline(data);
        });
        globalSocket.on("user:offline", (data) => {
          console.log("⚫ user:offline event received:", data);
          handleUserOffline(data);
        });
        globalSocket.on("user:in-call", (data) => {
          console.log("📞 user:in-call event received:", data);
          handleUserInCall(data);
        });
        globalSocket.on("user:call-ended", (data) => {
          console.log("📴 user:call-ended event received:", data);
          handleUserCallEnded(data);
        });
        globalSocket.on("conversation:new", (data) => {
          console.log("💬 conversation:new event received:", data);
          handleConversationNew(data);
        });
        globalSocket.on("conversation:updated", (data) => {
          console.log("🔄 conversation:updated event received:", data);
          handleConversationUpdated(data);
        });
        globalSocket.on("group:message:new", (data) => {
          console.log("👥 group:message:new event received:", data);
          handleGroupMessage(data);
        });
        globalSocket.on("group:updated", (data) => {
          console.log("🧩 group:updated event received:", data);
          handleGroupUpdated(data);
        });
        globalSocket.on("group:member:added", (data) => {
          console.log("➕ group:member:added event received:", data);
          handleGroupMemberAdded(data);
        });
        globalSocket.on("group:member:removed", (data) => {
          console.log("➖ group:member:removed event received:", data);
          handleGroupMemberRemoved(data);
        });

        console.log(
          "✅ All socket event listeners attached to socket:",
          globalSocket.id,
        );
      } catch (error) {
        console.error("❌ Failed to initialize socket:", error);
      }
    };

    setupSocketWithListeners();

    // Cleanup function - but DON'T disconnect the socket
    // The socket should persist across component remounts
    return () => {
      console.log("🧹 useSocket cleanup called (but keeping socket alive)");
      // Don't remove event listeners or disconnect
      // The socket should remain connected for the entire session
    };
  }, [
    isSignedIn,
    userId,
    handleNewMessage,
    handleMessageDelivered,
    handleMessageRead,
    handleMessageDeleted,
    handleTypingStart,
    handleTypingStop,
    handleUserOnline,
    handleUserOffline,
    handleUserInCall,
    handleUserCallEnded,
    handleConversationNew,
    handleConversationUpdated,
    handleGroupMessage,
    handleGroupUpdated,
    handleGroupMemberAdded,
    handleGroupMemberRemoved,
    setSocketConnected,
  ]);

  return {
    socket: getSocket(),
    isConnected: useStore((state) => state.isSocketConnected),
  };
}

export default useSocket;
