/**
 * User Model
 * Represents application users synced from Clerk authentication
 */

import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // Clerk user ID - unique identifier from Clerk
    clerkId: {
      type: String,
      required: [true, "Clerk ID is required"],
      unique: true,
      index: true,
      trim: true,
    },

    // User email address
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      index: true,
    },

    // Unique username for display and search
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      minlength: [2, "Username must be at least 2 characters"],
      maxlength: [30, "Username cannot exceed 30 characters"],
      index: true,
    },

    // User's first name
    firstName: {
      type: String,
      trim: true,
      maxlength: [50, "First name cannot exceed 50 characters"],
      default: "",
    },

    // User's last name
    lastName: {
      type: String,
      trim: true,
      maxlength: [50, "Last name cannot exceed 50 characters"],
      default: "",
    },

    // Profile avatar URL
    avatar: {
      type: String,
      trim: true,
      default: "",
    },

    // User bio/description
    bio: {
      type: String,
      trim: true,
      maxlength: [500, "Bio cannot exceed 500 characters"],
      default: "",
    },

    // Wallet bound to user for blockchain features
    walletAddress: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
      default: "",
    },

    // Latest transaction hash associated with blockchain actions
    blockchainTxHash: {
      type: String,
      trim: true,
      default: "",
    },

    // Optional key metadata snapshot for quick UI display
    keyFingerprint: {
      type: String,
      trim: true,
      default: "",
    },
    keyPublicKey: {
      type: String,
      trim: true,
      default: "",
    },
    encryptedPrivateKey: {
      type: String,
      trim: true,
      default: "",
    },
    keyEncryptionSalt: {
      type: String,
      trim: true,
      default: "",
    },
    keyEncryptionIv: {
      type: String,
      trim: true,
      default: "",
    },
    keyEncryptionIterations: {
      type: Number,
      default: 100000,
      min: 1000,
      max: 1000000,
    },
    keyEncryptionAlgorithm: {
      type: String,
      trim: true,
      default: "AES-256-GCM",
    },
    keyEncryptionKdf: {
      type: String,
      trim: true,
      default: "PBKDF2-SHA-256",
    },
    keyRegisteredAt: {
      type: Date,
      default: null,
    },

    // Online status
    status: {
      type: String,
      enum: {
        values: ["online", "offline", "away"],
        message: "Status must be online, offline, or away",
      },
      default: "offline",
      index: true,
    },

    // Last time user was active
    lastSeen: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // User's contacts (references to other users)
    contacts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Push notification settings
    notificationSettings: {
      pushEnabled: {
        type: Boolean,
        default: true,
      },
      emailEnabled: {
        type: Boolean,
        default: false,
      },
      soundEnabled: {
        type: Boolean,
        default: true,
      },
    },

    // Account status
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

// Compound indexes for better query performance
userSchema.index({ username: "text", firstName: "text", lastName: "text" });
userSchema.index({ status: 1, lastSeen: -1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ walletAddress: 1, isActive: 1 });

// Virtual for full name
userSchema.virtual("fullName").get(function () {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.firstName || this.lastName || this.username;
});

// Virtual for display name
userSchema.virtual("displayName").get(function () {
  return this.fullName || this.username;
});

// Static method to find user by Clerk ID
userSchema.statics.findByClerkId = function (clerkId) {
  return this.findOne({ clerkId, isActive: true });
};

// Static method to search users
userSchema.statics.searchUsers = function (query, excludeUserId, limit = 20) {
  const searchRegex = new RegExp(query, "i");
  return this.find({
    $and: [
      { isActive: true },
      { _id: { $ne: excludeUserId } },
      {
        $or: [
          { username: searchRegex },
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
        ],
      },
    ],
  })
    .select("username firstName lastName avatar status lastSeen")
    .limit(limit)
    .lean();
};

// Instance method to update online status
userSchema.methods.setOnline = function () {
  this.status = "online";
  this.lastSeen = new Date();
  return this.save();
};

// Instance method to update offline status
userSchema.methods.setOffline = function () {
  this.status = "offline";
  this.lastSeen = new Date();
  return this.save();
};

// Instance method to add contact
userSchema.methods.addContact = async function (userId) {
  if (!this.contacts.includes(userId)) {
    this.contacts.push(userId);
    await this.save();
  }
  return this;
};

// Instance method to remove contact
userSchema.methods.removeContact = async function (userId) {
  this.contacts = this.contacts.filter(
    (id) => id.toString() !== userId.toString(),
  );
  await this.save();
  return this;
};

// Pre-save middleware to ensure username uniqueness
userSchema.pre("save", async function (next) {
  if (this.isModified("username")) {
    const existingUser = await this.constructor.findOne({
      username: this.username,
      _id: { $ne: this._id },
    });
    if (existingUser) {
      const error = new Error("Username already taken");
      error.code = 11000;
      return next(error);
    }
  }
  next();
});

const User = mongoose.model("User", userSchema);

export default User;
