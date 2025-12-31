/**
 * Request Validators
 * Input validation using express-validator
 */

import { body, param, query, validationResult } from "express-validator";
import mongoose from "mongoose";
import { ApiError } from "../utils/helpers.js";

/**
 * Validation result handler middleware
 * Checks for validation errors and returns appropriate response
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((error) => ({
      field: error.path,
      message: error.msg,
      value: error.value,
    }));

    console.log("Validation failed:", JSON.stringify(formattedErrors, null, 2));
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    return res.status(400).json({
      success: false,
      error: "Validation failed",
      details: formattedErrors,
    });
  }

  next();
};

/**
 * Custom validator for MongoDB ObjectId
 */
const isValidObjectId = (value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error("Invalid ID format");
  }
  return true;
};

/**
 * Sanitize string input
 */
const sanitizeString = (value) => {
  if (typeof value !== "string") return value;
  return value.trim().replace(/<[^>]*>/g, "");
};

// =====================================================
// User Validators
// =====================================================

export const validateUserSearch = [
  query("search")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Search query must be between 1 and 50 characters")
    .customSanitizer(sanitizeString),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50")
    .toInt(),
  handleValidationErrors,
];

export const validateUserId = [
  param("userId").custom(isValidObjectId).withMessage("Invalid user ID"),
  handleValidationErrors,
];

export const validateProfileUpdate = [
  body("username")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 30 })
    .withMessage("Username must be between 2 and 30 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores")
    .customSanitizer(sanitizeString),
  body("firstName")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 50 })
    .withMessage("First name cannot exceed 50 characters")
    .customSanitizer(sanitizeString),
  body("lastName")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Last name cannot exceed 50 characters")
    .customSanitizer(sanitizeString),
  body("bio")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Bio cannot exceed 500 characters")
    .customSanitizer(sanitizeString),
  body("status")
    .optional()
    .isIn(["online", "offline", "away"])
    .withMessage("Status must be online, offline, or away"),
  handleValidationErrors,
];

// =====================================================
// Conversation Validators
// =====================================================

export const validateConversationId = [
  param("conversationId")
    .custom(isValidObjectId)
    .withMessage("Invalid conversation ID"),
  handleValidationErrors,
];

export const validateCreateConversation = [
  body("participantIds")
    .isArray({ min: 1 })
    .withMessage("At least one participant ID is required"),
  body("participantIds.*")
    .custom(isValidObjectId)
    .withMessage("Invalid participant ID"),
  body("type")
    .optional()
    .isIn(["direct", "group"])
    .withMessage("Type must be direct or group"),
  body("groupName")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Group name must be between 1 and 100 characters")
    .customSanitizer(sanitizeString),
  handleValidationErrors,
];

export const validateConversationPagination = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .toInt(),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50")
    .toInt(),
  handleValidationErrors,
];

// =====================================================
// Message Validators
// =====================================================

export const validateMessageId = [
  param("messageId").custom(isValidObjectId).withMessage("Invalid message ID"),
  handleValidationErrors,
];

export const validateSendMessage = [
  body("content")
    .isString()
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage("Message content must be between 1 and 5000 characters")
    .customSanitizer(sanitizeString),
  body("type")
    .optional()
    .isIn(["text", "image", "file"])
    .withMessage("Message type must be text, image, or file"),
  body("replyTo")
    .optional()
    .custom(isValidObjectId)
    .withMessage("Invalid reply message ID"),
  handleValidationErrors,
];

export const validateMessagePagination = [
  param("conversationId")
    .custom(isValidObjectId)
    .withMessage("Invalid conversation ID"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .toInt(),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .toInt(),
  handleValidationErrors,
];

export const validateEditMessage = [
  param("messageId").custom(isValidObjectId).withMessage("Invalid message ID"),
  body("content")
    .isString()
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage("Message content must be between 1 and 5000 characters")
    .customSanitizer(sanitizeString),
  handleValidationErrors,
];

// =====================================================
// Socket Message Validators
// =====================================================

export const validateSocketMessage = (data) => {
  const errors = [];

  if (!data) {
    errors.push("Message data is required");
    return { isValid: false, errors };
  }

  if (
    !data.conversationId ||
    !mongoose.Types.ObjectId.isValid(data.conversationId)
  ) {
    errors.push("Valid conversation ID is required");
  }

  if (!data.content || typeof data.content !== "string") {
    errors.push("Message content is required");
  } else if (data.content.length > 5000) {
    errors.push("Message content cannot exceed 5000 characters");
  }

  if (data.type && !["text", "image", "file"].includes(data.type)) {
    errors.push("Invalid message type");
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: {
      conversationId: data.conversationId,
      content: sanitizeString(data.content || ""),
      type: data.type || "text",
      replyTo: data.replyTo,
    },
  };
};

export default {
  handleValidationErrors,
  validateUserSearch,
  validateUserId,
  validateProfileUpdate,
  validateConversationId,
  validateCreateConversation,
  validateConversationPagination,
  validateMessageId,
  validateSendMessage,
  validateMessagePagination,
  validateEditMessage,
  validateSocketMessage,
};
