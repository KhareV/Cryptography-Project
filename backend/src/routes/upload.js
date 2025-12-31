/**
 * Upload Routes
 * Handles file uploads for avatars and message attachments using Cloudinary
 */

import { Router } from "express";
import { clerkMiddleware } from "@clerk/express";
import multer from "multer";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import { requireAuthentication } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { uploadLimiter } from "../middleware/rateLimiter.js";
import {
  sendSuccess,
  sendError,
  ApiError,
  logger,
  formatFileSize,
} from "../utils/helpers.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
  extractPublicId,
} from "../config/cloudinary.js";
import User from "../models/User.js";

const router = Router();

// Configure multer storage
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req, file, cb) => {
  const allowedTypes = (
    process.env.ALLOWED_FILE_TYPES ||
    "image/jpeg,image/png,image/gif,image/webp,application/pdf"
  )
    .split(",")
    .map((type) => type.trim());

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, `File type ${file.mimetype} is not allowed`), false);
  }
};

// Configure multer for avatar uploads
const avatarUpload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedImageTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ApiError(400, "Only image files are allowed for avatars"), false);
    }
  },
});

// Configure multer for file uploads
const fileUpload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024,
  },
  fileFilter,
});

// Apply Clerk middleware
router.use(clerkMiddleware());

/**
 * POST /api/upload/avatar
 * Upload user avatar to Cloudinary
 */
router.post(
  "/avatar",
  requireAuthentication,
  uploadLimiter,
  avatarUpload.single("avatar"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ApiError(400, "No file uploaded");
    }

    const userId = req.userId;
    const publicId = `avatars/${userId}-${uuidv4()}`;

    try {
      // Process image with sharp - resize and optimize
      const processedBuffer = await sharp(req.file.buffer)
        .resize(256, 256, {
          fit: "cover",
          position: "center",
        })
        .webp({ quality: 80 })
        .toBuffer();

      // Upload to Cloudinary
      const result = await uploadToCloudinary(processedBuffer, {
        folder: "chat-app/avatars",
        publicId: `${userId}-${uuidv4()}`,
        format: "webp",
        transformation: [
          { width: 256, height: 256, crop: "fill", gravity: "face" },
        ],
      });

      // Delete old avatar from Cloudinary if it exists
      if (req.user.avatar && req.user.avatar.includes("cloudinary.com")) {
        const oldPublicId = extractPublicId(req.user.avatar);
        if (oldPublicId) {
          await deleteFromCloudinary(oldPublicId).catch((err) =>
            logger.warn("Failed to delete old avatar:", err)
          );
        }
      }

      // Update user's avatar in database with Cloudinary URL
      await User.findByIdAndUpdate(
        userId,
        { avatar: result.secure_url },
        { new: true }
      );

      logger.info(
        `Avatar uploaded to Cloudinary for user ${userId}: ${result.public_id}`
      );

      sendSuccess(res, 200, "Avatar uploaded successfully", {
        avatar: result.secure_url,
        size: formatFileSize(result.bytes),
        width: result.width,
        height: result.height,
      });
    } catch (error) {
      logger.error("Avatar upload error:", error);
      throw new ApiError(500, "Failed to upload avatar");
    }
  })
);

/**
 * POST /api/upload/file
 * Upload message attachment to Cloudinary
 */
router.post(
  "/file",
  requireAuthentication,
  uploadLimiter,
  fileUpload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ApiError(400, "No file uploaded");
    }

    const userId = req.userId;
    const originalName = req.file.originalname;
    const isImage = req.file.mimetype.startsWith("image/");

    try {
      let uploadBuffer = req.file.buffer;
      let resourceType = "auto";
      let folder = "chat-app/files";
      let transformation = [];

      if (isImage) {
        // Process images - resize if too large, convert to webp
        folder = "chat-app/images";
        const metadata = await sharp(req.file.buffer).metadata();

        let sharpInstance = sharp(req.file.buffer);

        // Resize if larger than 1920px
        if (metadata.width > 1920 || metadata.height > 1920) {
          sharpInstance = sharpInstance.resize(1920, 1920, {
            fit: "inside",
            withoutEnlargement: true,
          });
        }

        // Convert to webp for better compression
        uploadBuffer = await sharpInstance.webp({ quality: 85 }).toBuffer();

        transformation = [{ quality: "auto:good" }, { fetch_format: "auto" }];
      }

      // Upload to Cloudinary
      const result = await uploadToCloudinary(uploadBuffer, {
        folder,
        publicId: `${userId}-${uuidv4()}`,
        resourceType,
        format: isImage ? "webp" : undefined,
        transformation,
      });

      logger.info(
        `File uploaded to Cloudinary by user ${userId}: ${result.public_id}`
      );

      sendSuccess(res, 200, "File uploaded successfully", {
        fileUrl: result.secure_url,
        originalName,
        mimeType: isImage ? "image/webp" : req.file.mimetype,
        size: result.bytes,
        formattedSize: formatFileSize(result.bytes),
        type: isImage ? "image" : "file",
        width: result.width,
        height: result.height,
        publicId: result.public_id,
      });
    } catch (error) {
      logger.error("File upload error:", error);
      throw new ApiError(500, "Failed to upload file");
    }
  })
);

/**
 * DELETE /api/upload/avatar
 * Remove user avatar from Cloudinary
 */
router.delete(
  "/avatar",
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const userId = req.userId;
    const user = req.user;

    // Delete from Cloudinary if it's a Cloudinary URL
    if (user.avatar && user.avatar.includes("cloudinary.com")) {
      const publicId = extractPublicId(user.avatar);
      if (publicId) {
        await deleteFromCloudinary(publicId).catch((err) =>
          logger.warn("Failed to delete avatar from Cloudinary:", err)
        );
      }
    }

    // Remove avatar from database
    await User.findByIdAndUpdate(userId, { avatar: "" });

    logger.info(`Avatar removed for user ${userId}`);

    sendSuccess(res, 200, "Avatar removed successfully");
  })
);

// Error handler for multer errors
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return sendError(
        res,
        400,
        `File too large. Maximum size is ${formatFileSize(
          parseInt(process.env.MAX_FILE_SIZE) || 5242880
        )}`
      );
    }
    return sendError(res, 400, err.message);
  }
  next(err);
});

export default router;
