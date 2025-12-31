/**
 * User Routes
 * Handles user profile management and contacts
 */

import { Router } from "express";
import { clerkMiddleware } from "@clerk/express";
import { requireAuthentication } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { searchLimiter } from "../middleware/rateLimiter.js";
import {
  validateUserSearch,
  validateUserId,
  validateProfileUpdate,
} from "../middleware/validators.js";
import {
  sendSuccess,
  sendError,
  sendPaginated,
  ApiError,
} from "../utils/helpers.js";
import User from "../models/User.js";

const router = Router();

// Apply Clerk middleware
router.use(clerkMiddleware());

/**
 * GET /api/users
 * Search for users by username, name, or email
 */
router.get(
  "/",
  requireAuthentication,
  searchLimiter,
  validateUserSearch,
  asyncHandler(async (req, res) => {
    const { search, limit = 20 } = req.query;
    const currentUserId = req.userId;

    if (!search || search.length < 1) {
      return sendSuccess(res, 200, "Provide a search query", { users: [] });
    }

    const users = await User.searchUsers(
      search,
      currentUserId,
      parseInt(limit)
    );

    sendSuccess(res, 200, "Users found", {
      users,
      count: users.length,
    });
  })
);

/**
 * GET /api/users/contacts
 * Get current user's contact list
 */
router.get(
  "/contacts",
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.userId)
      .populate(
        "contacts",
        "username firstName lastName avatar status lastSeen bio"
      )
      .lean();

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    // Add online status to contacts
    const { socketManager } = await import("../utils/socketManager.js");

    const contactsWithStatus = user.contacts.map((contact) => ({
      ...contact,
      isOnline: socketManager.isUserOnline(contact._id.toString()),
    }));

    sendSuccess(res, 200, "Contacts retrieved", {
      contacts: contactsWithStatus,
      count: contactsWithStatus.length,
    });
  })
);

/**
 * GET /api/users/: userId
 * Get a specific user's profile
 */
router.get(
  "/:userId",
  requireAuthentication,
  validateUserId,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select(
        "username firstName lastName avatar bio status lastSeen createdAt"
      )
      .lean();

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    // Check if user is online
    const { socketManager } = await import("../utils/socketManager.js");
    const isOnline = socketManager.isUserOnline(userId);

    sendSuccess(res, 200, "User profile retrieved", {
      user: {
        ...user,
        isOnline,
      },
    });
  })
);

/**
 * PUT /api/users/profile
 * Update current user's profile
 */
router.put(
  "/profile",
  requireAuthentication,
  validateProfileUpdate,
  asyncHandler(async (req, res) => {
    const userId = req.userId;
    const updates = {};

    // Only include fields that are provided
    const allowedFields = [
      "username",
      "firstName",
      "lastName",
      "bio",
      "status",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Handle notification settings
    if (req.body.notificationSettings) {
      updates.notificationSettings = {
        ...req.user.notificationSettings,
        ...req.body.notificationSettings,
      };
    }

    if (Object.keys(updates).length === 0) {
      return sendError(res, 400, "No valid fields to update");
    }

    // Check username uniqueness if updating username
    if (updates.username) {
      const existingUser = await User.findOne({
        username: updates.username,
        _id: { $ne: userId },
      });

      if (existingUser) {
        throw new ApiError(409, "Username already taken");
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-contacts");

    if (!updatedUser) {
      throw new ApiError(404, "User not found");
    }

    sendSuccess(res, 200, "Profile updated successfully", {
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        avatar: updatedUser.avatar,
        bio: updatedUser.bio,
        status: updatedUser.status,
        notificationSettings: updatedUser.notificationSettings,
        updatedAt: updatedUser.updatedAt,
      },
    });
  })
);

/**
 * POST /api/users/contacts/: userId
 * Add a user to contacts
 */
router.post(
  "/contacts/:userId",
  requireAuthentication,
  validateUserId,
  asyncHandler(async (req, res) => {
    const currentUserId = req.userId;
    const { userId: contactId } = req.params;

    // Can't add yourself as contact
    if (currentUserId.toString() === contactId) {
      throw new ApiError(400, "Cannot add yourself as a contact");
    }

    // Check if contact user exists
    const contactUser = await User.findById(contactId);
    if (!contactUser) {
      throw new ApiError(404, "User not found");
    }

    // Add to contacts
    const user = await User.findById(currentUserId);
    await user.addContact(contactId);

    sendSuccess(res, 200, "Contact added successfully", {
      contact: {
        id: contactUser._id,
        username: contactUser.username,
        firstName: contactUser.firstName,
        lastName: contactUser.lastName,
        avatar: contactUser.avatar,
        status: contactUser.status,
      },
    });
  })
);

/**
 * DELETE /api/users/contacts/:userId
 * Remove a user from contacts
 */
router.delete(
  "/contacts/:userId",
  requireAuthentication,
  validateUserId,
  asyncHandler(async (req, res) => {
    const currentUserId = req.userId;
    const { userId: contactId } = req.params;

    const user = await User.findById(currentUserId);
    await user.removeContact(contactId);

    sendSuccess(res, 200, "Contact removed successfully");
  })
);

/**
 * GET /api/users/online/list
 * Get list of online users from contacts
 */
router.get(
  "/online/list",
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.userId)
      .populate("contacts", "_id username firstName lastName avatar")
      .lean();

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const { socketManager } = await import("../utils/socketManager.js");

    // Filter to only online contacts
    const onlineContacts = user.contacts.filter((contact) =>
      socketManager.isUserOnline(contact._id.toString())
    );

    sendSuccess(res, 200, "Online contacts retrieved", {
      onlineContacts,
      count: onlineContacts.length,
    });
  })
);

export default router;
