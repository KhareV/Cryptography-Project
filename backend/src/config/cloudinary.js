/**
 * Cloudinary Configuration
 * Handles cloud-based file storage and image transformations
 */

import { v2 as cloudinary } from "cloudinary";
import { logger } from "../utils/helpers.js";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Upload file to Cloudinary
 * @param {Buffer} buffer - File buffer
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} - Upload result
 */
export const uploadToCloudinary = async (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || "chat-uploads",
        resource_type: options.resourceType || "auto",
        transformation: options.transformation || [],
        format: options.format,
        public_id: options.publicId,
        overwrite: options.overwrite || false,
      },
      (error, result) => {
        if (error) {
          logger.error("Cloudinary upload error:", error);
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    uploadStream.end(buffer);
  });
};

/**
 * Delete file from Cloudinary
 * @param {string} publicId - Public ID of the file
 * @param {string} resourceType - Resource type (image, video, raw)
 * @returns {Promise<Object>} - Deletion result
 */
export const deleteFromCloudinary = async (
  publicId,
  resourceType = "image"
) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    logger.info(`File deleted from Cloudinary: ${publicId}`);
    return result;
  } catch (error) {
    logger.error(`Error deleting file from Cloudinary: ${publicId}`, error);
    throw error;
  }
};

/**
 * Extract public ID from Cloudinary URL
 * @param {string} url - Cloudinary URL
 * @returns {string} - Public ID
 */
export const extractPublicId = (url) => {
  if (!url || !url.includes("cloudinary.com")) {
    return null;
  }

  try {
    // Extract public_id from Cloudinary URL
    const parts = url.split("/");
    const uploadIndex = parts.indexOf("upload");
    if (uploadIndex === -1) return null;

    // Get everything after version number (or 'upload' if no version)
    const pathAfterUpload = parts.slice(uploadIndex + 2).join("/");
    // Remove file extension
    const publicId = pathAfterUpload.substring(
      0,
      pathAfterUpload.lastIndexOf(".")
    );
    return publicId;
  } catch (error) {
    logger.error("Error extracting public ID from URL:", error);
    return null;
  }
};

export default cloudinary;
