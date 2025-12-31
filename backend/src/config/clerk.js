/**
 * Clerk Authentication Configuration
 * Handles Clerk SDK setup and user verification utilities
 */

import { clerkClient, requireAuth, getAuth } from "@clerk/express";
import { logger } from "../utils/helpers.js";

/**
 * Validate Clerk environment variables
 * @throws {Error} If required Clerk environment variables are missing
 */
export const validateClerkConfig = () => {
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY;
  const secretKey = process.env.CLERK_SECRET_KEY;

  if (!publishableKey) {
    throw new Error("CLERK_PUBLISHABLE_KEY environment variable is required");
  }

  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY environment variable is required");
  }

  if (!publishableKey.startsWith("pk_")) {
    throw new Error("Invalid CLERK_PUBLISHABLE_KEY format");
  }

  if (!secretKey.startsWith("sk_")) {
    throw new Error("Invalid CLERK_SECRET_KEY format");
  }

  logger.info("✅ Clerk configuration validated successfully");
  return true;
};

/**
 * Get Clerk user by ID
 * @param {string} clerkId - The Clerk user ID
 * @returns {Promise<Object|null>} Clerk user object or null
 */
export const getClerkUser = async (clerkId) => {
  try {
    const user = await clerkClient.users.getUser(clerkId);
    return user;
  } catch (error) {
    logger.error(`Failed to fetch Clerk user ${clerkId}: `, error.message);
    return null;
  }
};

/**
 * Extract user data from Clerk user object
 * @param {Object} clerkUser - Clerk user object
 * @returns {Object} Normalized user data
 */
export const extractUserData = (clerkUser) => {
  if (!clerkUser) {
    return null;
  }

  const primaryEmail = clerkUser.emailAddresses?.find(
    (email) => email.id === clerkUser.primaryEmailAddressId
  );

  return {
    clerkId: clerkUser.id,
    email: primaryEmail?.emailAddress || "",
    username: clerkUser.username || clerkUser.id.slice(-8),
    firstName: clerkUser.firstName || "",
    lastName: clerkUser.lastName || "",
    avatar: clerkUser.imageUrl || "",
  };
};

/**
 * Verify Clerk session token from Socket.io handshake
 * @param {string} token - The session token to verify
 * @returns {Promise<Object|null>} Decoded token payload or null
 */
export const verifySocketToken = async (token) => {
  try {
    if (!token) {
      logger.warn("No token provided for socket verification");
      return null;
    }

    // For Socket.io, we verify the session token directly
    const sessions = await clerkClient.sessions.verifySession(token, token);

    if (sessions && sessions.userId) {
      const clerkUser = await getClerkUser(sessions.userId);
      return extractUserData(clerkUser);
    }

    return null;
  } catch (error) {
    logger.error("Socket token verification failed:", error.message);
    return null;
  }
};

/**
 * Get Clerk authentication middleware
 * This is the primary authentication middleware for Express routes
 */
export const clerkAuthMiddleware = requireAuth();

/**
 * Get authentication info from request
 * Use this to extract auth data after clerkAuthMiddleware has run
 */
export const getAuthInfo = getAuth;

export default {
  validateClerkConfig,
  getClerkUser,
  extractUserData,
  verifySocketToken,
  clerkAuthMiddleware,
  getAuthInfo,
};
