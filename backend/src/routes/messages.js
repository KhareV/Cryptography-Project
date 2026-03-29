/**
 * Message Routes
 * Handles message CRUD operations
 */

import { Router } from "express";
import { clerkMiddleware } from "@clerk/express";
import { requireAuthentication } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { messageLimiter } from "../middleware/rateLimiter.js";
import {
  validateMessagePagination,
  validateSendMessage,
  validateMessageId,
  validateEditMessage,
  validateConversationId,
} from "../middleware/validators.js";
import { sendSuccess, sendPaginated, ApiError } from "../utils/helpers.js";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import { socketManager } from "../utils/socketManager.js";

const router = Router();

// Apply Clerk middleware
router.use(clerkMiddleware());

/**
 * GET /api/messages/: conversationId
 * Get messages for a conversation with pagination
 */
router.get(
  "/:conversationId",
  requireAuthentication,
  validateMessagePagination,
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    // Verify conversation exists and user is participant
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      throw new ApiError(404, "Conversation not found");
    }

    if (!conversation.isParticipant(userId)) {
      throw new ApiError(403, "Not a participant in this conversation");
    }

    // Get messages
    const messages = await Message.getConversationMessages(
      conversationId,
      userId,
      page,
      limit,
    );

    // Get total count
    const total = await Message.countDocuments({
      conversationId,
      isDeleted: false,
      deletedFor: { $ne: userId },
    });

    // Reverse to get chronological order (oldest first)
    messages.reverse();

    // Format messages
    const formattedMessages = messages.map((msg) => ({
      id: msg._id,
      conversationId: msg.conversationId,
      sender: msg.sender,
      content: msg.content,
      isEncrypted: Boolean(msg.isEncrypted),
      encryption: msg.encryption || null,
      type: msg.type,
      fileUrl: msg.fileUrl,
      fileMetadata: msg.fileMetadata,
      status: msg.status,
      readBy: msg.readBy,
      replyTo: msg.replyTo
        ? {
            ...msg.replyTo,
            content: msg.replyTo.content,
            isEncrypted: Boolean(msg.replyTo.isEncrypted),
            encryption: msg.replyTo.encryption || null,
          }
        : msg.replyTo,
      reactions: msg.reactions,
      isEdited: msg.isEdited,
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
    }));

    sendPaginated(res, formattedMessages, page, limit, total);
  }),
);

/**
 * POST /api/messages/: conversationId
 * Send a new message (REST alternative to socket)
 */
router.post(
  "/:conversationId",
  requireAuthentication,
  messageLimiter,
  validateConversationId,
  validateSendMessage,
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const {
      content,
      type = "text",
      replyTo,
      fileUrl,
      fileMetadata,
      e2ee,
    } = req.body;
    const userId = req.userId;

    // Verify conversation
    const conversation = await Conversation.findById(conversationId).populate(
      "participants",
      "_id username firstName lastName avatar",
    );

    if (!conversation) {
      throw new ApiError(404, "Conversation not found");
    }

    if (!conversation.isParticipant(userId)) {
      throw new ApiError(403, "Not a participant in this conversation");
    }

    const isDirectTextMessage =
      conversation.type === "direct" &&
      type === "text" &&
      typeof content === "string" &&
      content.trim().length > 0;

    const isE2EEMessage =
      isDirectTextMessage &&
      Boolean(e2ee && typeof e2ee === "object") &&
      e2ee.format === "e2ee-v1";

    if (isDirectTextMessage && !isE2EEMessage) {
      throw new ApiError(
        400,
        "Direct text messages must be end-to-end encrypted",
      );
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
            senderId: e2ee.senderId || userId.toString(),
            recipientId: e2ee.recipientId || "",
            senderFingerprint: e2ee.senderFingerprint || "",
            recipientFingerprint: e2ee.recipientFingerprint || "",
            encryptedAt: new Date(),
          },
        }
      : {};

    // Create message
    const message = await Message.create({
      conversationId,
      sender: userId,
      content,
      type,
      replyTo: replyTo || null,
      fileUrl: fileUrl || null,
      fileMetadata: fileMetadata || null,
      status: "sent",
      ...encryptionData,
    });

    // Populate sender
    await message.populate(
      "sender",
      "clerkId username firstName lastName avatar",
    );

    // Update conversation using plaintext preview for direct encrypted messages
    await conversation.updateLastMessage({
      sender: userId,
      type: message.type,
      content: message.isEncrypted ? "[Encrypted message]" : message.content,
      createdAt: message.createdAt,
    });

    // Prepare message data
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
      createdAt: message.createdAt.toISOString(),
    };

    // Emit to other participants via socket
    for (const participant of conversation.participants) {
      const participantId = participant._id.toString();

      if (participantId !== userId.toString()) {
        socketManager.emitToUser(participantId, "message:new", messageData);

        // Mark as delivered if online
        if (socketManager.isUserOnline(participantId)) {
          await message.markDelivered(participantId);
        }
      }
    }

    sendSuccess(res, 201, "Message sent", { message: messageData });
  }),
);

/**
 * PUT /api/messages/:messageId/read
 * Mark a specific message as read
 */
router.put(
  "/:messageId/read",
  requireAuthentication,
  validateMessageId,
  asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const userId = req.userId;

    const message = await Message.findById(messageId);

    if (!message) {
      throw new ApiError(404, "Message not found");
    }

    // Verify user is participant in the conversation
    const conversation = await Conversation.findById(message.conversationId);

    if (!conversation || !conversation.isParticipant(userId)) {
      throw new ApiError(403, "Not authorized to access this message");
    }

    // Mark as read
    await message.markRead(userId);

    // Notify sender
    const senderId = message.sender.toString();
    if (
      senderId !== userId.toString() &&
      socketManager.isUserOnline(senderId)
    ) {
      socketManager.emitToUser(senderId, "message:read", {
        messageId: message._id.toString(),
        conversationId: message.conversationId.toString(),
        readBy: userId,
        readAt: new Date().toISOString(),
      });
    }

    sendSuccess(res, 200, "Message marked as read");
  }),
);

/**
 * PUT /api/messages/: messageId
 * Edit a message (sender only)
 */
router.put(
  "/:messageId",
  requireAuthentication,
  validateEditMessage,
  asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.userId;

    const message = await Message.findById(messageId);

    if (!message) {
      throw new ApiError(404, "Message not found");
    }

    // Only sender can edit
    if (message.sender.toString() !== userId.toString()) {
      throw new ApiError(403, "Only the sender can edit this message");
    }

    // Only text messages can be edited
    if (message.type !== "text") {
      throw new ApiError(400, "Only text messages can be edited");
    }

    if (message.isEncrypted) {
      throw new ApiError(400, "Encrypted messages cannot be edited");
    }

    // Edit the message
    await message.editContent(content);

    // Notify participants
    const conversation = await Conversation.findById(
      message.conversationId,
    ).populate("participants", "_id");

    for (const participant of conversation.participants) {
      const participantId = participant._id.toString();
      socketManager.emitToUser(participantId, "message:edited", {
        messageId: message._id.toString(),
        conversationId: message.conversationId.toString(),
        content: message.content,
        isEdited: true,
        editedAt: new Date().toISOString(),
      });
    }

    sendSuccess(res, 200, "Message edited", {
      message: {
        id: message._id,
        content: message.content,
        isEdited: message.isEdited,
        updatedAt: message.updatedAt,
      },
    });
  }),
);

/**
 * DELETE /api/messages/:messageId
 * Delete a message
 */
router.delete(
  "/:messageId",
  requireAuthentication,
  validateMessageId,
  asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const { forEveryone } = req.query;
    const userId = req.userId;

    const message = await Message.findById(messageId);

    if (!message) {
      throw new ApiError(404, "Message not found");
    }

    // Get conversation for notifications
    const conversation = await Conversation.findById(
      message.conversationId,
    ).populate("participants", "_id");

    if (!conversation || !conversation.isParticipant(userId)) {
      throw new ApiError(403, "Not authorized to access this message");
    }

    if (forEveryone === "true") {
      // Only sender can delete for everyone
      if (message.sender.toString() !== userId.toString()) {
        throw new ApiError(403, "Only the sender can delete for everyone");
      }

      await message.deleteForEveryone(userId);

      // Notify all participants
      for (const participant of conversation.participants) {
        socketManager.emitToUser(
          participant._id.toString(),
          "message:deleted",
          {
            messageId: message._id.toString(),
            conversationId: conversation._id.toString(),
            deletedForEveryone: true,
          },
        );
      }
    } else {
      // Delete for self only
      await message.deleteFor(userId);
    }

    sendSuccess(res, 200, "Message deleted");
  }),
);

/**
 * POST /api/messages/: messageId/reaction
 * Add or remove a reaction to a message
 */
router.post(
  "/:messageId/reaction",
  requireAuthentication,
  validateMessageId,
  asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.userId;

    const message = await Message.findById(messageId);

    if (!message) {
      throw new ApiError(404, "Message not found");
    }

    // Verify user is participant
    const conversation = await Conversation.findById(
      message.conversationId,
    ).populate("participants", "_id");

    if (!conversation || !conversation.isParticipant(userId)) {
      throw new ApiError(403, "Not authorized to react to this message");
    }

    if (emoji) {
      await message.addReaction(userId, emoji);
    } else {
      await message.removeReaction(userId);
    }

    // Notify participants
    for (const participant of conversation.participants) {
      socketManager.emitToUser(participant._id.toString(), "message:reaction", {
        messageId: message._id.toString(),
        conversationId: conversation._id.toString(),
        userId,
        emoji: emoji || null,
        action: emoji ? "add" : "remove",
      });
    }

    sendSuccess(res, 200, emoji ? "Reaction added" : "Reaction removed");
  }),
);

export default router;
