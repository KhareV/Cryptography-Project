/**
 * Group Routes
 * Handles WhatsApp-style group management and group messages.
 */

import { Router } from "express";
import { clerkMiddleware } from "@clerk/express";
import { requireAuthentication } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  validateCreateGroup,
  validateGroupId,
  validateUpdateGroup,
  validateGroupMemberMutation,
  validateGroupJoin,
  validateGroupOnChainRegistration,
  validateGroupMessagePagination,
  validateSendGroupMessage,
} from "../middleware/validators.js";
import {
  sendSuccess,
  sendPaginated,
  ApiError,
  sanitizeInput,
} from "../utils/helpers.js";
import Group from "../models/Group.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { socketManager } from "../utils/socketManager.js";
import {
  getOnChainCommunityMembership,
  verifyCreateCommunityTx,
  verifyJoinCommunityTx,
} from "../utils/blockchainVerify.js";

const router = Router();

router.use(clerkMiddleware());

const serializeGroup = (group, currentUserId) => {
  const members = (group.members || []).map((member) => ({
    id:
      member._id?.toString?.() || member.id?.toString?.() || member.toString(),
    username: member.username,
    firstName: member.firstName,
    lastName: member.lastName,
    avatar: member.avatar,
    status: member.status,
    lastSeen: member.lastSeen,
    isOnline: member._id
      ? socketManager.isUserOnline(member._id.toString())
      : false,
  }));

  const admins = (group.admins || []).map(
    (admin) => admin._id?.toString?.() || admin.toString(),
  );

  const currentUserIdStr = currentUserId.toString();

  return {
    id: group._id?.toString?.() || group.id,
    name: group.name,
    description: group.description,
    avatar: group.avatar,
    joinFeeEth: Number(group.joinFeeEth || 0),
    onChainRegistered: Boolean(group.onChainRegistered),
    blockchainTxHash: group.blockchainTxHash || "",
    members,
    memberCount: members.length,
    admins,
    createdBy:
      group.createdBy?._id?.toString?.() || group.createdBy?.toString?.(),
    isAdmin: admins.includes(currentUserIdStr),
    lastMessage: group.lastMessage,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
};

const serializeMessage = (message) => ({
  id: message._id?.toString?.() || message.id,
  groupId: message.groupId?.toString?.() || message.groupId,
  sender: message.sender,
  content: message.content,
  type: message.type,
  status: message.status,
  fileUrl: message.fileUrl,
  fileMetadata: message.fileMetadata,
  replyTo: message.replyTo,
  reactions: message.reactions,
  isEdited: message.isEdited,
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
});

const joinAllUserSocketsToGroupRoom = (userId, groupId) => {
  const sockets = socketManager.getUserSockets(userId);
  sockets.forEach((socketId) => socketManager.joinGroup(socketId, groupId));
};

const leaveAllUserSocketsFromGroupRoom = (userId, groupId) => {
  const sockets = socketManager.getUserSockets(userId);
  sockets.forEach((socketId) => socketManager.leaveGroup(socketId, groupId));
};

/**
 * GET /api/groups/my
 * Get all groups where current user is a member
 */
router.get(
  "/my",
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const userId = req.userId;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;

    const groups = await Group.getUserGroups(userId, page, limit);
    const total = await Group.countDocuments({
      members: userId,
      isActive: true,
    });

    const data = groups.map((group) => serializeGroup(group, userId));

    sendPaginated(res, data, page, limit, total);
  }),
);

/**
 * GET /api/groups/discover
 * Discover public groups user is not currently in.
 */
router.get(
  "/discover",
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const userId = req.userId;
    const q = sanitizeInput((req.query.q || "").toString().trim());
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

    const query = {
      isActive: true,
      members: { $ne: userId },
    };

    if (q) {
      const regex = new RegExp(q, "i");
      query.$or = [{ name: regex }, { description: regex }];
    }

    const groups = await Group.find(query)
      .populate("createdBy", "username firstName lastName avatar")
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    const data = groups.map((group) => ({
      id: group._id.toString(),
      name: group.name,
      description: group.description,
      avatar: group.avatar,
      joinFeeEth: Number(group.joinFeeEth || 0),
      onChainRegistered: Boolean(group.onChainRegistered),
      blockchainTxHash: group.blockchainTxHash || "",
      memberCount: Array.isArray(group.members) ? group.members.length : 0,
      createdBy: group.createdBy,
      updatedAt: group.updatedAt,
    }));

    sendSuccess(res, 200, "Groups discovered", {
      groups: data,
      count: data.length,
    });
  }),
);

/**
 * POST /api/groups/create
 * Create a new group with selected members.
 */
router.post(
  "/create",
  requireAuthentication,
  validateCreateGroup,
  asyncHandler(async (req, res) => {
    const userId = req.userId;
    const {
      groupId,
      name,
      description = "",
      avatar = "",
      memberIds = [],
      joinFeeEth,
      walletAddress,
      createTxHash,
    } = req.body;
    const normalizedJoinFeeEth = Number(joinFeeEth);

    if (!Number.isFinite(normalizedJoinFeeEth) || normalizedJoinFeeEth <= 0) {
      throw new ApiError(400, "joinFeeEth must be greater than 0");
    }

    if (Array.isArray(memberIds) && memberIds.length > 0) {
      throw new ApiError(
        400,
        "Adding members during creation is disabled. Members must join with on-chain payment.",
      );
    }

    const existingGroup = await Group.findById(groupId).select("_id").lean();
    if (existingGroup) {
      throw new ApiError(
        409,
        "Group ID already exists. Please retry creation.",
      );
    }

    await verifyCreateCommunityTx({
      txHash: createTxHash,
      groupId,
      walletAddress,
      joinFeeEth: normalizedJoinFeeEth,
    });

    const group = await Group.create({
      _id: groupId,
      name,
      description,
      avatar,
      joinFeeEth: normalizedJoinFeeEth,
      members: [userId],
      admins: [userId],
      createdBy: userId,
      onChainRegistered: true,
      blockchainTxHash: createTxHash,
    });

    const user = await User.findById(userId);
    if (user) {
      user.walletAddress = walletAddress.toLowerCase();
      user.blockchainTxHash = createTxHash;
      await user.save();
    }

    const populated = await Group.findById(group._id)
      .populate("members", "username firstName lastName avatar status lastSeen")
      .populate("admins", "username firstName lastName avatar")
      .populate("createdBy", "username firstName lastName avatar")
      .lean();

    joinAllUserSocketsToGroupRoom(userId, group._id.toString());

    const serialized = serializeGroup(populated, userId);

    socketManager.emitToUser(userId, "group:updated", {
      action: "created",
      group: serialized,
    });

    sendSuccess(res, 201, "Group created and registered on-chain", {
      group: serialized,
    });
  }),
);

/**
 * GET /api/groups/:groupId
 * Get group detail.
 */
router.get(
  "/:groupId",
  requireAuthentication,
  validateGroupId,
  asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const userId = req.userId;

    const group = await Group.findById(groupId)
      .populate("members", "username firstName lastName avatar status lastSeen")
      .populate("admins", "username firstName lastName avatar")
      .populate("createdBy", "username firstName lastName avatar")
      .populate("lastMessage.sender", "username firstName lastName avatar")
      .lean();

    if (!group || !group.isActive) {
      throw new ApiError(404, "Group not found");
    }

    const isMember = group.members.some(
      (member) => member._id.toString() === userId.toString(),
    );

    if (!isMember) {
      throw new ApiError(403, "You are not a member of this group");
    }

    sendSuccess(res, 200, "Group retrieved", {
      group: serializeGroup(group, userId),
    });
  }),
);

/**
 * POST /api/groups/:groupId/register-onchain
 * Mark a group as on-chain registered by verifying createCommunity tx.
 */
router.post(
  "/:groupId/register-onchain",
  requireAuthentication,
  validateGroupOnChainRegistration,
  asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const { txHash, walletAddress } = req.body;
    const userId = req.userId;

    const group = await Group.findById(groupId);
    if (!group || !group.isActive) {
      throw new ApiError(404, "Group not found");
    }

    if (!group.isMember(userId) || !group.isAdmin(userId)) {
      throw new ApiError(403, "Only group admins can register on-chain");
    }

    await verifyCreateCommunityTx({
      txHash,
      groupId,
      walletAddress,
      joinFeeEth: Number(group.joinFeeEth || 0),
    });

    group.onChainRegistered = true;
    group.blockchainTxHash = txHash;
    await group.save();

    const user = await User.findById(userId);
    if (user) {
      user.walletAddress = walletAddress.toLowerCase();
      user.blockchainTxHash = txHash;
      await user.save();
    }

    const populated = await Group.findById(groupId)
      .populate("members", "username firstName lastName avatar status lastSeen")
      .populate("admins", "username firstName lastName avatar")
      .populate("createdBy", "username firstName lastName avatar")
      .lean();

    const memberIds = (populated.members || []).map((member) =>
      member._id.toString(),
    );
    const serialized = serializeGroup(populated, userId);

    memberIds.forEach((memberId) => {
      socketManager.emitToUser(memberId, "group:updated", {
        action: "onchain-registered",
        group: serialized,
      });
    });

    sendSuccess(res, 200, "Group registered on-chain", {
      group: serialized,
    });
  }),
);

/**
 * POST /api/groups/:groupId/join
 * Join a group directly or with paid on-chain proof.
 */
router.post(
  "/:groupId/join",
  requireAuthentication,
  validateGroupJoin,
  asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const { walletAddress, joinTxHash } = req.body;
    const userId = req.userId;

    const group = await Group.findById(groupId);
    if (!group || !group.isActive) {
      throw new ApiError(404, "Group not found");
    }

    if (group.isMember(userId)) {
      throw new ApiError(400, "You are already a member of this group");
    }

    const joinFeeEth = Number(group.joinFeeEth || 0);
    if (joinFeeEth <= 0) {
      throw new ApiError(
        409,
        "Group join fee is not configured. Admin must enable paid join.",
      );
    }

    if (!group.onChainRegistered) {
      throw new ApiError(
        409,
        "This paid community is not registered on-chain yet",
      );
    }

    let joinVia = "paid-join";

    if (joinTxHash) {
      await verifyJoinCommunityTx({
        txHash: joinTxHash,
        groupId,
        walletAddress,
        joinFeeEth,
      });
    } else {
      const isMemberOnChain = await getOnChainCommunityMembership(
        groupId,
        walletAddress,
      );

      if (!isMemberOnChain) {
        throw new ApiError(
          409,
          "On-chain payment proof missing. Complete paid join transaction first.",
        );
      }

      joinVia = "paid-join-recovered";
    }

    group.members.push(userId);
    await group.save();

    joinAllUserSocketsToGroupRoom(userId, groupId);

    if (walletAddress) {
      const user = await User.findById(userId);
      if (user) {
        user.walletAddress = walletAddress.toLowerCase();
        user.blockchainTxHash = joinTxHash || user.blockchainTxHash;
        await user.save();
      }
    }

    const populated = await Group.findById(groupId)
      .populate("members", "username firstName lastName avatar status lastSeen")
      .populate("admins", "username firstName lastName avatar")
      .populate("createdBy", "username firstName lastName avatar")
      .lean();

    socketManager.emitToGroup(groupId, "group:member:added", {
      groupId,
      memberId: userId.toString(),
      addedBy: userId.toString(),
      timestamp: new Date().toISOString(),
      via: joinVia,
    });

    socketManager.emitToUser(userId, "group:updated", {
      action: "joined",
      group: serializeGroup(populated, userId),
    });

    sendSuccess(res, 200, "Joined group", {
      group: serializeGroup(populated, userId),
    });
  }),
);

/**
 * POST /api/groups/:groupId/add-member
 * Add a member to group (admin only).
 */
router.post(
  "/:groupId/add-member",
  requireAuthentication,
  validateGroupMemberMutation,
  asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const { memberId } = req.body;
    const userId = req.userId;

    const group = await Group.findById(groupId);
    if (!group || !group.isActive) {
      throw new ApiError(404, "Group not found");
    }

    if (!group.isMember(userId)) {
      throw new ApiError(403, "You are not a member of this group");
    }

    if (!group.isAdmin(userId)) {
      throw new ApiError(403, "Only admins can add members");
    }

    if (Number(group.joinFeeEth || 0) > 0) {
      throw new ApiError(
        409,
        "Paid communities do not support free admin invites. Members must join via paid on-chain join.",
      );
    }

    const member = await User.findOne({
      _id: memberId,
      isActive: true,
    }).select("_id username firstName lastName avatar status lastSeen");

    if (!member) {
      throw new ApiError(404, "Member user not found");
    }

    if (group.isMember(memberId)) {
      throw new ApiError(400, "User is already in this group");
    }

    group.members.push(memberId);
    await group.save();

    joinAllUserSocketsToGroupRoom(memberId, groupId);

    const memberPayload = {
      id: member._id.toString(),
      username: member.username,
      firstName: member.firstName,
      lastName: member.lastName,
      avatar: member.avatar,
      status: member.status,
      lastSeen: member.lastSeen,
      isOnline: socketManager.isUserOnline(member._id.toString()),
    };

    socketManager.emitToGroup(groupId, "group:member:added", {
      groupId,
      member: memberPayload,
      addedBy: userId.toString(),
      timestamp: new Date().toISOString(),
      via: "admin-invite",
    });

    const populated = await Group.findById(groupId)
      .populate("members", "username firstName lastName avatar status lastSeen")
      .populate("admins", "username firstName lastName avatar")
      .populate("createdBy", "username firstName lastName avatar")
      .lean();

    socketManager.emitToUser(memberId, "group:updated", {
      action: "added-to-group",
      group: serializeGroup(populated, memberId),
    });

    sendSuccess(res, 200, "Member added to group", {
      group: serializeGroup(populated, userId),
    });
  }),
);

/**
 * POST /api/groups/:groupId/remove-member
 * Remove a member from group (admin only).
 */
router.post(
  "/:groupId/remove-member",
  requireAuthentication,
  validateGroupMemberMutation,
  asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const { memberId } = req.body;
    const userId = req.userId;

    const group = await Group.findById(groupId);
    if (!group || !group.isActive) {
      throw new ApiError(404, "Group not found");
    }

    if (!group.isMember(userId)) {
      throw new ApiError(403, "You are not a member of this group");
    }

    if (!group.isAdmin(userId)) {
      throw new ApiError(403, "Only admins can remove members");
    }

    if (!group.isMember(memberId)) {
      throw new ApiError(400, "User is not a member of this group");
    }

    if (group.createdBy.toString() === memberId.toString()) {
      throw new ApiError(400, "Group creator cannot be removed");
    }

    group.members = group.members.filter(
      (member) => member.toString() !== memberId.toString(),
    );
    group.admins = group.admins.filter(
      (admin) => admin.toString() !== memberId.toString(),
    );

    await group.save();

    leaveAllUserSocketsFromGroupRoom(memberId, groupId);

    socketManager.emitToGroup(groupId, "group:member:removed", {
      groupId,
      memberId: memberId.toString(),
      removedBy: userId.toString(),
      timestamp: new Date().toISOString(),
    });

    socketManager.emitToUser(memberId, "group:updated", {
      action: "removed-from-group",
      groupId,
    });

    const populated = await Group.findById(groupId)
      .populate("members", "username firstName lastName avatar status lastSeen")
      .populate("admins", "username firstName lastName avatar")
      .populate("createdBy", "username firstName lastName avatar")
      .lean();

    sendSuccess(res, 200, "Member removed from group", {
      group: serializeGroup(populated, userId),
    });
  }),
);

/**
 * PUT /api/groups/:groupId/update
 * Update group name/description/avatar (admin only).
 */
router.put(
  "/:groupId/update",
  requireAuthentication,
  validateUpdateGroup,
  asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const userId = req.userId;

    const group = await Group.findById(groupId);
    if (!group || !group.isActive) {
      throw new ApiError(404, "Group not found");
    }

    if (!group.isMember(userId)) {
      throw new ApiError(403, "You are not a member of this group");
    }

    if (!group.isAdmin(userId)) {
      throw new ApiError(403, "Only admins can update group details");
    }

    const updatableFields = ["name", "description", "avatar"];
    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        group[field] = req.body[field];
      }
    });

    await group.save();

    const populated = await Group.findById(groupId)
      .populate("members", "username firstName lastName avatar status lastSeen")
      .populate("admins", "username firstName lastName avatar")
      .populate("createdBy", "username firstName lastName avatar")
      .lean();

    socketManager.emitToGroup(groupId, "group:updated", {
      action: "updated",
      group: serializeGroup(populated, userId),
      updatedBy: userId.toString(),
    });

    sendSuccess(res, 200, "Group updated", {
      group: serializeGroup(populated, userId),
    });
  }),
);

/**
 * POST /api/groups/:groupId/leave
 * Leave a group.
 */
router.post(
  "/:groupId/leave",
  requireAuthentication,
  validateGroupId,
  asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const userId = req.userId;

    const group = await Group.findById(groupId);
    if (!group || !group.isActive) {
      throw new ApiError(404, "Group not found");
    }

    if (!group.isMember(userId)) {
      throw new ApiError(400, "You are not a member of this group");
    }

    group.members = group.members.filter(
      (member) => member.toString() !== userId.toString(),
    );
    group.admins = group.admins.filter(
      (admin) => admin.toString() !== userId.toString(),
    );

    if (group.members.length === 0) {
      group.isActive = false;
    } else if (group.createdBy.toString() === userId.toString()) {
      group.createdBy = group.members[0];
      if (!group.isAdmin(group.members[0])) {
        group.admins.push(group.members[0]);
      }
    }

    await group.save();

    leaveAllUserSocketsFromGroupRoom(userId, groupId);

    socketManager.emitToGroup(groupId, "group:member:removed", {
      groupId,
      memberId: userId.toString(),
      removedBy: userId.toString(),
      timestamp: new Date().toISOString(),
      reason: "left",
    });

    socketManager.emitToUser(userId, "group:updated", {
      action: "left",
      groupId,
    });

    sendSuccess(res, 200, "You left the group", { groupId });
  }),
);

/**
 * DELETE /api/groups/:groupId/delete
 * Soft-delete group (admin only).
 */
router.delete(
  "/:groupId/delete",
  requireAuthentication,
  validateGroupId,
  asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const userId = req.userId;

    const group = await Group.findById(groupId);
    if (!group || !group.isActive) {
      throw new ApiError(404, "Group not found");
    }

    if (!group.isMember(userId)) {
      throw new ApiError(403, "You are not a member of this group");
    }

    if (!group.isAdmin(userId)) {
      throw new ApiError(403, "Only admins can delete the group");
    }

    group.isActive = false;
    await group.save();

    const memberIds = group.members.map((member) => member.toString());
    memberIds.forEach((memberId) => {
      socketManager.emitToUser(memberId, "group:updated", {
        action: "deleted",
        groupId,
      });
    });

    sendSuccess(res, 200, "Group deleted", { groupId });
  }),
);

/**
 * GET /api/groups/:groupId/messages
 * Get group chat messages with pagination.
 */
router.get(
  "/:groupId/messages",
  requireAuthentication,
  validateGroupMessagePagination,
  asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const userId = req.userId;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;

    const group = await Group.findById(groupId).select("members isActive");
    if (!group || !group.isActive) {
      throw new ApiError(404, "Group not found");
    }

    if (!group.isMember(userId)) {
      throw new ApiError(403, "You are not a member of this group");
    }

    const messages = await Message.getGroupMessages(
      groupId,
      userId,
      page,
      limit,
    );
    const total = await Message.countDocuments({
      groupId,
      isDeleted: false,
      deletedFor: { $ne: userId },
    });

    messages.reverse();

    sendPaginated(res, messages.map(serializeMessage), page, limit, total);
  }),
);

/**
 * POST /api/groups/:groupId/messages
 * Send group message via REST.
 */
router.post(
  "/:groupId/messages",
  requireAuthentication,
  validateSendGroupMessage,
  asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const userId = req.userId;
    const {
      content = "",
      type = "text",
      replyTo,
      fileUrl,
      fileMetadata,
    } = req.body;
    const normalizedContent =
      typeof content === "string" && content.trim().length > 0
        ? content.trim()
        : fileUrl || "";

    const group = await Group.findById(groupId)
      .populate("members", "_id")
      .select("members isActive");

    if (!group || !group.isActive) {
      throw new ApiError(404, "Group not found");
    }

    if (!group.isMember(userId)) {
      throw new ApiError(403, "You are not a member of this group");
    }

    const message = await Message.create({
      groupId,
      sender: userId,
      content: normalizedContent,
      type,
      replyTo: replyTo || null,
      fileUrl: fileUrl || null,
      fileMetadata: fileMetadata || null,
      status: "sent",
    });

    await message.populate(
      "sender",
      "clerkId username firstName lastName avatar",
    );

    if (message.replyTo) {
      await message.populate({
        path: "replyTo",
        select: "content sender type",
        populate: {
          path: "sender",
          select: "clerkId username firstName lastName avatar",
        },
      });
    }

    const fullGroup = await Group.findById(groupId);
    await fullGroup.updateLastMessage(message);

    const messageData = serializeMessage(message);

    socketManager.emitToGroup(groupId, "group:message:new", messageData);

    sendSuccess(res, 201, "Message sent", { message: messageData });
  }),
);

export default router;
