/**
 * Authentication Routes
 * Handles user authentication and sync with Clerk
 */

import { Router } from "express";
import { clerkMiddleware } from "@clerk/express";
import {
  requireAuthentication,
  syncUserFromClerk,
} from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authLimiter, syncLimiter } from "../middleware/rateLimiter.js";
import { sendSuccess, sendError, logger } from "../utils/helpers.js";
import User from "../models/User.js";

const router = Router();

// Apply Clerk middleware to all auth routes
router.use(clerkMiddleware());

/**
 * POST /api/auth/sync
 * Sync Clerk user with MongoDB database
 */
router.post(
  "/sync",
  syncLimiter,
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const user = req.user;

    // User is already synced by the authentication middleware
    sendSuccess(res, 200, "User synced successfully", {
      user: {
        id: user._id,
        clerkId: user.clerkId,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        bio: user.bio,
        status: user.status,
        lastSeen: user.lastSeen,
        createdAt: user.createdAt,
      },
    });
  })
);

/**
 * GET /api/auth/me
 * Get current authenticated user profile
 */
router.get(
  "/me",
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.userId)
      .populate(
        "contacts",
        "username firstName lastName avatar status lastSeen"
      )
      .lean();

    if (!user) {
      return sendError(res, 404, "User not found");
    }

    sendSuccess(res, 200, "User profile retrieved", {
      user: {
        id: user._id,
        clerkId: user.clerkId,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName:
          user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.firstName || user.lastName || user.username,
        avatar: user.avatar,
        bio: user.bio,
        status: user.status,
        lastSeen: user.lastSeen,
        contacts: user.contacts,
        notificationSettings: user.notificationSettings,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  })
);

/**
 * POST /api/auth/refresh
 * Refresh user data from Clerk
 */
router.post(
  "/refresh",
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const clerkId = req.clerkUserId;

    // Force sync from Clerk
    const updatedUser = await syncUserFromClerk(clerkId);

    if (!updatedUser) {
      return sendError(res, 500, "Failed to refresh user data");
    }

    sendSuccess(res, 200, "User data refreshed", {
      user: {
        id: updatedUser._id,
        clerkId: updatedUser.clerkId,
        email: updatedUser.email,
        username: updatedUser.username,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        avatar: updatedUser.avatar,
      },
    });
  })
);

/**
 * DELETE /api/auth/account
 * Deactivate user account (soft delete)
 */
router.delete(
  "/account",
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const userId = req.userId;

    await User.findByIdAndUpdate(userId, {
      isActive: false,
      status: "offline",
      lastSeen: new Date(),
    });

    logger.info(`User account deactivated:  ${userId}`);

    sendSuccess(res, 200, "Account deactivated successfully");
  })
);

export default router;
