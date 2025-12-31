/**
 * Conversation Routes
 * Handles conversation CRUD operations
 */

import { Router } from "express";
import { clerkMiddleware } from "@clerk/express";
import { requireAuthentication } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  validateConversationId,
  validateCreateConversation,
  validateConversationPagination,
} from "../middleware/validators.js";
import {
  sendSuccess,
  sendError,
  sendPaginated,
  ApiError,
} from "../utils/helpers.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { socketManager } from "../utils/socketManager.js";

const router = Router();

// Apply Clerk middleware
router.use(clerkMiddleware());

/**
 * GET /api/conversations
 * Get all conversations for the current user
 */
router.get(
  "/",
  requireAuthentication,
  validateConversationPagination,
  asyncHandler(async (req, res) => {
    const userId = req.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    // Get conversations
    const conversations = await Conversation.getUserConversations(
      userId,
      page,
      limit
    );

    // Get total count
    const total = await Conversation.countDocuments({
      participants: userId,
      isActive: true,
      deletedFor: { $ne: userId },
    });

    // Add online status and format response
    const formattedConversations = conversations.map((conv) => {
      // For direct conversations, get the other participant
      let otherParticipant = null;
      if (conv.type === "direct") {
        otherParticipant = conv.participants.find(
          (p) => p._id.toString() !== userId.toString()
        );
      }

      return {
        id: conv._id,
        type: conv.type,
        participants: conv.participants,
        otherParticipant: otherParticipant
          ? {
              ...otherParticipant,
              isOnline: socketManager.isUserOnline(
                otherParticipant._id.toString()
              ),
            }
          : null,
        groupName: conv.groupName,
        groupAvatar: conv.groupAvatar,
        lastMessage: conv.lastMessage,
        unreadCount:
          conv.unreadCount?.get?.(userId.toString()) ||
          conv.unreadCount?.[userId.toString()] ||
          0,
        isPinned: conv.pinnedFor?.includes(userId) || false,
        isMuted:
          conv.mutedFor?.some(
            (m) => m.user?.toString() === userId.toString()
          ) || false,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      };
    });

    sendPaginated(res, formattedConversations, page, limit, total);
  })
);

/**
 * GET /api/conversations/: conversationId
 * Get a specific conversation
 */
router.get(
  "/:conversationId",
  requireAuthentication,
  validateConversationId,
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.userId;

    const conversation = await Conversation.findById(conversationId)
      .populate(
        "participants",
        "username firstName lastName avatar status lastSeen"
      )
      .populate(
        "lastMessage.sender",
        "clerkId username firstName lastName avatar"
      )
      .lean();

    if (!conversation) {
      throw new ApiError(404, "Conversation not found");
    }

    // Check if user is participant
    const isParticipant = conversation.participants.some(
      (p) => p._id.toString() === userId.toString()
    );

    if (!isParticipant) {
      throw new ApiError(403, "Not a participant in this conversation");
    }

    // Add online status to participants
    const participantsWithStatus = conversation.participants.map((p) => ({
      ...p,
      isOnline: socketManager.isUserOnline(p._id.toString()),
    }));

    // Get other participant for direct chats
    let otherParticipant = null;
    if (conversation.type === "direct") {
      otherParticipant = participantsWithStatus.find(
        (p) => p._id.toString() !== userId.toString()
      );
    }

    sendSuccess(res, 200, "Conversation retrieved", {
      conversation: {
        id: conversation._id,
        type: conversation.type,
        participants: participantsWithStatus,
        otherParticipant,
        groupName: conversation.groupName,
        groupAvatar: conversation.groupAvatar,
        admin: conversation.admin,
        lastMessage: conversation.lastMessage,
        unreadCount:
          conversation.unreadCount?.get?.(userId.toString()) ||
          conversation.unreadCount?.[userId.toString()] ||
          0,
        isPinned: conversation.pinnedFor?.includes(userId) || false,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    });
  })
);

/**
 * POST /api/conversations
 * Create a new conversation
 */
router.post(
  "/",
  requireAuthentication,
  validateCreateConversation,
  asyncHandler(async (req, res) => {
    const userId = req.userId;
    const { participantIds, type = "direct", groupName } = req.body;

    // Validate participants exist
    const participants = await User.find({
      _id: { $in: participantIds },
      isActive: true,
    });

    if (participants.length !== participantIds.length) {
      throw new ApiError(400, "One or more participants not found");
    }

    // Add current user to participants if not included
    const allParticipantIds = [
      ...new Set([userId.toString(), ...participantIds]),
    ];

    // For direct conversations, check if one already exists
    if (type === "direct") {
      if (allParticipantIds.length !== 2) {
        throw new ApiError(
          400,
          "Direct conversations must have exactly 2 participants"
        );
      }

      const existingConversation = await Conversation.findDirectConversation(
        allParticipantIds[0],
        allParticipantIds[1]
      );

      if (existingConversation) {
        // Return existing conversation
        await existingConversation.populate(
          "participants",
          "username firstName lastName avatar status lastSeen"
        );

        const otherParticipant = existingConversation.participants.find(
          (p) => p._id.toString() !== userId.toString()
        );

        return sendSuccess(res, 200, "Conversation already exists", {
          conversation: {
            id: existingConversation._id,
            type: existingConversation.type,
            participants: existingConversation.participants,
            otherParticipant: {
              ...otherParticipant.toObject(),
              isOnline: socketManager.isUserOnline(
                otherParticipant._id.toString()
              ),
            },
            isExisting: true,
            createdAt: existingConversation.createdAt,
          },
        });
      }
    }

    // Create unread count map
    const unreadCount = new Map();
    allParticipantIds.forEach((id) => unreadCount.set(id.toString(), 0));

    // Create new conversation
    const conversation = await Conversation.create({
      type,
      participants: allParticipantIds,
      groupName: type === "group" ? groupName : undefined,
      admin: type === "group" ? userId : undefined,
      unreadCount,
    });

    // Populate participants
    await conversation.populate(
      "participants",
      "username firstName lastName avatar status lastSeen"
    );

    // Notify other participants via socket
    for (const participantId of allParticipantIds) {
      if (participantId !== userId.toString()) {
        socketManager.emitToUser(participantId, "conversation:new", {
          conversation: {
            id: conversation._id,
            type: conversation.type,
            participants: conversation.participants,
            createdAt: conversation.createdAt,
          },
        });
      }
    }

    const otherParticipant =
      type === "direct"
        ? conversation.participants.find(
            (p) => p._id.toString() !== userId.toString()
          )
        : null;

    sendSuccess(res, 201, "Conversation created", {
      conversation: {
        id: conversation._id,
        type: conversation.type,
        participants: conversation.participants,
        otherParticipant: otherParticipant
          ? {
              ...otherParticipant.toObject(),
              isOnline: socketManager.isUserOnline(
                otherParticipant._id.toString()
              ),
            }
          : null,
        groupName: conversation.groupName,
        admin: conversation.admin,
        createdAt: conversation.createdAt,
      },
    });
  })
);

/**
 * PUT /api/conversations/: conversationId/read
 * Mark conversation as read
 */
router.put(
  "/:conversationId/read",
  requireAuthentication,
  validateConversationId,
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.userId;

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      throw new ApiError(404, "Conversation not found");
    }

    if (!conversation.isParticipant(userId)) {
      throw new ApiError(403, "Not a participant in this conversation");
    }

    // Mark conversation as read
    await conversation.markAsRead(userId);

    // Mark all unread messages as read
    const result = await Message.updateMany(
      {
        conversationId,
        sender: { $ne: userId },
        "readBy.user": { $ne: userId },
        isDeleted: false,
      },
      {
        $push: {
          readBy: { user: userId, readAt: new Date() },
        },
        $set: { status: "read" },
      }
    );

    // Notify senders
    const messages = await Message.find({
      conversationId,
      sender: { $ne: userId },
    }).distinct("sender");

    for (const senderId of messages) {
      if (socketManager.isUserOnline(senderId.toString())) {
        socketManager.emitToUser(senderId.toString(), "conversation:read", {
          conversationId,
          readBy: userId,
          readAt: new Date().toISOString(),
        });
      }
    }

    sendSuccess(res, 200, "Conversation marked as read", {
      messagesMarked: result.modifiedCount,
    });
  })
);

/**
 * PUT /api/conversations/: conversationId/pin
 * Pin/unpin a conversation
 */
router.put(
  "/:conversationId/pin",
  requireAuthentication,
  validateConversationId,
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const { pinned } = req.body;
    const userId = req.userId;

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      throw new ApiError(404, "Conversation not found");
    }

    if (!conversation.isParticipant(userId)) {
      throw new ApiError(403, "Not a participant in this conversation");
    }

    if (pinned) {
      if (!conversation.pinnedFor.includes(userId)) {
        conversation.pinnedFor.push(userId);
      }
    } else {
      conversation.pinnedFor = conversation.pinnedFor.filter(
        (id) => id.toString() !== userId.toString()
      );
    }

    await conversation.save();

    sendSuccess(
      res,
      200,
      pinned ? "Conversation pinned" : "Conversation unpinned"
    );
  })
);

/**
 * DELETE /api/conversations/:conversationId
 * Delete a conversation (soft delete for user)
 */
router.delete(
  "/:conversationId",
  requireAuthentication,
  validateConversationId,
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.userId;

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      throw new ApiError(404, "Conversation not found");
    }

    if (!conversation.isParticipant(userId)) {
      throw new ApiError(403, "Not a participant in this conversation");
    }

    // Soft delete for this user
    if (!conversation.deletedFor.includes(userId)) {
      conversation.deletedFor.push(userId);
      await conversation.save();
    }

    sendSuccess(res, 200, "Conversation deleted");
  })
);

export default router;
