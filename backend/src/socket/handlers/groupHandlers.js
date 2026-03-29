/**
 * Socket.io Group Event Handlers
 * Handles real-time group room joins/leaves, group creation, and messaging.
 */

import Group from "../../models/Group.js";
import Message from "../../models/Message.js";
import User from "../../models/User.js";
import { socketManager } from "../../utils/socketManager.js";
import { handleSocketError } from "../../middleware/errorHandler.js";

const serializeMessage = (message) => ({
  id: message._id.toString(),
  groupId: message.groupId.toString(),
  sender: {
    id: message.sender._id.toString(),
    clerkId: message.sender.clerkId,
    username: message.sender.username,
    firstName: message.sender.firstName,
    lastName: message.sender.lastName,
    avatar: message.sender.avatar,
  },
  content: message.content,
  type: message.type,
  status: message.status,
  fileUrl: message.fileUrl,
  fileMetadata: message.fileMetadata,
  replyTo: message.replyTo || null,
  createdAt: message.createdAt.toISOString(),
  updatedAt: message.updatedAt.toISOString(),
});

export const handleGroupCreate = async (socket, data, callback) => {
  try {
    const creatorId = socket.userId;
    const { name, description = "", avatar = "", memberIds = [] } = data || {};

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Valid group name is required" });
      }
      return;
    }

    const allMemberIds = [...new Set([creatorId, ...memberIds])];
    const members = await User.find({
      _id: { $in: allMemberIds },
      isActive: true,
    }).select("_id");

    if (members.length !== allMemberIds.length) {
      if (typeof callback === "function") {
        callback({ success: false, error: "One or more members not found" });
      }
      return;
    }

    const group = await Group.create({
      name: name.trim(),
      description,
      avatar,
      members: allMemberIds,
      admins: [creatorId],
      createdBy: creatorId,
    });

    const groupId = group._id.toString();
    allMemberIds.forEach((memberId) => {
      const sockets = socketManager.getUserSockets(memberId);
      sockets.forEach((socketId) => socketManager.joinGroup(socketId, groupId));
    });

    const payload = {
      id: groupId,
      name: group.name,
      description: group.description,
      avatar: group.avatar,
      memberCount: group.members.length,
      createdBy: creatorId,
      admins: group.admins.map((admin) => admin.toString()),
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };

    allMemberIds.forEach((memberId) => {
      socketManager.emitToUser(memberId, "group:updated", {
        action: "created",
        group: payload,
      });
    });

    if (typeof callback === "function") {
      callback({ success: true, group: payload });
    }
  } catch (error) {
    handleSocketError(socket, error, "group:create");
    if (typeof callback === "function") {
      callback({ success: false, error: "Failed to create group" });
    }
  }
};

export const handleGroupJoin = async (socket, data, callback) => {
  try {
    const { groupId } = data || {};
    const userId = socket.userId;

    if (!groupId) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Group ID required" });
      }
      return;
    }

    const group = await Group.findById(groupId).select("members isActive");
    if (!group || !group.isActive || !group.isMember(userId)) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Cannot join this group" });
      }
      return;
    }

    socketManager.joinGroup(socket.id, groupId);

    if (typeof callback === "function") {
      callback({ success: true, groupId });
    }
  } catch (error) {
    handleSocketError(socket, error, "group:join");
    if (typeof callback === "function") {
      callback({ success: false, error: "Failed to join group" });
    }
  }
};

export const handleGroupLeave = async (socket, data, callback) => {
  try {
    const { groupId } = data || {};

    if (!groupId) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Group ID required" });
      }
      return;
    }

    socketManager.leaveGroup(socket.id, groupId);

    if (typeof callback === "function") {
      callback({ success: true, groupId });
    }
  } catch (error) {
    handleSocketError(socket, error, "group:leave");
    if (typeof callback === "function") {
      callback({ success: false, error: "Failed to leave group" });
    }
  }
};

export const handleGroupSendMessage = async (socket, data, callback) => {
  try {
    const userId = socket.userId;
    const {
      groupId,
      content = "",
      type = "text",
      replyTo = null,
      fileUrl = null,
      fileMetadata = null,
    } = data || {};

    if (!groupId) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Group ID required" });
      }
      return;
    }

    const textContent = typeof content === "string" ? content.trim() : "";
    if (!textContent && !fileUrl) {
      if (typeof callback === "function") {
        callback({
          success: false,
          error: "Message content or fileUrl is required",
        });
      }
      return;
    }

    const group = await Group.findById(groupId).select("members isActive");
    if (!group || !group.isActive || !group.isMember(userId)) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Cannot send to this group" });
      }
      return;
    }

    const message = await Message.create({
      groupId,
      sender: userId,
      content: textContent || fileUrl,
      type,
      replyTo,
      fileUrl,
      fileMetadata,
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

    const groupForUpdate = await Group.findById(groupId);
    await groupForUpdate.updateLastMessage(message);

    const messageData = serializeMessage(message);

    socketManager.emitToGroup(groupId, "group:message:new", messageData);

    if (typeof callback === "function") {
      callback({ success: true, message: messageData });
    }
  } catch (error) {
    handleSocketError(socket, error, "group:message:send");
    if (typeof callback === "function") {
      callback({ success: false, error: "Failed to send group message" });
    }
  }
};

export default {
  handleGroupCreate,
  handleGroupJoin,
  handleGroupLeave,
  handleGroupSendMessage,
};
