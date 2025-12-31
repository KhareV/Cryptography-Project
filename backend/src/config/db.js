/**
 * MongoDB Database Configuration
 * Handles connection to MongoDB with proper error handling and connection pooling
 */

import mongoose from "mongoose";
import { logger } from "../utils/helpers.js";

// MongoDB connection options optimized for production
const connectionOptions = {
  maxPoolSize: 10,
  minPoolSize: 2,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 5000,
  heartbeatFrequencyMS: 10000,
  retryWrites: true,
  w: "majority",
};

/**
 * Connect to MongoDB database
 * @returns {Promise<mongoose. Connection>} Mongoose connection instance
 */
export const connectDatabase = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    logger.error("MONGODB_URI environment variable is not defined");
    throw new Error("Database connection string is required");
  }

  try {
    // Set up connection event handlers before connecting
    mongoose.connection.on("connected", () => {
      logger.info("✅ MongoDB connected successfully");
    });

    mongoose.connection.on("error", (error) => {
      logger.error("❌ MongoDB connection error:", error.message);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("⚠️ MongoDB disconnected");
    });

    mongoose.connection.on("reconnected", () => {
      logger.info("🔄 MongoDB reconnected");
    });

    // Connect to MongoDB
    const connection = await mongoose.connect(mongoUri, connectionOptions);

    logger.info(`📦 MongoDB connected to: ${connection.connection.host}`);
    logger.info(`📊 Database name: ${connection.connection.name}`);

    return connection;
  } catch (error) {
    logger.error("❌ Failed to connect to MongoDB:", error.message);
    throw error;
  }
};

/**
 * Gracefully disconnect from MongoDB
 * @returns {Promise<void>}
 */
export const disconnectDatabase = async () => {
  try {
    await mongoose.connection.close();
    logger.info("🔌 MongoDB connection closed gracefully");
  } catch (error) {
    logger.error("❌ Error closing MongoDB connection:", error.message);
    throw error;
  }
};

/**
 * Get database connection status
 * @returns {Object} Connection status information
 */
export const getDatabaseStatus = () => {
  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  return {
    status: states[mongoose.connection.readyState],
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host || "N/A",
    name: mongoose.connection.name || "N/A",
  };
};

// Handle process termination
process.on("SIGINT", async () => {
  await disconnectDatabase();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await disconnectDatabase();
  process.exit(0);
});

export default {
  connectDatabase,
  disconnectDatabase,
  getDatabaseStatus,
};
