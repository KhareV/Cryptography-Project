/**
 * Conversation Model
 * Represents a chat conversation between two or more users
 */

import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    // Participants in the conversation
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],

    // Conversation type (direct message or group)
    type: {
      type: String,
      enum: ["direct", "group"],
      default: "direct",
      index: true,
    },

    // Group name (only for group conversations)
    groupName: {
      type: String,
      trim: true,
      maxlength: [100, "Group name cannot exceed 100 characters"],
    },

    // Group avatar (only for group conversations)
    groupAvatar: {
      type: String,
      trim: true,
    },

    // Group admin (only for group conversations)
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Last message preview for quick display
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

    // Unread message count per user
    unreadCount: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        count: {
          type: Number,
          default: 0,
        },
      },
    ],

    // Conversation status
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    // Deleted for specific users (soft delete per user)
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Pinned for specific users
    pinnedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Muted for specific users with expiry
    mutedFor: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        until: {
          type: Date,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        // Convert unreadCount array to object
        if (Array.isArray(ret.unreadCount)) {
          const unreadObj = {};
          ret.unreadCount.forEach((item) => {
            if (item.user) {
              unreadObj[item.user.toString()] = item.count || 0;
            }
          });
          ret.unreadCount = unreadObj;
        }
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

// Indexes for efficient queries
conversationSchema.index({ participants: 1 });
conversationSchema.index({ "lastMessage.timestamp": -1 });
conversationSchema.index({ updatedAt: -1 });
conversationSchema.index({ participants: 1, isActive: 1 });

// Static method to find direct conversation between two users
conversationSchema.statics.findDirectConversation = function (
  userId1,
  userId2
) {
  return this.findOne({
    type: "direct",
    participants: { $all: [userId1, userId2], $size: 2 },
    isActive: true,
  });
};

// Static method to get user's conversations with populated data
conversationSchema.statics.getUserConversations = function (
  userId,
  page = 1,
  limit = 20
) {
  const skip = (page - 1) * limit;

  return this.find({
    participants: userId,
    isActive: true,
    deletedFor: { $ne: userId },
  })
    .populate({
      path: "participants",
      select: "username firstName lastName avatar status lastSeen",
    })
    .populate({
      path: "lastMessage.sender",
      select: "username firstName lastName avatar",
    })
    .sort({ "lastMessage.timestamp": -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

// Static method to create or get direct conversation
conversationSchema.statics.findOrCreateDirect = async function (
  userId1,
  userId2
) {
  let conversation = await this.findOne({
    type: "direct",
    participants: { $all: [userId1, userId2], $size: 2 },
    isActive: true,
  });

  if (!conversation) {
    conversation = await this.create({
      type: "direct",
      participants: [userId1, userId2],
      unreadCount: [
        { user: userId1, count: 0 },
        { user: userId2, count: 0 },
      ],
    });

    // Populate for response
    conversation = await this.findById(conversation._id).populate({
      path: "participants",
      select: "username firstName lastName avatar status lastSeen",
    });
  }

  return conversation;
};

// Instance method to update last message
conversationSchema.methods.updateLastMessage = async function (message) {
  this.lastMessage = {
    content:
      message.type === "text"
        ? message.content.substring(0, 100)
        : `[${message.type}]`,
    sender: message.sender,
    timestamp: message.createdAt || new Date(),
    type: message.type,
  };

  // Increment unread count for all participants except sender
  for (const participantId of this.participants) {
    const participantKey = participantId.toString();
    if (participantKey !== message.sender.toString()) {
      const unreadEntry = this.unreadCount.find(
        (entry) => entry.user && entry.user.toString() === participantKey
      );
      if (unreadEntry) {
        unreadEntry.count += 1;
      } else {
        this.unreadCount.push({ user: participantId, count: 1 });
      }
    }
  }

  await this.save();
  return this;
};

// Instance method to mark as read for a user
conversationSchema.methods.markAsRead = async function (userId) {
  const userKey = userId.toString();
  const unreadEntry = this.unreadCount.find(
    (entry) => entry.user && entry.user.toString() === userKey
  );
  if (unreadEntry) {
    unreadEntry.count = 0;
  } else {
    this.unreadCount.push({ user: userId, count: 0 });
  }
  await this.save();
  return this;
};

// Instance method to get unread count for a user
conversationSchema.methods.getUnreadCount = function (userId) {
  const unreadEntry = this.unreadCount.find(
    (entry) => entry.user && entry.user.toString() === userId.toString()
  );
  return unreadEntry ? unreadEntry.count : 0;
};

// Instance method to check if user is participant
conversationSchema.methods.isParticipant = function (userId) {
  return this.participants.some(
    (p) =>
      p.toString() === userId.toString() ||
      p._id?.toString() === userId.toString()
  );
};

// Instance method to add participant (for groups)
conversationSchema.methods.addParticipant = async function (userId) {
  if (!this.isParticipant(userId)) {
    this.participants.push(userId);
    this.unreadCount.push({ user: userId, count: 0 });
    await this.save();
  }
  return this;
};

// Instance method to remove participant (for groups)
conversationSchema.methods.removeParticipant = async function (userId) {
  this.participants = this.participants.filter(
    (p) => p.toString() !== userId.toString()
  );
  this.unreadCount = this.unreadCount.filter(
    (entry) => entry.user.toString() !== userId.toString()
  );
  await this.save();
  return this;
};

// Pre-save validation
conversationSchema.pre("save", function (next) {
  // Direct conversations must have exactly 2 participants
  if (this.type === "direct" && this.participants.length !== 2) {
    return next(
      new Error("Direct conversations must have exactly 2 participants")
    );
  }

  // Group conversations must have at least 2 participants
  if (this.type === "group" && this.participants.length < 2) {
    return next(
      new Error("Group conversations must have at least 2 participants")
    );
  }

  next();
});

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
