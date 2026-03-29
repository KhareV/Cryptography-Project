/**
 * Socket Manager
 * Manages socket connections and user-socket mappings
 */

import { logger } from "./helpers.js";

class SocketManager {
  constructor() {
    // Map of userId -> Set of socketIds (user can have multiple connections)
    this.userSockets = new Map();

    // Map of socketId -> userId
    this.socketUsers = new Map();

    // Map of socketId -> socket instance
    this.sockets = new Map();

    // Typing indicators:  conversationId -> Map(userId -> timeout)
    this.typingIndicators = new Map();

    // Active calls: callId -> call data
    this.activeCalls = new Map();

    // Users currently in an active/ringing call
    this.inCallUsers = new Set();

    // IO instance reference
    this.io = null;
  }

  /**
   * Initialize with Socket.io instance
   * @param {Object} io - Socket.io server instance
   */
  initialize(io) {
    this.io = io;
    logger.info("Socket manager initialized");
  }

  /**
   * Register a new socket connection
   * @param {Object} socket - Socket instance
   * @param {string} userId - User's MongoDB ID
   */
  addSocket(socket, userId) {
    const userIdStr = userId.toString();
    const socketId = socket.id;

    // Store socket instance
    this.sockets.set(socketId, socket);

    // Map socket to user
    this.socketUsers.set(socketId, userIdStr);

    // Map user to socket(s)
    if (!this.userSockets.has(userIdStr)) {
      this.userSockets.set(userIdStr, new Set());
    }
    this.userSockets.get(userIdStr).add(socketId);

    // Join user's personal room
    socket.join(`user: ${userIdStr}`);

    logger.debug(`Socket registered: ${socketId} for user ${userIdStr}`);
    logger.debug(
      `User ${userIdStr} now has ${
        this.userSockets.get(userIdStr).size
      } active connections`,
    );
  }

  /**
   * Remove a socket connection
   * @param {string} socketId - Socket ID to remove
   * @returns {string|null} User ID of the disconnected socket
   */
  removeSocket(socketId) {
    const userId = this.socketUsers.get(socketId);

    if (!userId) {
      logger.warn(`Attempted to remove unknown socket: ${socketId}`);
      return null;
    }

    // Remove from socket maps
    this.sockets.delete(socketId);
    this.socketUsers.delete(socketId);

    // Remove from user's socket set
    const userSocketSet = this.userSockets.get(userId);
    if (userSocketSet) {
      userSocketSet.delete(socketId);

      // If user has no more connections, remove from map
      if (userSocketSet.size === 0) {
        this.userSockets.delete(userId);
        logger.debug(`User ${userId} has no more active connections`);
        return userId; // Return userId to indicate user went offline
      }
    }

    logger.debug(`Socket removed: ${socketId} for user ${userId}`);
    return null; // User still has other connections
  }

  /**
   * Get socket instance by ID
   * @param {string} socketId - Socket ID
   * @returns {Object|null} Socket instance
   */
  getSocket(socketId) {
    return this.sockets.get(socketId) || null;
  }

  /**
   * Get all socket IDs for a user
   * @param {string} userId - User ID
   * @returns {Array<string>} Array of socket IDs
   */
  getUserSockets(userId) {
    const userIdStr = userId.toString();
    const socketSet = this.userSockets.get(userIdStr);
    return socketSet ? Array.from(socketSet) : [];
  }

  /**
   * Check if user is online (has at least one connection)
   * @param {string} userId - User ID
   * @returns {boolean} Whether user is online
   */
  isUserOnline(userId) {
    const userIdStr = userId.toString();
    const socketSet = this.userSockets.get(userIdStr);
    return socketSet && socketSet.size > 0;
  }

  /**
   * Get all online user IDs
   * @returns {Array<string>} Array of online user IDs
   */
  getOnlineUsers() {
    return Array.from(this.userSockets.keys());
  }

  /**
   * Get count of active connections
   * @returns {Object} Connection statistics
   */
  getStats() {
    return {
      totalConnections: this.sockets.size,
      totalUsers: this.userSockets.size,
      totalUsersInCall: this.inCallUsers.size,
      onlineUsers: this.getOnlineUsers(),
      inCallUsers: this.getInCallUsers(),
    };
  }

  /**
   * Emit event to a specific user (all their connections)
   * @param {string} userId - User ID
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  emitToUser(userId, event, data) {
    const userIdStr = userId.toString();

    if (this.io) {
      this.io.to(`user:${userIdStr}`).emit(event, data);
      logger.debug(`Emitted "${event}" to user ${userIdStr}`);
    }
  }

  /**
   * Emit event to multiple users
   * @param {Array<string>} userIds - Array of user IDs
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  emitToUsers(userIds, event, data) {
    userIds.forEach((userId) => {
      this.emitToUser(userId, event, data);
    });
  }

  /**
   * Emit event to a conversation room
   * @param {string} conversationId - Conversation ID
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  emitToConversation(conversationId, event, data) {
    if (this.io) {
      this.io.to(`conversation:${conversationId}`).emit(event, data);
      logger.debug(`Emitted "${event}" to conversation ${conversationId}`);
    }
  }

  /**
   * Emit event to a group room
   * @param {string} groupId - Group ID
   * @param {string} event - Event name
   * @param {Object} data - Event payload
   */
  emitToGroup(groupId, event, data) {
    if (this.io) {
      this.io.to(`group:${groupId}`).emit(event, data);
      logger.debug(`Emitted "${event}" to group ${groupId}`);
    }
  }

  /**
   * Join a socket to a conversation room
   * @param {string} socketId - Socket ID
   * @param {string} conversationId - Conversation ID
   */
  joinConversation(socketId, conversationId) {
    const socket = this.sockets.get(socketId);
    if (socket) {
      socket.join(`conversation:${conversationId}`);
      logger.debug(`Socket ${socketId} joined conversation ${conversationId}`);
    }
  }

  /**
   * Remove a socket from a conversation room
   * @param {string} socketId - Socket ID
   * @param {string} conversationId - Conversation ID
   */
  leaveConversation(socketId, conversationId) {
    const socket = this.sockets.get(socketId);
    if (socket) {
      socket.leave(`conversation:${conversationId}`);
      logger.debug(`Socket ${socketId} left conversation ${conversationId}`);
    }
  }

  /**
   * Join a socket to a group room
   * @param {string} socketId - Socket ID
   * @param {string} groupId - Group ID
   */
  joinGroup(socketId, groupId) {
    const socket = this.sockets.get(socketId);
    if (socket) {
      socket.join(`group:${groupId}`);
      logger.debug(`Socket ${socketId} joined group ${groupId}`);
    }
  }

  /**
   * Remove a socket from a group room
   * @param {string} socketId - Socket ID
   * @param {string} groupId - Group ID
   */
  leaveGroup(socketId, groupId) {
    const socket = this.sockets.get(socketId);
    if (socket) {
      socket.leave(`group:${groupId}`);
      logger.debug(`Socket ${socketId} left group ${groupId}`);
    }
  }

  /**
   * Set typing indicator for a user in a conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @param {number} timeout - Auto-clear timeout in ms (default 3000)
   */
  setTyping(conversationId, userId, timeout = 3000) {
    const userIdStr = userId.toString();

    if (!this.typingIndicators.has(conversationId)) {
      this.typingIndicators.set(conversationId, new Map());
    }

    const conversationTyping = this.typingIndicators.get(conversationId);

    // Clear existing timeout if any
    if (conversationTyping.has(userIdStr)) {
      clearTimeout(conversationTyping.get(userIdStr));
    }

    // Set new timeout to auto-clear typing
    const timeoutId = setTimeout(() => {
      this.clearTyping(conversationId, userId);
    }, timeout);

    conversationTyping.set(userIdStr, timeoutId);
  }

  /**
   * Clear typing indicator for a user in a conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   */
  clearTyping(conversationId, userId) {
    const userIdStr = userId.toString();
    const conversationTyping = this.typingIndicators.get(conversationId);

    if (conversationTyping && conversationTyping.has(userIdStr)) {
      clearTimeout(conversationTyping.get(userIdStr));
      conversationTyping.delete(userIdStr);

      // Emit typing stop event
      this.emitToConversation(conversationId, "typing:stop", {
        conversationId,
        userId: userIdStr,
      });
    }
  }

  /**
   * Get users currently typing in a conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Array<string>} Array of user IDs currently typing
   */
  getTypingUsers(conversationId) {
    const conversationTyping = this.typingIndicators.get(conversationId);
    return conversationTyping ? Array.from(conversationTyping.keys()) : [];
  }

  /**
   * Broadcast user online status to their contacts
   * @param {string} userId - User ID
   * @param {Array<string>} contactIds - Array of contact user IDs
   * @param {boolean} isOnline - Online status
   */
  broadcastUserStatus(userId, contactIds, isOnline) {
    const event = isOnline ? "user:online" : "user:offline";
    const data = {
      userId: userId.toString(),
      status: isOnline ? "online" : "offline",
      timestamp: new Date().toISOString(),
    };

    contactIds.forEach((contactId) => {
      if (this.isUserOnline(contactId)) {
        this.emitToUser(contactId, event, data);
      }
    });

    logger.debug(
      `Broadcast ${event} for user ${userId} to ${contactIds.length} contacts`,
    );
  }

  /**
   * Clear all data (for testing/shutdown)
   */
  clear() {
    // Clear all typing timeouts
    this.typingIndicators.forEach((conversationTyping) => {
      conversationTyping.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
    });

    this.userSockets.clear();
    this.socketUsers.clear();
    this.sockets.clear();
    this.typingIndicators.clear();
    this.activeCalls.clear();
    this.inCallUsers.clear();

    logger.info("Socket manager cleared");
  }

  /**
   * Store call data
   * @param {string} callId - Call ID
   * @param {Object} callData - Call data
   */
  setCallData(callId, callData) {
    this.activeCalls.set(callId, callData);
    logger.debug(`Call data stored: ${callId}`);
  }

  /**
   * Get call data
   * @param {string} callId - Call ID
   * @returns {Object|null} Call data
   */
  getCallData(callId) {
    return this.activeCalls.get(callId) || null;
  }

  /**
   * Remove call data
   * @param {string} callId - Call ID
   */
  removeCallData(callId) {
    this.activeCalls.delete(callId);
    logger.debug(`Call data removed: ${callId}`);
  }

  /**
   * Get all active calls
   * @returns {Array<Object>} Array of active calls
   */
  getActiveCalls() {
    return Array.from(this.activeCalls.values());
  }

  /**
   * Get active calls for a user
   * @param {string} userId - User ID
   * @returns {Array<Object>} Array of user's active calls
   */
  getUserActiveCalls(userId) {
    const userIdStr = userId.toString();
    return this.getActiveCalls().filter(
      (call) =>
        call.caller?.id === userIdStr ||
        call.recipient?.id === userIdStr ||
        call.initiatorId === userIdStr ||
        call.receiverId === userIdStr,
    );
  }

  /**
   * Get all users currently marked in-call
   * @returns {Array<string>} Array of user IDs
   */
  getInCallUsers() {
    return Array.from(this.inCallUsers);
  }

  /**
   * Check if a specific user is currently in-call
   * @param {string} userId - User ID
   * @returns {boolean} Whether user is in a call
   */
  isUserInCall(userId) {
    return this.inCallUsers.has(userId.toString());
  }

  /**
   * Recompute a user's call presence from active call map
   * @param {string} userId - User ID
   * @returns {{ changed: boolean, isInCall: boolean }}
   */
  refreshUserCallState(userId) {
    const userIdStr = userId.toString();
    const activeStatuses = new Set(["ringing", "active"]);

    const isInCall = this.getUserActiveCalls(userIdStr).some((call) =>
      activeStatuses.has(call.status),
    );

    const wasInCall = this.inCallUsers.has(userIdStr);

    if (isInCall && !wasInCall) {
      this.inCallUsers.add(userIdStr);
      return { changed: true, isInCall: true };
    }

    if (!isInCall && wasInCall) {
      this.inCallUsers.delete(userIdStr);
      return { changed: true, isInCall: false };
    }

    return { changed: false, isInCall };
  }
}

// Export singleton instance
export const socketManager = new SocketManager();

export default socketManager;
