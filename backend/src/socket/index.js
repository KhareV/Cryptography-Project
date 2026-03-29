/**
 * Socket.io Main Setup
 * Configures Socket.io server and event handlers
 */

import { Server } from "socket.io";
import { authenticateSocket } from "./middleware/socketAuth.js";
import { socketManager } from "../utils/socketManager.js";
import { logger } from "../utils/helpers.js";

// Import handlers
import {
  handleSendMessage,
  handleMarkMessageRead,
  handleMarkConversationRead,
  handleDeleteMessage,
  handleMessageReaction,
} from "./handlers/messageHandlers.js";

import {
  handleTypingStart,
  handleTypingStop,
  handleGetTypingUsers,
} from "./handlers/typingHandlers.js";

import {
  handleUserConnect,
  handleUserDisconnect,
  handleStatusUpdate,
  handleGetOnlineStatus,
  handleHeartbeat,
  handleJoinConversation,
  handleLeaveConversation,
} from "./handlers/statusHandlers.js";

import {
  handleCallInitiate,
  handleCallAccept,
  handleCallReject,
  handleCallAnswer,
  handleCallIceCandidate,
  handleCallOffer,
  handleCallEnd,
} from "./handlers/callHandlers.js";

import {
  handleGroupCreate,
  handleGroupJoin,
  handleGroupLeave,
  handleGroupSendMessage,
} from "./handlers/groupHandlers.js";

/**
 * Initialize Socket.io server
 * @param {Object} httpServer - HTTP server instance
 * @returns {Object} Socket.io server instance
 */
export const initializeSocket = (httpServer) => {
  // Get allowed origins from environment
  const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(",").map((url) => url.trim())
    : ["http://localhost:3000"];

  // Create Socket. io server
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ["websocket", "polling"],
    allowEIO3: true,
  });

  // Initialize socket manager with io instance
  socketManager.initialize(io);

  // Apply authentication middleware
  io.use(authenticateSocket);

  // Handle connections
  io.on("connection", async (socket) => {
    logger.info(`New socket connection: ${socket.id}`);

    // Handle user connect (update status, join rooms)
    await handleUserConnect(socket);

    // =====================================================
    // Message Events
    // =====================================================

    socket.on("message:send", (data, callback) => {
      handleSendMessage(socket, data, callback);
    });

    socket.on("message:read", (data, callback) => {
      handleMarkMessageRead(socket, data, callback);
    });

    socket.on("message:delete", (data, callback) => {
      handleDeleteMessage(socket, data, callback);
    });

    socket.on("message:reaction", (data, callback) => {
      handleMessageReaction(socket, data, callback);
    });

    // =====================================================
    // Conversation Events
    // =====================================================

    socket.on("conversation:read", (data, callback) => {
      handleMarkConversationRead(socket, data, callback);
    });

    socket.on("conversation:join", (data, callback) => {
      handleJoinConversation(socket, data, callback);
    });

    socket.on("conversation:leave", (data, callback) => {
      handleLeaveConversation(socket, data, callback);
    });

    // =====================================================
    // Typing Events
    // =====================================================

    socket.on("typing:start", (data, callback) => {
      handleTypingStart(socket, data, callback);
    });

    socket.on("typing:stop", (data, callback) => {
      handleTypingStop(socket, data, callback);
    });

    socket.on("typing:get", (data, callback) => {
      handleGetTypingUsers(socket, data, callback);
    });

    // =====================================================
    // Status Events
    // =====================================================

    socket.on("status:update", (data, callback) => {
      handleStatusUpdate(socket, data, callback);
    });

    socket.on("status:get", (data, callback) => {
      handleGetOnlineStatus(socket, data, callback);
    });

    socket.on("heartbeat", (data, callback) => {
      handleHeartbeat(socket, data, callback);
    });

    // =====================================================
    // Call Events
    // =====================================================

    socket.on("call:initiate", (data, callback) => {
      handleCallInitiate(socket, data, callback);
    });

    socket.on("call:accept", (data, callback) => {
      handleCallAccept(socket, data, callback);
    });

    socket.on("call:reject", (data, callback) => {
      handleCallReject(socket, data, callback);
    });

    socket.on("call:ice-candidate", (data, callback) => {
      handleCallIceCandidate(socket, data, callback);
    });

    socket.on("call:offer", (data, callback) => {
      handleCallOffer(socket, data, callback);
    });

    socket.on("call:answer", (data, callback) => {
      handleCallAnswer(socket, data, callback);
    });

    socket.on("call:end", (data, callback) => {
      handleCallEnd(socket, data, callback);
    });

    // =====================================================
    // Group Events
    // =====================================================

    socket.on("group:create", (data, callback) => {
      handleGroupCreate(socket, data, callback);
    });

    socket.on("group:join", (data, callback) => {
      handleGroupJoin(socket, data, callback);
    });

    socket.on("group:leave", (data, callback) => {
      handleGroupLeave(socket, data, callback);
    });

    socket.on("group:message:send", (data, callback) => {
      handleGroupSendMessage(socket, data, callback);
    });

    // =====================================================
    // Disconnect Event
    // =====================================================

    socket.on("disconnect", async (reason) => {
      logger.info(`Socket disconnected: ${socket.id}, reason: ${reason}`);
      await handleUserDisconnect(socket);
    });

    // =====================================================
    // Error Event
    // =====================================================

    socket.on("error", (error) => {
      logger.error(`Socket error for ${socket.id}:`, error.message);
    });
  });

  // Log socket server stats periodically
  setInterval(() => {
    const stats = socketManager.getStats();
    logger.debug("Socket stats:", stats);
  }, 60000); // Every minute

  logger.info("Socket. io server initialized");

  return io;
};

/**
 * Get Socket.io server instance
 * @returns {Object} Socket.io server instance
 */
export const getIO = () => {
  return socketManager.io;
};

export default {
  initializeSocket,
  getIO,
};
