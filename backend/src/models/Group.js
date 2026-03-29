/**
 * Group Model
 * Represents WhatsApp-style group chats.
 */

import mongoose from "mongoose";

const generateInviteLinkToken = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Group name is required"],
      trim: true,
      minlength: [2, "Group name must be at least 2 characters"],
      maxlength: [100, "Group name cannot exceed 100 characters"],
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
      default: "",
    },
    avatar: {
      type: String,
      trim: true,
      default: "",
    },
    inviteLink: {
      type: String,
      trim: true,
      unique: true,
      default: generateInviteLinkToken,
      index: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Created by is required"],
      index: true,
    },
    joinFeeEth: {
      type: Number,
      min: 0,
      default: 0,
    },
    onChainRegistered: {
      type: Boolean,
      default: false,
      index: true,
    },
    blockchainTxHash: {
      type: String,
      trim: true,
      default: "",
    },
    lastMessage: {
      content: {
        type: String,
        default: "",
      },
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
      type: {
        type: String,
        enum: ["text", "image", "file"],
        default: "text",
      },
    },
    lastAnchor: {
      txHash: {
        type: String,
        trim: true,
        default: "",
      },
      merkleRoot: {
        type: String,
        trim: true,
        default: "",
      },
      anchoredAt: {
        type: Date,
        default: null,
      },
      messageCount: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id;
        ret.memberCount = Array.isArray(ret.members) ? ret.members.length : 0;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  },
);

groupSchema.index({ members: 1, isActive: 1 });
groupSchema.index({ updatedAt: -1 });
groupSchema.index({ name: "text", description: "text" });

groupSchema.statics.getUserGroups = function (userId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;

  return this.find({
    members: userId,
    isActive: true,
  })
    .populate("members", "username firstName lastName avatar status lastSeen")
    .populate("admins", "username firstName lastName avatar")
    .populate("createdBy", "username firstName lastName avatar")
    .populate("lastMessage.sender", "username firstName lastName avatar")
    .sort({ "lastMessage.timestamp": -1, updatedAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

groupSchema.methods.isMember = function (userId) {
  return this.members.some(
    (member) =>
      member.toString() === userId.toString() ||
      member._id?.toString() === userId.toString(),
  );
};

groupSchema.methods.isAdmin = function (userId) {
  return this.admins.some(
    (admin) =>
      admin.toString() === userId.toString() ||
      admin._id?.toString() === userId.toString(),
  );
};

groupSchema.methods.updateLastMessage = async function (message) {
  this.lastMessage = {
    content:
      message.type === "text"
        ? message.content.substring(0, 100)
        : `[${message.type}]`,
    sender: message.sender,
    timestamp: message.createdAt || new Date(),
    type: message.type || "text",
  };

  await this.save();
  return this;
};

const Group = mongoose.model("Group", groupSchema);

export default Group;
