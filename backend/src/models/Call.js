/**
 * Call Model
 * Stores metadata for 1-on-1 audio calls
 */

import mongoose from "mongoose";

const callSchema = new mongoose.Schema(
  {
    callId: {
      type: String,
      required: [true, "Call ID is required"],
      unique: true,
      index: true,
      trim: true,
    },

    callType: {
      type: String,
      enum: ["audio"],
      default: "audio",
      required: true,
    },

    callMode: {
      type: String,
      enum: ["direct"],
      default: "direct",
      required: true,
    },

    initiatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["ringing", "active", "ended", "rejected", "missed"],
      default: "ringing",
      index: true,
    },

    startedAt: {
      type: Date,
      default: null,
    },

    endedAt: {
      type: Date,
      default: null,
    },

    duration: {
      type: Number,
      default: 0,
      min: 0,
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

callSchema.index({ initiatorId: 1, createdAt: -1 });
callSchema.index({ receiverId: 1, createdAt: -1 });
callSchema.index({ createdAt: -1 });

const Call = mongoose.model("Call", callSchema);

export default Call;
