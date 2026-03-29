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
    .isLength({ min: 1, max: 20000 })
    .withMessage("Message content must be between 1 and 20000 characters")
    .customSanitizer(sanitizeString),
  body("type")
    .optional()
    .isIn(["text", "image", "file"])
    .withMessage("Message type must be text, image, or file"),
  body("e2ee")
    .optional({ nullable: true })
    .isObject()
    .withMessage("e2ee payload must be an object"),
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
// Group Validators
// =====================================================

export const validateGroupId = [
  param("groupId").custom(isValidObjectId).withMessage("Invalid group ID"),
  handleValidationErrors,
];

export const validateCreateGroup = [
  body("groupId")
    .isString()
    .custom(isValidObjectId)
    .withMessage("groupId must be a valid MongoDB ObjectId"),
  body("name")
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Group name must be between 2 and 100 characters")
    .customSanitizer(sanitizeString),
  body("description")
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters")
    .customSanitizer(sanitizeString),
  body("avatar")
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Avatar URL is too long"),
  body("memberIds")
    .optional()
    .isArray({ min: 0, max: 200 })
    .withMessage("memberIds must be an array with up to 200 users"),
  body("memberIds.*")
    .optional()
    .custom(isValidObjectId)
    .withMessage("Invalid member ID"),
  body("joinFeeEth")
    .isFloat({ gt: 0, max: 1000 })
    .withMessage("joinFeeEth must be greater than 0 and at most 1000")
    .toFloat(),
  body("walletAddress")
    .isString()
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage("walletAddress must be a valid Ethereum address"),
  body("createTxHash")
    .isString()
    .matches(/^0x[a-fA-F0-9]{64}$/)
    .withMessage("createTxHash must be a valid transaction hash"),
  handleValidationErrors,
];

export const validateUpdateGroup = [
  param("groupId").custom(isValidObjectId).withMessage("Invalid group ID"),
  body("name")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Group name must be between 2 and 100 characters")
    .customSanitizer(sanitizeString),
  body("description")
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters")
    .customSanitizer(sanitizeString),
  body("avatar")
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Avatar URL is too long"),
  handleValidationErrors,
];

export const validateGroupMemberMutation = [
  param("groupId").custom(isValidObjectId).withMessage("Invalid group ID"),
  body("memberId").custom(isValidObjectId).withMessage("Invalid member ID"),
  handleValidationErrors,
];

export const validateGroupJoin = [
  param("groupId").custom(isValidObjectId).withMessage("Invalid group ID"),
  body("walletAddress")
    .isString()
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage("walletAddress must be a valid Ethereum address"),
  body("joinTxHash")
    .isString()
    .matches(/^0x[a-fA-F0-9]{64}$/)
    .withMessage("joinTxHash must be a valid transaction hash"),
  handleValidationErrors,
];

export const validateGroupOnChainRegistration = [
  param("groupId").custom(isValidObjectId).withMessage("Invalid group ID"),
  body("walletAddress")
    .isString()
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage("walletAddress must be a valid Ethereum address"),
  body("txHash")
    .isString()
    .matches(/^0x[a-fA-F0-9]{64}$/)
    .withMessage("txHash must be a valid transaction hash"),
  handleValidationErrors,
];

export const validateGroupMessagePagination = [
  param("groupId").custom(isValidObjectId).withMessage("Invalid group ID"),
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

export const validateSendGroupMessage = [
  param("groupId").custom(isValidObjectId).withMessage("Invalid group ID"),
  body("content")
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 5000 })
    .withMessage("Message content cannot exceed 5000 characters")
    .customSanitizer(sanitizeString),
  body("type")
    .optional()
    .isIn(["text", "image", "file"])
    .withMessage("Message type must be text, image, or file"),
  body("replyTo")
    .optional({ nullable: true })
    .custom(isValidObjectId)
    .withMessage("Invalid reply message ID"),
  body("fileUrl")
    .optional({ nullable: true })
    .isString()
    .withMessage("fileUrl must be a string"),
  body().custom((value) => {
    const hasContent =
      typeof value?.content === "string" && value.content.trim().length > 0;
    const hasFileUrl =
      typeof value?.fileUrl === "string" && value.fileUrl.trim().length > 0;

    if (!hasContent && !hasFileUrl) {
      throw new Error("Message content or fileUrl is required");
    }

    return true;
  }),
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
  } else if (data.content.length > 20000) {
    errors.push("Message content cannot exceed 20000 characters");
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
      e2ee:
        data.e2ee && typeof data.e2ee === "object" && !Array.isArray(data.e2ee)
          ? data.e2ee
          : null,
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
  validateGroupId,
  validateCreateGroup,
  validateUpdateGroup,
  validateGroupMemberMutation,
  validateGroupJoin,
  validateGroupOnChainRegistration,
  validateGroupMessagePagination,
  validateSendGroupMessage,
  validateSocketMessage,
};
