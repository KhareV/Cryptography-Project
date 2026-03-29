/**
 * Socket. io Message Event Handlers
 * Handles real-time message sending, delivery, and read receipts
 */

import Message from "../../models/Message.js";
import Conversation from "../../models/Conversation.js";
import { socketManager } from "../../utils/socketManager.js";
import { logger } from "../../utils/helpers.js";
import { validateSocketMessage } from "../../middleware/validators.js";
import { handleSocketError } from "../../middleware/errorHandler.js";

const getReplyContent = (replyMessage) => {
  if (!replyMessage) {
    return "";
  }

  if (replyMessage.isEncrypted) {
    return "[Encrypted message]";
  }

  return replyMessage.content;
};

/**
 * Handle sending a new message
 * @param {Object} socket - Socket instance
 * @param {Object} data - Message data
 * @param {Function} callback - Acknowledgment callback
 */
export const handleSendMessage = async (socket, data, callback) => {
  try {
    // Validate message data
    const validation = validateSocketMessage(data);
    if (!validation.isValid) {
      if (typeof callback === "function") {
        callback({ success: false, error: validation.errors.join(", ") });
      }
      return;
    }

    const { conversationId, content, type, replyTo, e2ee } =
      validation.sanitizedData;
    const senderId = socket.userId;

    // Verify conversation exists and user is participant
    const conversation = await Conversation.findById(conversationId).populate(
      "participants",
      "_id username firstName lastName avatar status",
    );

    if (!conversation) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Conversation not found" });
      }
      return;
    }

    if (!conversation.isParticipant(senderId)) {
      if (typeof callback === "function") {
        callback({
          success: false,
          error: "Not a participant in this conversation",
        });
      }
      return;
    }

    const isDirectTextMessage =
      conversation.type === "direct" &&
      (type || "text") === "text" &&
      typeof content === "string" &&
      content.trim().length > 0;

    const isE2EEMessage =
      isDirectTextMessage &&
      Boolean(e2ee && typeof e2ee === "object") &&
      e2ee.format === "e2ee-v1";

    if (isDirectTextMessage && !isE2EEMessage) {
      if (typeof callback === "function") {
        callback({
          success: false,
          error: "Direct text messages must be end-to-end encrypted",
        });
      }
      return;
    }

    const encryptionData = isE2EEMessage
      ? {
          isEncrypted: true,
          encryption: {
            format: "e2ee-v1",
            algorithm: e2ee.algorithm || "AES-256-GCM",
            keyExchange: e2ee.keyExchange || "RSA-OAEP-SHA-256",
            iv: e2ee.iv || "",
            senderWrappedKey: e2ee.senderWrappedKey || "",
            recipientWrappedKey: e2ee.recipientWrappedKey || "",
            senderId: e2ee.senderId || senderId,
            recipientId: e2ee.recipientId || "",
            senderFingerprint: e2ee.senderFingerprint || "",
            recipientFingerprint: e2ee.recipientFingerprint || "",
            encryptedAt: new Date(),
          },
        }
      : {};

    // Create the message
    const message = await Message.create({
      conversationId,
      sender: senderId,
      content,
      type: type || "text",
      replyTo: replyTo || null,
      status: "sent",
      fileUrl: data.fileUrl || null,
      fileMetadata: data.fileMetadata || null,
      ...encryptionData,
    });

    // Populate sender information
    await message.populate(
      "sender",
      "clerkId username firstName lastName avatar",
    );

    // Populate reply if exists
    if (message.replyTo) {
      await message.populate({
        path: "replyTo",
        select: "content sender type isEncrypted encryption",
        populate: {
          path: "sender",
          select: "username firstName lastName",
        },
      });
    }

    // Update conversation preview using plaintext for encrypted direct messages.
    await conversation.updateLastMessage({
      sender: senderId,
      type: message.type,
      content: message.isEncrypted ? "[Encrypted message]" : message.content,
      createdAt: message.createdAt,
    });

    // Prepare message for emission
    const messageData = {
      id: message._id.toString(),
      conversationId: conversationId.toString(),
      sender: {
        id: message.sender._id.toString(),
        clerkId: message.sender.clerkId,
        username: message.sender.username,
        firstName: message.sender.firstName,
        lastName: message.sender.lastName,
        avatar: message.sender.avatar,
      },
      content: message.content,
      isEncrypted: Boolean(message.isEncrypted),
      encryption: message.encryption || null,
      type: message.type,
      status: message.status,
      fileUrl: message.fileUrl,
      fileMetadata: message.fileMetadata,
      replyTo: message.replyTo
        ? {
            id: message.replyTo._id.toString(),
            content: getReplyContent(message.replyTo),
            sender: message.replyTo.sender,
            type: message.replyTo.type,
          }
        : null,
      createdAt: message.createdAt.toISOString(),
    };

    // Send acknowledgment to sender
    if (typeof callback === "function") {
      callback({ success: true, message: messageData });
    }

    // Emit to all participants except sender
    for (const participant of conversation.participants) {
      const participantId = participant._id.toString();

      if (participantId !== senderId) {
        // Emit new message event
        socketManager.emitToUser(participantId, "message:new", messageData);

        // If recipient is online, mark as delivered
        if (socketManager.isUserOnline(participantId)) {
          await message.markDelivered(participantId);

          // Notify sender of delivery
          socketManager.emitToUser(senderId, "message:delivered", {
            messageId: message._id.toString(),
            conversationId: conversationId.toString(),
            deliveredTo: participantId,
            deliveredAt: new Date().toISOString(),
          });
        }

        // Emit conversation update for unread count
        socketManager.emitToUser(participantId, "conversation:updated", {
          conversationId: conversationId.toString(),
          lastMessage: {
            content:
              message.type === "text"
                ? (message.isEncrypted
                    ? "[Encrypted message]"
                    : message.content
                  ).substring(0, 100)
                : `[${message.type}]`,
            sender: messageData.sender,
            timestamp: message.createdAt.toISOString(),
            type: message.type,
          },
          unreadCount: conversation.getUnreadCount(participantId),
        });
      }
    }

    logger.debug(
      `Message sent in conversation ${conversationId} by ${senderId}`,
    );
  } catch (error) {
    handleSocketError(socket, error, "message:send");
    if (typeof callback === "function") {
      callback({ success: false, error: "Failed to send message" });
    }
  }
};

/**
 * Handle marking a message as read
 * @param {Object} socket - Socket instance
 * @param {Object} data - Message data { messageId, conversationId }
 * @param {Function} callback - Acknowledgment callback
 */
export const handleMarkMessageRead = async (socket, data, callback) => {
  try {
    const { messageId, conversationId } = data;
    const userId = socket.userId;

    if (!messageId || !conversationId) {
      if (typeof callback === "function") {
        callback({
          success: false,
          error: "Message ID and Conversation ID required",
        });
      }
      return;
    }

    // Find and update the message
    const message = await Message.findById(messageId);

    if (!message) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Message not found" });
      }
      return;
    }

    // Mark as read
    await message.markRead(userId);

    // Notify the sender that their message was read
    const senderId = message.sender.toString();
    if (senderId !== userId && socketManager.isUserOnline(senderId)) {
      socketManager.emitToUser(senderId, "message:read", {
        messageId: message._id.toString(),
        conversationId: conversationId.toString(),
        readBy: userId,
        readAt: new Date().toISOString(),
      });
    }

    if (typeof callback === "function") {
      callback({ success: true });
    }

    logger.debug(`Message ${messageId} marked as read by ${userId}`);
  } catch (error) {
    handleSocketError(socket, error, "message:read");
    if (typeof callback === "function") {
      callback({ success: false, error: "Failed to mark message as read" });
    }
  }
};

/**
 * Handle marking all messages in a conversation as read
 * @param {Object} socket - Socket instance
 * @param {Object} data - Conversation data { conversationId }
 * @param {Function} callback - Acknowledgment callback
 */
export const handleMarkConversationRead = async (socket, data, callback) => {
  try {
    const { conversationId } = data;
    const userId = socket.userId;

    if (!conversationId) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Conversation ID required" });
      }
      return;
    }

    // Find the conversation
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Conversation not found" });
      }
      return;
    }

    // Mark conversation as read for user
    await conversation.markAsRead(userId);

    // Find all unread messages and mark them as read
    const unreadMessages = await Message.find({
      conversationId,
      sender: { $ne: userId },
      "readBy.user": { $ne: userId },
      isDeleted: false,
    });

    // Collect sender IDs to notify
    const senderIds = new Set();

    for (const message of unreadMessages) {
      await message.markRead(userId);
      senderIds.add(message.sender.toString());
    }

    // Notify senders that their messages were read
    const readAt = new Date().toISOString();
    for (const senderId of senderIds) {
      if (socketManager.isUserOnline(senderId)) {
        socketManager.emitToUser(senderId, "conversation:read", {
          conversationId: conversationId.toString(),
          readBy: userId,
          readAt,
          messageCount: unreadMessages.length,
        });
      }
    }

    if (typeof callback === "function") {
      callback({
        success: true,
        messagesMarked: unreadMessages.length,
      });
    }

    logger.debug(`Conversation ${conversationId} marked as read by ${userId}`);
  } catch (error) {
    handleSocketError(socket, error, "conversation:read");
    if (typeof callback === "function") {
      callback({
        success: false,
        error: "Failed to mark conversation as read",
      });
    }
  }
};

/**
 * Handle message deletion
 * @param {Object} socket - Socket instance
 * @param {Object} data - Delete data { messageId, deleteForEveryone }
 * @param {Function} callback - Acknowledgment callback
 */
export const handleDeleteMessage = async (socket, data, callback) => {
  try {
    const { messageId, deleteForEveryone } = data;
    const userId = socket.userId;

    if (!messageId) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Message ID required" });
      }
      return;
    }

    const message = await Message.findById(messageId);

    if (!message) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Message not found" });
      }
      return;
    }

    // Get conversation to notify participants
    const conversation = await Conversation.findById(
      message.conversationId,
    ).populate("participants", "_id");

    if (deleteForEveryone) {
      // Only sender can delete for everyone
      if (message.sender.toString() !== userId) {
        if (typeof callback === "function") {
          callback({
            success: false,
            error: "Only sender can delete for everyone",
          });
        }
        return;
      }

      await message.deleteForEveryone(userId);

      // Notify all participants
      for (const participant of conversation.participants) {
        const participantId = participant._id.toString();
        socketManager.emitToUser(participantId, "message:deleted", {
          messageId: message._id.toString(),
          conversationId: conversation._id.toString(),
          deletedForEveryone: true,
        });
      }
    } else {
      // Delete for self only
      await message.deleteFor(userId);
    }

    if (typeof callback === "function") {
      callback({ success: true });
    }

    logger.debug(`Message ${messageId} deleted by ${userId}`);
  } catch (error) {
    handleSocketError(socket, error, "message:delete");
    if (typeof callback === "function") {
      callback({ success: false, error: "Failed to delete message" });
    }
  }
};

/**
 * Handle message reaction
 * @param {Object} socket - Socket instance
 * @param {Object} data - Reaction data { messageId, emoji }
 * @param {Function} callback - Acknowledgment callback
 */
export const handleMessageReaction = async (socket, data, callback) => {
  try {
    const { messageId, emoji } = data;
    const userId = socket.userId;

    if (!messageId) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Message ID required" });
      }
      return;
    }

    const message = await Message.findById(messageId);

    if (!message) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Message not found" });
      }
      return;
    }

    if (emoji) {
      await message.addReaction(userId, emoji);
    } else {
      await message.removeReaction(userId);
    }

    // Get conversation to notify participants
    const conversation = await Conversation.findById(
      message.conversationId,
    ).populate("participants", "_id");

    // Notify all participants of the reaction
    for (const participant of conversation.participants) {
      const participantId = participant._id.toString();
      socketManager.emitToUser(participantId, "message:reaction", {
        messageId: message._id.toString(),
        conversationId: conversation._id.toString(),
        userId,
        emoji: emoji || null,
        action: emoji ? "add" : "remove",
      });
    }

    if (typeof callback === "function") {
      callback({ success: true });
    }
  } catch (error) {
    handleSocketError(socket, error, "message:reaction");
    if (typeof callback === "function") {
      callback({ success: false, error: "Failed to update reaction" });
    }
  }
};

export default {
  handleSendMessage,
  handleMarkMessageRead,
  handleMarkConversationRead,
  handleDeleteMessage,
  handleMessageReaction,
};
