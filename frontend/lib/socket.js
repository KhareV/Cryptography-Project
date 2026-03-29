import { io } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Use global object to persist socket across hot reloads in development
if (typeof window !== "undefined") {
  if (!window.__SOCKET_INSTANCE__) {
    window.__SOCKET_INSTANCE__ = null;
  }
  if (!window.__SOCKET_LISTENERS_ATTACHED__) {
    window.__SOCKET_LISTENERS_ATTACHED__ = false;
  }
}

let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let isInitializing = false;

/**
 * Get socket from global storage
 */
const getSocketFromGlobal = () => {
  if (typeof window !== "undefined") {
    return window.__SOCKET_INSTANCE__;
  }
  return null;
};

/**
 * Set socket in global storage
 */
const setSocketInGlobal = (socketInstance) => {
  if (typeof window !== "undefined") {
    window.__SOCKET_INSTANCE__ = socketInstance;
  }
};

/**
 * Initialize socket connection
 */
export const initSocket = (token, userId) => {
  const socket = getSocketFromGlobal();

  // If socket already exists and is connected, return it
  if (socket?.connected) {
    console.log("🔄 Reusing existing socket connection:", socket.id);
    return socket;
  }

  // If we're already initializing, wait and return the existing socket
  if (isInitializing) {
    console.log("⏳ Socket initialization in progress, waiting...");
    return socket;
  }

  // If socket exists but disconnected, don't create a new one, just return it
  // The socket will auto-reconnect
  if (socket && !socket.connected) {
    console.log("🔄 Socket exists but disconnected, will auto-reconnect");
    return socket;
  }

  isInitializing = true;
  console.log("🚀 Initializing new socket connection...");

  const newSocket = io(SOCKET_URL, {
    auth: {
      token,
      userId,
    },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    autoConnect: true,
  });

  setSocketInGlobal(newSocket);

  setSocketInGlobal(newSocket);

  // Connection handlers
  newSocket.on("connect", () => {
    console.log("✅ Socket connected:", newSocket.id);
    reconnectAttempts = 0;
    isInitializing = false;
  });

  newSocket.on("connected", (data) => {
    console.log("✅ Authenticated with server:", data);
  });

  newSocket.on("disconnect", (reason) => {
    console.log("❌ Socket disconnected:", reason);
    console.trace("Disconnect stack trace:");
    isInitializing = false;
  });

  newSocket.on("connect_error", (error) => {
    console.error("❌ Connection error:", error.message);
    reconnectAttempts++;
    isInitializing = false;

    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error("Max reconnection attempts reached");
    }
  });

  newSocket.on("error", (error) => {
    console.error("❌ Socket error:", error);
  });

  return newSocket;
};

/**
 * Get socket instance
 */
export const getSocket = () => getSocketFromGlobal();

/**
 * Check if socket is connected
 */
export const isConnected = () => {
  const socket = getSocketFromGlobal();
  return socket?.connected || false;
};

/**
 * Check if event listeners are already attached
 */
export const areListenersAttached = () => {
  if (typeof window !== "undefined") {
    return window.__SOCKET_LISTENERS_ATTACHED__;
  }
  return false;
};

/**
 * Mark listeners as attached
 */
export const markListenersAttached = () => {
  if (typeof window !== "undefined") {
    window.__SOCKET_LISTENERS_ATTACHED__ = true;
    console.log("✅ Marked listeners as attached globally");
  }
};

/**
 * Disconnect socket
 */
export const disconnectSocket = () => {
  const socket = getSocketFromGlobal();
  if (socket) {
    socket.disconnect();
    setSocketInGlobal(null);
    if (typeof window !== "undefined") {
      window.__SOCKET_LISTENERS_ATTACHED__ = false;
    }
  }
};

/**
 * Emit with acknowledgment
 */
export const emitWithAck = (event, data) => {
  return new Promise((resolve, reject) => {
    const socket = getSocketFromGlobal();
    if (!socket?.connected) {
      reject(new Error("Socket not connected"));
      return;
    }

    socket.emit(event, data, (response) => {
      if (response?.success) {
        resolve(response);
      } else {
        reject(new Error(response?.error || "Unknown error"));
      }
    });
  });
};

// ============================================
// Message Methods
// ============================================
export const sendMessage = (data) => {
  return emitWithAck("message:send", data);
};

export const markMessageRead = (messageId, conversationId) => {
  return emitWithAck("message:read", { messageId, conversationId });
};

export const deleteMessage = (messageId, deleteForEveryone = false) => {
  return emitWithAck("message:delete", { messageId, deleteForEveryone });
};

export const addReaction = (messageId, emoji) => {
  return emitWithAck("message:reaction", { messageId, emoji });
};

// ============================================
// Conversation Methods
// ============================================
export const markConversationRead = (conversationId) => {
  return emitWithAck("conversation:read", { conversationId });
};

export const joinConversation = (conversationId) => {
  return emitWithAck("conversation:join", { conversationId });
};

export const leaveConversation = (conversationId) => {
  return emitWithAck("conversation:leave", { conversationId });
};

// ============================================
// Typing Methods
// ============================================
export const startTyping = (conversationId) => {
  const socket = getSocketFromGlobal();
  if (socket?.connected) {
    socket.emit("typing:start", { conversationId });
  }
};

export const stopTyping = (conversationId) => {
  const socket = getSocketFromGlobal();
  if (socket?.connected) {
    socket.emit("typing:stop", { conversationId });
  }
};

// ============================================
// Status Methods
// ============================================
export const updateStatus = (status) => {
  return emitWithAck("status:update", { status });
};

export const getOnlineStatus = (userIds) => {
  return emitWithAck("status:get", { userIds });
};

// ============================================
// Call Methods
// ============================================
export const initiateCall = (data, callback) => {
  const socket = getSocketFromGlobal();
  if (socket?.connected) {
    socket.emit("call:initiate", data, callback);
  } else {
    callback({ success: false, error: "Socket not connected" });
  }
};

export const answerCall = (data, callback) => {
  const socket = getSocketFromGlobal();
  if (socket?.connected) {
    socket.emit("call:accept", data, callback);
  } else {
    callback({ success: false, error: "Socket not connected" });
  }
};

export const acceptCall = (data, callback) => {
  return answerCall(data, callback);
};

export const declineCall = (data, callback) => {
  const socket = getSocketFromGlobal();
  if (socket?.connected) {
    socket.emit("call:reject", data, callback);
  } else {
    callback({ success: false, error: "Socket not connected" });
  }
};

export const rejectCall = (data, callback) => {
  return declineCall(data, callback);
};

export const endCall = (data, callback) => {
  const socket = getSocketFromGlobal();
  if (socket?.connected) {
    socket.emit("call:end", data, callback);
  }
};

export const sendIceCandidate = (data) => {
  const socket = getSocketFromGlobal();
  if (socket?.connected) {
    socket.emit("call:ice-candidate", data);
  }
};

export const sendRtcOffer = (data) => {
  const socket = getSocketFromGlobal();
  if (socket?.connected) {
    socket.emit("call:offer", data);
  }
};

export const sendRtcAnswer = (data) => {
  const socket = getSocketFromGlobal();
  if (socket?.connected) {
    socket.emit("call:answer", data);
  }
};

// ============================================
// Group Methods
// ============================================
export const createGroupSocket = (data, callback) => {
  const socket = getSocketFromGlobal();
  if (socket?.connected) {
    socket.emit("group:create", data, callback);
  } else if (typeof callback === "function") {
    callback({ success: false, error: "Socket not connected" });
  }
};

export const joinGroupRoom = (groupId, callback) => {
  const socket = getSocketFromGlobal();
  if (socket?.connected) {
    socket.emit("group:join", { groupId }, callback);
  } else if (typeof callback === "function") {
    callback({ success: false, error: "Socket not connected" });
  }
};

export const leaveGroupRoom = (groupId, callback) => {
  const socket = getSocketFromGlobal();
  if (socket?.connected) {
    socket.emit("group:leave", { groupId }, callback);
  } else if (typeof callback === "function") {
    callback({ success: false, error: "Socket not connected" });
  }
};

export const sendGroupMessage = (data, callback) => {
  const socket = getSocketFromGlobal();
  if (socket?.connected) {
    socket.emit("group:message:send", data, callback);
  } else if (typeof callback === "function") {
    callback({ success: false, error: "Socket not connected" });
  }
};

export const onUserInCall = (callback) => {
  const socket = getSocketFromGlobal();
  socket?.on("user:in-call", callback);
  return () => socket?.off("user:in-call", callback);
};

export const onUserCallEnded = (callback) => {
  const socket = getSocketFromGlobal();
  socket?.on("user:call-ended", callback);
  return () => socket?.off("user:call-ended", callback);
};

// ============================================
// Event Subscriptions
// ============================================
export const onNewMessage = (callback) => {
  const socket = getSocketFromGlobal();
  socket?.on("message:new", callback);
  return () => socket?.off("message:new", callback);
};

export const onMessageDelivered = (callback) => {
  const socket = getSocketFromGlobal();
  socket?.on("message:delivered", callback);
  return () => socket?.off("message:delivered", callback);
};

export const onMessageRead = (callback) => {
  const socket = getSocketFromGlobal();
  socket?.on("message:read", callback);
  return () => socket?.off("message:read", callback);
};

export const onMessageDeleted = (callback) => {
  const socket = getSocketFromGlobal();
  socket?.on("message:deleted", callback);
  return () => socket?.off("message:deleted", callback);
};

export const onMessageEdited = (callback) => {
  const socket = getSocketFromGlobal();
  socket?.on("message:edited", callback);
  return () => socket?.off("message:edited", callback);
};

export const onMessageReaction = (callback) => {
  const socket = getSocketFromGlobal();
  socket?.on("message:reaction", callback);
  return () => socket?.off("message:reaction", callback);
};

export const onTypingStart = (callback) => {
  const socket = getSocketFromGlobal();
  socket?.on("typing:start", callback);
  return () => socket?.off("typing:start", callback);
};

export const onTypingStop = (callback) => {
  const socket = getSocketFromGlobal();
  socket?.on("typing:stop", callback);
  return () => socket?.off("typing:stop", callback);
};

export const onUserOnline = (callback) => {
  const socket = getSocketFromGlobal();
  socket?.on("user:online", callback);
  return () => socket?.off("user:online", callback);
};

export const onUserOffline = (callback) => {
  const socket = getSocketFromGlobal();
  socket?.on("user:offline", callback);
  return () => socket?.off("user:offline", callback);
};

export const onConversationNew = (callback) => {
  const socket = getSocketFromGlobal();
  socket?.on("conversation:new", callback);
  return () => socket?.off("conversation:new", callback);
};

export const onConversationUpdated = (callback) => {
  const socket = getSocketFromGlobal();
  socket?.on("conversation:updated", callback);
  return () => socket?.off("conversation:updated", callback);
};

export const onGroupMessageNew = (callback) => {
  const socket = getSocketFromGlobal();
  socket?.on("group:message:new", callback);
  return () => socket?.off("group:message:new", callback);
};

export const onGroupUpdated = (callback) => {
  const socket = getSocketFromGlobal();
  socket?.on("group:updated", callback);
  return () => socket?.off("group:updated", callback);
};

export const onGroupMemberAdded = (callback) => {
  const socket = getSocketFromGlobal();
  socket?.on("group:member:added", callback);
  return () => socket?.off("group:member:added", callback);
};

export const onGroupMemberRemoved = (callback) => {
  const socket = getSocketFromGlobal();
  socket?.on("group:member:removed", callback);
  return () => socket?.off("group:member:removed", callback);
};

export default {
  initSocket,
  getSocket,
  isConnected,
  disconnectSocket,
  sendMessage,
  markMessageRead,
  deleteMessage,
  addReaction,
  markConversationRead,
  joinConversation,
  leaveConversation,
  startTyping,
  stopTyping,
  updateStatus,
  getOnlineStatus,
  initiateCall,
  answerCall,
  declineCall,
  endCall,
  sendIceCandidate,
  sendRtcOffer,
  sendRtcAnswer,
  createGroupSocket,
  joinGroupRoom,
  leaveGroupRoom,
  sendGroupMessage,
  onNewMessage,
  onMessageDelivered,
  onMessageRead,
  onMessageDeleted,
  onMessageEdited,
  onMessageReaction,
  onTypingStart,
  onTypingStop,
  onUserOnline,
  onUserOffline,
  onUserInCall,
  onUserCallEnded,
  onConversationNew,
  onConversationUpdated,
  onGroupMessageNew,
  onGroupUpdated,
  onGroupMemberAdded,
  onGroupMemberRemoved,
};
