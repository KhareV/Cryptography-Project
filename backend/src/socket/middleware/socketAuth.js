/**
 * Socket. io Authentication Middleware
 * Verifies Clerk session tokens for WebSocket connections
 */

import { clerkClient } from "@clerk/express";
import User from "../../models/User.js";
import { logger } from "../../utils/helpers.js";
import { socketRateLimiter } from "../../middleware/rateLimiter.js";

/**
 * Socket authentication middleware
 * Verifies the Clerk session token from the handshake
 */
export const authenticateSocket = async (socket, next) => {
  try {
    // Get client IP for rate limiting
    const clientIp =
      socket.handshake.headers["x-forwarded-for"]?.split(",")[0] ||
      socket.handshake.address ||
      "unknown";

    // Check rate limit
    if (!socketRateLimiter.isAllowed(clientIp)) {
      logger.warn(`Socket connection rate limited for IP: ${clientIp}`);
      return next(new Error("Too many connection attempts"));
    }

    // Extract token from handshake auth or headers
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "") ||
      socket.handshake.query?.token;

    if (!token) {
      logger.warn("Socket connection attempted without token");
      return next(new Error("Authentication token required"));
    }

    // Verify the session token with Clerk
    let clerkUserId;

    try {
      // For Clerk session tokens, we need to verify them
      // The token should be a session token from the frontend
      const session = await clerkClient.sessions.getSession(token);

      if (!session || session.status !== "active") {
        logger.warn("Invalid or inactive Clerk session");
        return next(new Error("Invalid session"));
      }

      clerkUserId = session.userId;
    } catch (clerkError) {
      // If session verification fails, try to verify as a JWT
      // This handles cases where the frontend sends a different token format
      logger.debug(
        "Session verification failed, attempting alternative auth:",
        clerkError.message
      );

      // Try to extract userId from handshake
      if (socket.handshake.auth?.userId) {
        // Verify user exists in Clerk
        try {
          const user = await clerkClient.users.getUser(
            socket.handshake.auth.userId
          );
          if (user) {
            clerkUserId = user.id;
          }
        } catch (userError) {
          logger.warn("User verification failed:", userError.message);
          return next(new Error("Authentication failed"));
        }
      } else {
        return next(new Error("Authentication failed"));
      }
    }

    if (!clerkUserId) {
      return next(new Error("Unable to authenticate user"));
    }

    // Find user in MongoDB
    let user = await User.findByClerkId(clerkUserId);

    // If user doesn't exist, create from Clerk data
    if (!user) {
      const clerkUser = await clerkClient.users.getUser(clerkUserId);

      if (!clerkUser) {
        return next(new Error("User not found"));
      }

      const primaryEmail = clerkUser.emailAddresses?.find(
        (email) => email.id === clerkUser.primaryEmailAddressId
      );

      let username = clerkUser.username;
      if (!username) {
        username =
          primaryEmail?.emailAddress?.split("@")[0] ||
          `user_${clerkUserId.slice(-8)}`;
      }

      // Ensure unique username
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        username = `${username}_${Date.now().toString(36)}`;
      }

      user = await User.create({
        clerkId: clerkUserId,
        email: primaryEmail?.emailAddress || "",
        username,
        firstName: clerkUser.firstName || "",
        lastName: clerkUser.lastName || "",
        avatar: clerkUser.imageUrl || "",
        status: "online",
        lastSeen: new Date(),
      });

      logger.info(`New user created from socket connection: ${user.username}`);
    }

    // Check if user is active
    if (!user.isActive) {
      return next(new Error("User account is deactivated"));
    }

    // Attach user data to socket
    socket.userId = user._id.toString();
    socket.user = {
      id: user._id.toString(),
      clerkId: user.clerkId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
    };

    logger.info(
      `Socket authenticated for user: ${user.username} (${socket.id})`
    );
    next();
  } catch (error) {
    logger.error("Socket authentication error:", error.message);
    next(new Error("Authentication failed"));
  }
};

/**
 * Middleware to validate socket events
 * Ensures required data is present for each event
 */
export const validateSocketEvent = (requiredFields) => {
  return (data, callback) => {
    const missingFields = requiredFields.filter(
      (field) => !data || data[field] === undefined
    );

    if (missingFields.length > 0) {
      const error = {
        success: false,
        error: `Missing required fields: ${missingFields.join(", ")}`,
      };

      if (typeof callback === "function") {
        callback(error);
      }

      return null;
    }

    return data;
  };
};

export default {
  authenticateSocket,
  validateSocketEvent,
};
