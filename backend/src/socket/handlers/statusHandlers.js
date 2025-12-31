/**
 * Socket. io Status Event Handlers
 * Handles user online/offline status and presence updates
 */

import User from "../../models/User.js";
import Conversation from "../../models/Conversation.js";
import { socketManager } from "../../utils/socketManager.js";
import { logger } from "../../utils/helpers.js";
import { handleSocketError } from "../../middleware/errorHandler.js";

/**
 * Handle user connection
 * Updates status to online and notifies contacts
 * @param {Object} socket - Socket instance
 */
export const handleUserConnect = async (socket) => {
  try {
    const userId = socket.userId;

    // Register socket in manager
    socketManager.addSocket(socket, userId);

    // Update user status to online
    const user = await User.findByIdAndUpdate(
      userId,
      {
        status: "online",
        lastSeen: new Date(),
      },
      { new: true }
    ).populate("contacts", "_id");

    if (!user) {
      logger.warn(`User not found during connect: ${userId}`);
      return;
    }

    // Join user's conversation rooms
    const conversations = await Conversation.find({
      participants: userId,
      isActive: true,
    });

    for (const conversation of conversations) {
      socket.join(`conversation: ${conversation._id}`);
    }

    // Notify contacts that user is online
    if (user.contacts && user.contacts.length > 0) {
      const contactIds = user.contacts.map((c) => c._id.toString());
      socketManager.broadcastUserStatus(userId, contactIds, true);
    }

    // Emit connection success to the user
    socket.emit("connected", {
      userId,
      status: "online",
      conversationCount: conversations.length,
    });

    logger.info(`User connected: ${user.username} (${socket.id})`);
  } catch (error) {
    handleSocketError(socket, error, "connect");
  }
};

/**
 * Handle user disconnection
 * Updates status to offline and notifies contacts
 * @param {Object} socket - Socket instance
 */
export const handleUserDisconnect = async (socket) => {
  try {
    const userId = socket.userId;

    // Remove socket from manager
    const userWentOffline = socketManager.removeSocket(socket.id);

    // Only update status if user has no more connections
    if (userWentOffline) {
      const user = await User.findByIdAndUpdate(
        userId,
        {
          status: "offline",
          lastSeen: new Date(),
        },
        { new: true }
      ).populate("contacts", "_id");

      if (user && user.contacts && user.contacts.length > 0) {
        const contactIds = user.contacts.map((c) => c._id.toString());
        socketManager.broadcastUserStatus(userId, contactIds, false);
      }

      logger.info(`User disconnected: ${userId} (${socket.id})`);
    } else {
      logger.debug(
        `Socket disconnected but user still has other connections: ${userId}`
      );
    }
  } catch (error) {
    logger.error("Error handling disconnect:", error.message);
  }
};

/**
 * Handle manual status update
 * @param {Object} socket - Socket instance
 * @param {Object} data - Status data { status }
 * @param {Function} callback - Acknowledgment callback
 */
export const handleStatusUpdate = async (socket, data, callback) => {
  try {
    const { status } = data;
    const userId = socket.userId;

    if (!status || !["online", "offline", "away"].includes(status)) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Invalid status" });
      }
      return;
    }

    // Update user status
    const user = await User.findByIdAndUpdate(
      userId,
      {
        status,
        lastSeen: new Date(),
      },
      { new: true }
    ).populate("contacts", "_id");

    if (!user) {
      if (typeof callback === "function") {
        callback({ success: false, error: "User not found" });
      }
      return;
    }

    // Notify contacts of status change
    if (user.contacts && user.contacts.length > 0) {
      const contactIds = user.contacts.map((c) => c._id.toString());

      for (const contactId of contactIds) {
        if (socketManager.isUserOnline(contactId)) {
          socketManager.emitToUser(contactId, "user:status", {
            userId,
            status,
            lastSeen: user.lastSeen.toISOString(),
          });
        }
      }
    }

    if (typeof callback === "function") {
      callback({ success: true, status });
    }

    logger.debug(`User ${userId} status updated to ${status}`);
  } catch (error) {
    handleSocketError(socket, error, "status:update");
    if (typeof callback === "function") {
      callback({ success: false, error: "Failed to update status" });
    }
  }
};

/**
 * Handle request for user's online status
 * @param {Object} socket - Socket instance
 * @param {Object} data - Request data { userIds }
 * @param {Function} callback - Acknowledgment callback
 */
export const handleGetOnlineStatus = async (socket, data, callback) => {
  try {
    const { userIds } = data;

    if (!userIds || !Array.isArray(userIds)) {
      if (typeof callback === "function") {
        callback({ success: false, error: "User IDs array required" });
      }
      return;
    }

    // Get online status for each user
    const statuses = {};

    for (const userId of userIds) {
      const isOnline = socketManager.isUserOnline(userId);

      if (isOnline) {
        statuses[userId] = "online";
      } else {
        // Get last seen from database
        const user = await User.findById(userId).select("status lastSeen");
        statuses[userId] = user
          ? {
              status: user.status,
              lastSeen: user.lastSeen?.toISOString(),
            }
          : null;
      }
    }

    if (typeof callback === "function") {
      callback({ success: true, statuses });
    }
  } catch (error) {
    handleSocketError(socket, error, "status:get");
    if (typeof callback === "function") {
      callback({ success: false, error: "Failed to get online status" });
    }
  }
};

/**
 * Handle heartbeat/ping to keep connection alive
 * @param {Object} socket - Socket instance
 * @param {Object} data - Heartbeat data
 * @param {Function} callback - Acknowledgment callback
 */
export const handleHeartbeat = async (socket, data, callback) => {
  try {
    const userId = socket.userId;

    // Update last seen
    await User.findByIdAndUpdate(userId, {
      lastSeen: new Date(),
    });

    if (typeof callback === "function") {
      callback({
        success: true,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    handleSocketError(socket, error, "heartbeat");
    if (typeof callback === "function") {
      callback({ success: false });
    }
  }
};

/**
 * Handle joining a conversation room
 * @param {Object} socket - Socket instance
 * @param {Object} data - Join data { conversationId }
 * @param {Function} callback - Acknowledgment callback
 */
export const handleJoinConversation = async (socket, data, callback) => {
  try {
    const { conversationId } = data;
    const userId = socket.userId;

    if (!conversationId) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Conversation ID required" });
      }
      return;
    }

    // Verify user is participant
    const conversation = await Conversation.findById(conversationId);

    if (!conversation || !conversation.isParticipant(userId)) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Cannot join this conversation" });
      }
      return;
    }

    // Join the room
    socketManager.joinConversation(socket.id, conversationId);

    if (typeof callback === "function") {
      callback({ success: true });
    }

    logger.debug(`User ${userId} joined conversation room ${conversationId}`);
  } catch (error) {
    handleSocketError(socket, error, "conversation:join");
    if (typeof callback === "function") {
      callback({ success: false, error: "Failed to join conversation" });
    }
  }
};

/**
 * Handle leaving a conversation room
 * @param {Object} socket - Socket instance
 * @param {Object} data - Leave data { conversationId }
 * @param {Function} callback - Acknowledgment callback
 */
export const handleLeaveConversation = async (socket, data, callback) => {
  try {
    const { conversationId } = data;

    if (!conversationId) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Conversation ID required" });
      }
      return;
    }

    // Leave the room
    socketManager.leaveConversation(socket.id, conversationId);

    if (typeof callback === "function") {
      callback({ success: true });
    }

    logger.debug(
      `User ${socket.userId} left conversation room ${conversationId}`
    );
  } catch (error) {
    handleSocketError(socket, error, "conversation:leave");
    if (typeof callback === "function") {
      callback({ success: false, error: "Failed to leave conversation" });
    }
  }
};

export default {
  handleUserConnect,
  handleUserDisconnect,
  handleStatusUpdate,
  handleGetOnlineStatus,
  handleHeartbeat,
  handleJoinConversation,
  handleLeaveConversation,
};
