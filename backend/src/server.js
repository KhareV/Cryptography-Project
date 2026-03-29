/**
 * Main Server Entry Point
 * Initializes Express server, MongoDB connection, and Socket.io
 */

import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";

// Database
import { connectDatabase, getDatabaseStatus } from "./config/db.js";

// Clerk
import { validateClerkConfig } from "./config/clerk.js";
import { clerkMiddleware } from "@clerk/express";

// Socket.io
import { initializeSocket } from "./socket/index.js";

// Middleware
import { apiLimiter } from "./middleware/rateLimiter.js";
import {
  notFoundHandler,
  globalErrorHandler,
} from "./middleware/errorHandler.js";

// Routes
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import conversationRoutes from "./routes/conversations.js";
import messageRoutes from "./routes/messages.js";
import uploadRoutes from "./routes/upload.js";
import callRoutes from "./routes/calls.js";
import groupRoutes from "./routes/groups.js";
import keyRoutes from "./routes/keys.js";
import anchorRoutes from "./routes/anchor.js";

// Jobs
import "./jobs/anchorJob.js";

// Utils
import { logger } from "./utils/helpers.js";

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =====================================================
// Environment Validation
// =====================================================

const validateEnvironment = () => {
  const requiredVars = [
    "MONGODB_URI",
    "CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
  ];

  const missing = requiredVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    logger.error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
    process.exit(1);
  }

  // Validate Clerk config
  validateClerkConfig();

  logger.info("✅ Environment validation passed");
};

// =====================================================
// Express App Setup
// =====================================================

const createApp = () => {
  const app = express();

  // Trust proxy for rate limiting behind reverse proxy
  app.set("trust proxy", 1);

  // Security middleware
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // CORS configuration
  const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(",").map((url) => url.trim())
    : ["http://localhost:3000"];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          logger.warn(`CORS blocked origin: ${origin}`);
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    }),
  );

  // Compression
  app.use(compression());

  // Body parsing
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Static files for uploads
  app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      if (req.path !== "/health" && req.path !== "/api/health") {
        logger.debug(
          `${req.method} ${req.path} ${res.statusCode} ${duration}ms`,
        );
      }
    });
    next();
  });

  // Rate limiting
  app.use("/api", apiLimiter);

  // Clerk middleware (must be before routes)
  app.use(clerkMiddleware());

  // =====================================================
  // Health Check Routes
  // =====================================================

  app.get("/health", (req, res) => {
    const dbStatus = getDatabaseStatus();
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbStatus,
      environment: process.env.NODE_ENV,
    });
  });

  app.get("/api/health", (req, res) => {
    res.status(200).json({
      status: "ok",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    });
  });

  // =====================================================
  // API Routes
  // =====================================================

  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/conversations", conversationRoutes);
  app.use("/api/messages", messageRoutes);
  app.use("/api/upload", uploadRoutes);
  app.use("/api/calls", callRoutes);
  app.use("/api/groups", groupRoutes);
  app.use("/api/keys", keyRoutes);
  app.use("/api/anchor", anchorRoutes);

  // =====================================================
  // Error Handling
  // =====================================================

  // 404 handler
  app.use(notFoundHandler);

  // Global error handler
  app.use(globalErrorHandler);

  return app;
};

// =====================================================
// Server Startup
// =====================================================

const startServer = async () => {
  try {
    // Validate environment
    validateEnvironment();

    // Connect to database
    await connectDatabase();

    // Create Express app
    const app = createApp();

    // Create HTTP server
    const httpServer = http.createServer(app);

    // Initialize Socket.io
    const io = initializeSocket(httpServer);

    // Store io instance on app for access in routes
    app.set("io", io);

    // Start server
    const PORT = parseInt(process.env.PORT) || 5000;

    httpServer.listen(PORT, () => {
      logger.info("=".repeat(50));
      logger.info("🚀 Real-Time Chat Server Started");
      logger.info("=".repeat(50));
      logger.info(`📡 HTTP Server: http://localhost:${PORT}`);
      logger.info(`🔌 WebSocket Server: ws://localhost:${PORT}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
      logger.info(`📊 Health Check: http://localhost:${PORT}/health`);
      logger.info("=".repeat(50));
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      logger.info(`\n${signal} received.  Starting graceful shutdown...`);

      // Close HTTP server
      httpServer.close(() => {
        logger.info("HTTP server closed");
      });

      // Close Socket.io connections
      io.close(() => {
        logger.info("Socket.io server closed");
      });

      // Close database connection
      const { disconnectDatabase } = await import("./config/db.js");
      await disconnectDatabase();

      logger.info("Graceful shutdown complete");
      process.exit(0);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      logger.error("Uncaught Exception:", error);
      process.exit(1);
    });

    process.on("unhandledRejection", (reason, promise) => {
      logger.error("Unhandled Rejection at:", promise, "reason:", reason);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Start the server
startServer();

export default startServer;
