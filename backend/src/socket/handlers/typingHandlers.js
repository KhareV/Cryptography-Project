/**
 * Socket.io Typing Event Handlers
 * Handles typing indicator events
 */

import Conversation from "../../models/Conversation.js";
import { socketManager } from "../../utils/socketManager.js";
import { logger } from "../../utils/helpers.js";
import { handleSocketError } from "../../middleware/errorHandler.js";

// Typing indicator timeout (3 seconds)
const TYPING_TIMEOUT = 3000;

/**
 * Handle typing start event
 * @param {Object} socket - Socket instance
 * @param {Object} data - Event data { conversationId }
 * @param {Function} callback - Acknowledgment callback
 */
export const handleTypingStart = async (socket, data, callback) => {
  try {
    const { conversationId } = data;
    const userId = socket.userId;

    if (!conversationId) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Conversation ID required" });
      }
      return;
    }

    // Verify user is participant in conversation
    const conversation = await Conversation.findById(conversationId).populate(
      "participants",
      "_id"
    );

    if (!conversation) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Conversation not found" });
      }
      return;
    }

    if (!conversation.isParticipant(userId)) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Not a participant" });
      }
      return;
    }

    // Set typing indicator
    socketManager.setTyping(conversationId, userId, TYPING_TIMEOUT);

    // Emit to other participants
    for (const participant of conversation.participants) {
      const participantId = participant._id.toString();

      if (
        participantId !== userId &&
        socketManager.isUserOnline(participantId)
      ) {
        socketManager.emitToUser(participantId, "typing:start", {
          conversationId: conversationId.toString(),
          userId,
          user: socket.user,
        });
      }
    }

    if (typeof callback === "function") {
      callback({ success: true });
    }

    logger.debug(
      `User ${userId} started typing in conversation ${conversationId}`
    );
  } catch (error) {
    handleSocketError(socket, error, "typing:start");
    if (typeof callback === "function") {
      callback({ success: false, error: "Failed to send typing indicator" });
    }
  }
};

/**
 * Handle typing stop event
 * @param {Object} socket - Socket instance
 * @param {Object} data - Event data { conversationId }
 * @param {Function} callback - Acknowledgment callback
 */
export const handleTypingStop = async (socket, data, callback) => {
  try {
    const { conversationId } = data;
    const userId = socket.userId;

    if (!conversationId) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Conversation ID required" });
      }
      return;
    }

    // Clear typing indicator
    socketManager.clearTyping(conversationId, userId);

    // Verify conversation and emit to participants
    const conversation = await Conversation.findById(conversationId).populate(
      "participants",
      "_id"
    );

    if (conversation) {
      for (const participant of conversation.participants) {
        const participantId = participant._id.toString();

        if (
          participantId !== userId &&
          socketManager.isUserOnline(participantId)
        ) {
          socketManager.emitToUser(participantId, "typing:stop", {
            conversationId: conversationId.toString(),
            userId,
          });
        }
      }
    }

    if (typeof callback === "function") {
      callback({ success: true });
    }

    logger.debug(
      `User ${userId} stopped typing in conversation ${conversationId}`
    );
  } catch (error) {
    handleSocketError(socket, error, "typing:stop");
    if (typeof callback === "function") {
      callback({ success: false, error: "Failed to clear typing indicator" });
    }
  }
};

/**
 * Get current typing users in a conversation
 * @param {Object} socket - Socket instance
 * @param {Object} data - Event data { conversationId }
 * @param {Function} callback - Acknowledgment callback
 */
export const handleGetTypingUsers = async (socket, data, callback) => {
  try {
    const { conversationId } = data;

    if (!conversationId) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Conversation ID required" });
      }
      return;
    }

    const typingUsers = socketManager.getTypingUsers(conversationId);

    if (typeof callback === "function") {
      callback({
        success: true,
        typingUsers,
      });
    }
  } catch (error) {
    handleSocketError(socket, error, "typing:get");
    if (typeof callback === "function") {
      callback({ success: false, error: "Failed to get typing users" });
    }
  }
};

export default {
  handleTypingStart,
  handleTypingStop,
  handleGetTypingUsers,
};
