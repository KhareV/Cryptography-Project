/**
 * Authentication Middleware
 * Handles Clerk authentication and user sync with MongoDB
 */

import { clerkClient, getAuth } from "@clerk/express";
import User from "../models/User.js";
import { logger, ApiError } from "../utils/helpers.js";

/**
 * Clerk authentication middleware
 * Verifies the Clerk session and attaches user data to the request
 */
export const requireAuthentication = async (req, res, next) => {
  try {
    // Get auth info from Clerk
    const auth = getAuth(req);

    if (!auth || !auth.userId) {
      throw new ApiError(401, "Authentication required");
    }

    // Attach Clerk user ID to request
    req.clerkUserId = auth.userId;

    // Try to find user in MongoDB
    let user = await User.findByClerkId(auth.userId);

    // If user doesn't exist in MongoDB, sync from Clerk
    if (!user) {
      user = await syncUserFromClerk(auth.userId);
    }

    if (!user) {
      throw new ApiError(401, "User account not found");
    }

    if (!user.isActive) {
      throw new ApiError(403, "User account is deactivated");
    }

    // Attach MongoDB user to request
    req.user = user;
    req.userId = user._id;

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    }

    logger.error("Authentication error:", error.message);
    return res.status(401).json({
      success: false,
      error: "Authentication failed",
    });
  }
};

/**
 * Sync user data from Clerk to MongoDB
 * @param {string} clerkId - The Clerk user ID
 * @returns {Promise<Object>} The synced user document
 */
export const syncUserFromClerk = async (clerkId) => {
  try {
    // Fetch user data from Clerk
    const clerkUser = await clerkClient.users.getUser(clerkId);

    if (!clerkUser) {
      logger.error(`Clerk user not found:  ${clerkId}`);
      return null;
    }

    // Extract primary email
    const primaryEmail = clerkUser.emailAddresses?.find(
      (email) => email.id === clerkUser.primaryEmailAddressId
    );

    // Generate username if not provided
    let username = clerkUser.username;
    if (!username) {
      // Use email prefix or generate from Clerk ID
      username =
        primaryEmail?.emailAddress?.split("@")[0] ||
        `user_${clerkId.slice(-8)}`;
    }

    // Ensure username is unique
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      username = `${username}_${Date.now().toString(36)}`;
    }

    // Create or update user in MongoDB
    const userData = {
      clerkId,
      email: primaryEmail?.emailAddress || "",
      username,
      firstName: clerkUser.firstName || "",
      lastName: clerkUser.lastName || "",
      avatar: clerkUser.imageUrl || "",
      status: "offline",
      lastSeen: new Date(),
    };

    const user = await User.findOneAndUpdate(
      { clerkId },
      { $set: userData, $setOnInsert: { contacts: [] } },
      { upsert: true, new: true, runValidators: true }
    );

    logger.info(`User synced from Clerk:  ${user.username} (${clerkId})`);
    return user;
  } catch (error) {
    logger.error(`Failed to sync user from Clerk:  ${error.message}`);
    throw error;
  }
};

/**
 * Optional authentication middleware
 * Attaches user if authenticated, but doesn't require it
 */
export const optionalAuthentication = async (req, res, next) => {
  try {
    const auth = getAuth(req);

    if (auth && auth.userId) {
      const user = await User.findByClerkId(auth.userId);
      if (user && user.isActive) {
        req.user = user;
        req.userId = user._id;
        req.clerkUserId = auth.userId;
      }
    }

    next();
  } catch (error) {
    // Don't block request, just continue without user
    logger.warn("Optional auth failed:", error.message);
    next();
  }
};

/**
 * Middleware to check if user owns the resource
 * @param {Function} getResourceUserId - Function to extract user ID from resource
 */
export const requireOwnership = (getResourceUserId) => {
  return async (req, res, next) => {
    try {
      const resourceUserId = await getResourceUserId(req);

      if (!resourceUserId) {
        throw new ApiError(404, "Resource not found");
      }

      if (resourceUserId.toString() !== req.userId.toString()) {
        throw new ApiError(
          403,
          "You do not have permission to access this resource"
        );
      }

      next();
    } catch (error) {
      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message,
        });
      }

      logger.error("Ownership check error:", error.message);
      return res.status(500).json({
        success: false,
        error: "Failed to verify resource ownership",
      });
    }
  };
};

export default {
  requireAuthentication,
  syncUserFromClerk,
  optionalAuthentication,
  requireOwnership,
};
