/**
 * Rate Limiter Middleware
 * Prevents abuse by limiting request rates
 */

import rateLimit from "express-rate-limit";
import { logger } from "../utils/helpers.js";

/**
 * General API rate limiter
 * Limits:  10000 requests per 15 minutes per IP (high limit for development)
 */
export const apiLimiter = rateLimit({
  windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 300 : 10000, // Much higher for development
  message: {
    success: false,
    error: "Too many requests, please try again later",
    retryAfter: "Check Retry-After header for wait time",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use X-Forwarded-For for proxied requests, fallback to IP
    return req.ip || req.headers["x-forwarded-for"]?.split(",")[0] || "unknown";
  },
  handler: (req, res, next, options) => {
    logger.warn("Rate limit exceeded:", {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(429).json(options.message);
  },
  skip: (req) => {
    // Skip rate limiting for health check
    return req.path === "/health" || req.path === "/api/health";
  },
});

/**
 * Authentication endpoints rate limiter
 * More restrictive:  20 requests per 15 minutes
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: "Too many authentication attempts, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.headers["x-forwarded-for"]?.split(",")[0] || "unknown";
  },
});

/**
 * User sync rate limiter
 * More lenient for development:  100 requests per 15 minutes
 */
export const syncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 50 : 100,
  message: {
    success: false,
    error: "Too many sync requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.userId?.toString() || req.ip || "unknown";
  },
});

/**
 * Message sending rate limiter
 * Prevents message spam:  30 messages per minute
 */
export const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    success: false,
    error: "Message rate limit exceeded, please slow down",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if available, otherwise IP
    return req.userId?.toString() || req.ip || "unknown";
  },
});

/**
 * File upload rate limiter
 * Restrictive: 10 uploads per hour
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: "Upload limit exceeded, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.userId?.toString() || req.ip || "unknown";
  },
});

/**
 * Search rate limiter
 * Moderate: 50 searches per minute
 */
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  message: {
    success: false,
    error: "Search rate limit exceeded, please slow down",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.userId?.toString() || req.ip || "unknown";
  },
});

/**
 * Socket connection rate limiter
 * Tracks connection attempts per IP
 */
class SocketRateLimiter {
  constructor() {
    this.connections = new Map();
    this.maxConnections = 10;
    this.windowMs = 60 * 1000;

    // Clean up old entries periodically
    setInterval(() => this.cleanup(), this.windowMs);
  }

  /**
   * Check if connection is allowed
   * @param {string} ip - Client IP address
   * @returns {boolean} Whether connection is allowed
   */
  isAllowed(ip) {
    const now = Date.now();
    const entry = this.connections.get(ip);

    if (!entry) {
      this.connections.set(ip, {
        count: 1,
        firstAttempt: now,
      });
      return true;
    }

    // Reset if window has passed
    if (now - entry.firstAttempt > this.windowMs) {
      this.connections.set(ip, {
        count: 1,
        firstAttempt: now,
      });
      return true;
    }

    // Increment and check
    entry.count++;
    if (entry.count > this.maxConnections) {
      logger.warn(`Socket rate limit exceeded for IP:  ${ip}`);
      return false;
    }

    return true;
  }

  /**
   * Clean up old entries
   */
  cleanup() {
    const now = Date.now();
    for (const [ip, entry] of this.connections) {
      if (now - entry.firstAttempt > this.windowMs) {
        this.connections.delete(ip);
      }
    }
  }
}

export const socketRateLimiter = new SocketRateLimiter();

export default {
  apiLimiter,
  authLimiter,
  syncLimiter,
  messageLimiter,
  uploadLimiter,
  searchLimiter,
  socketRateLimiter,
};
