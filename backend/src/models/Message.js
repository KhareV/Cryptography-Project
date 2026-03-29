/**
 * Message Model
 * Represents individual messages within conversations
 */

import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    // Reference to direct conversation (for 1:1 and legacy conversation chats)
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      index: true,
    },

    // Reference to group chat
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      index: true,
    },

    // Message sender
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Sender is required"],
      index: true,
    },

    // Message content (text content)
    content: {
      type: String,
      required: [true, "Message content is required"],
      trim: true,
      maxlength: [20000, "Message cannot exceed 20000 characters"],
    },

    // Client-managed E2EE metadata (used for direct 1:1 text messages)
    isEncrypted: {
      type: Boolean,
      default: false,
      index: true,
    },
    encryption: {
      format: {
        type: String,
        default: "",
      },
      algorithm: {
        type: String,
        default: "",
      },
      keyExchange: {
        type: String,
        default: "",
      },
      iv: {
        type: String,
        default: "",
      },
      authTag: {
        type: String,
        default: "",
      },
      senderWrappedKey: {
        type: String,
        default: "",
      },
      recipientWrappedKey: {
        type: String,
        default: "",
      },
      senderId: {
        type: String,
        default: "",
      },
      recipientId: {
        type: String,
        default: "",
      },
      senderFingerprint: {
        type: String,
        default: "",
      },
      recipientFingerprint: {
        type: String,
        default: "",
      },
      keyVersion: {
        type: String,
        default: "",
      },
      encryptedAt: {
        type: Date,
        default: null,
      },
    },

    // Message type
    type: {
      type: String,
      enum: {
        values: ["text", "image", "file"],
        message: "Message type must be text, image, or file",
      },
      default: "text",
      index: true,
    },

    // File URL (for image/file messages)
    fileUrl: {
      type: String,
      trim: true,
    },

    // File metadata
    fileMetadata: {
      originalName: String,
      mimeType: String,
      size: Number,
    },

    // Message delivery status
    status: {
      type: String,
      enum: {
        values: ["sent", "delivered", "read"],
        message: "Status must be sent, delivered, or read",
      },
      default: "sent",
      index: true,
    },

    // Read receipts
    readBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Delivered to users
    deliveredTo: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        deliveredAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Reply to another message
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },

    // Message reactions
    reactions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        emoji: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Edited flag
    isEdited: {
      type: Boolean,
      default: false,
    },

    // Edit history
    editHistory: [
      {
        content: String,
        editedAt: Date,
      },
    ],

    // Soft delete per user
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Global delete flag
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id;
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

// Compound indexes for efficient queries
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, sender: 1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, isDeleted: 1, createdAt: -1 });
messageSchema.index({ groupId: 1, createdAt: -1 });
messageSchema.index({ groupId: 1, sender: 1, createdAt: -1 });

// Ensure exactly one message scope is provided.
messageSchema.pre("validate", function (next) {
  const hasConversation = Boolean(this.conversationId);
  const hasGroup = Boolean(this.groupId);

  if (!hasConversation && !hasGroup) {
    return next(
      new Error("Message must belong to either a conversation or a group"),
    );
  }

  if (hasConversation && hasGroup) {
    return next(
      new Error("Message cannot belong to both a conversation and a group"),
    );
  }

  return next();
});

// Static method to get messages with pagination
messageSchema.statics.getConversationMessages = function (
  conversationId,
  userId,
  page = 1,
  limit = 50,
) {
  const skip = (page - 1) * limit;

  return this.find({
    conversationId,
    isDeleted: false,
    deletedFor: { $ne: userId },
  })
    .populate({
      path: "sender",
      select: "clerkId username firstName lastName avatar",
    })
    .populate({
      path: "replyTo",
      select: "content sender type isEncrypted encryption",
      populate: {
        path: "sender",
        select: "clerkId username firstName lastName",
      },
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

// Static method to get group messages with pagination
messageSchema.statics.getGroupMessages = function (
  groupId,
  userId,
  page = 1,
  limit = 50,
) {
  const skip = (page - 1) * limit;

  return this.find({
    groupId,
    isDeleted: false,
    deletedFor: { $ne: userId },
  })
    .populate({
      path: "sender",
      select: "clerkId username firstName lastName avatar",
    })
    .populate({
      path: "replyTo",
      select: "content sender type isEncrypted encryption",
      populate: {
        path: "sender",
        select: "clerkId username firstName lastName",
      },
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

// Static method to count unread messages in a conversation for a user
messageSchema.statics.countUnread = function (conversationId, userId) {
  return this.countDocuments({
    conversationId,
    sender: { $ne: userId },
    isDeleted: false,
    "readBy.user": { $ne: userId },
  });
};

// Static method to get last message of a conversation
messageSchema.statics.getLastMessage = function (conversationId) {
  return this.findOne({
    conversationId,
    isDeleted: false,
  })
    .sort({ createdAt: -1 })
    .populate({
      path: "sender",
      select: "username firstName lastName avatar",
    })
    .lean();
};

// Instance method to mark as delivered for a user
messageSchema.methods.markDelivered = async function (userId) {
  const alreadyDelivered = this.deliveredTo.some(
    (d) => d.user.toString() === userId.toString(),
  );

  if (!alreadyDelivered && this.sender.toString() !== userId.toString()) {
    this.deliveredTo.push({
      user: userId,
      deliveredAt: new Date(),
    });

    // Update status if all recipients have received
    if (this.status === "sent") {
      this.status = "delivered";
    }

    await this.save();
  }

  return this;
};

// Instance method to mark as read for a user
messageSchema.methods.markRead = async function (userId) {
  const alreadyRead = this.readBy.some(
    (r) => r.user.toString() === userId.toString(),
  );

  if (!alreadyRead && this.sender.toString() !== userId.toString()) {
    this.readBy.push({
      user: userId,
      readAt: new Date(),
    });

    // Update status to read
    this.status = "read";
    await this.save();
  }

  return this;
};

// Instance method to add reaction
messageSchema.methods.addReaction = async function (userId, emoji) {
  // Remove existing reaction from same user
  this.reactions = this.reactions.filter(
    (r) => r.user.toString() !== userId.toString(),
  );

  // Add new reaction
  this.reactions.push({
    user: userId,
    emoji,
    createdAt: new Date(),
  });

  await this.save();
  return this;
};

// Instance method to remove reaction
messageSchema.methods.removeReaction = async function (userId) {
  this.reactions = this.reactions.filter(
    (r) => r.user.toString() !== userId.toString(),
  );
  await this.save();
  return this;
};

// Instance method to edit message
messageSchema.methods.editContent = async function (newContent) {
  // Save old content to history
  this.editHistory.push({
    content: this.content,
    editedAt: new Date(),
  });

  this.content = newContent;
  this.isEdited = true;
  await this.save();
  return this;
};

// Instance method to soft delete for a user
messageSchema.methods.deleteFor = async function (userId) {
  if (!this.deletedFor.includes(userId)) {
    this.deletedFor.push(userId);
    await this.save();
  }
  return this;
};

// Instance method to soft delete for everyone (only sender can do this)
messageSchema.methods.deleteForEveryone = async function (userId) {
  if (this.sender.toString() !== userId.toString()) {
    throw new Error("Only the sender can delete a message for everyone");
  }

  this.isDeleted = true;
  this.content = "This message was deleted";
  await this.save();
  return this;
};

const Message = mongoose.model("Message", messageSchema);

export default Message;
