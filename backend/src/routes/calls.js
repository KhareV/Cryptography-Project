/**
 * Call Routes
 * Handles call history APIs
 */

import { Router } from "express";
import { clerkMiddleware } from "@clerk/express";
import { requireAuthentication } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendSuccess } from "../utils/helpers.js";
import Call from "../models/Call.js";

const router = Router();

router.use(clerkMiddleware());

/**
 * GET /api/calls/history
 * Returns the latest 20 calls for the current user
 */
router.get(
  "/history",
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const userId = req.userId;

    const calls = await Call.find({
      $or: [{ initiatorId: userId }, { receiverId: userId }],
    })
      .populate("initiatorId", "username firstName lastName avatar")
      .populate("receiverId", "username firstName lastName avatar")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const history = calls.map((call) => {
      const initiator = call.initiatorId || null;
      const receiver = call.receiverId || null;

      const initiatorName = initiator
        ? `${initiator.firstName || ""} ${initiator.lastName || ""}`.trim() ||
          initiator.username
        : "Unknown";

      const receiverName = receiver
        ? `${receiver.firstName || ""} ${receiver.lastName || ""}`.trim() ||
          receiver.username
        : "Unknown";

      return {
        id: call._id,
        callId: call.callId,
        callType: call.callType,
        callMode: call.callMode,
        status: call.status,
        duration: typeof call.duration === "number" ? call.duration : 0,
        startedAt: call.startedAt,
        endedAt: call.endedAt,
        createdAt: call.createdAt,
        initiator: initiator
          ? {
              id: initiator._id,
              name: initiatorName,
              avatar: initiator.avatar || "",
            }
          : null,
        receiver: receiver
          ? {
              id: receiver._id,
              name: receiverName,
              avatar: receiver.avatar || "",
            }
          : null,
      };
    });

    sendSuccess(res, 200, "Call history retrieved", {
      calls: history,
      count: history.length,
    });
  }),
);

export default router;
