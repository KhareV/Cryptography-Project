/**
 * Socket. io Configuration
 * Additional socket configuration utilities
 */

import { logger } from "../utils/helpers.js";

/**
 * Socket.io server options
 */
export const socketOptions = {
  // CORS configuration
  cors: {
    origin: process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(",").map((url) => url.trim())
      : ["http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true,
  },

  // Connection settings
  pingTimeout: 60000,
  pingInterval: 25000,

  // Transport settings
  transports: ["websocket", "polling"],
  allowEIO3: true,

  // Upgrade settings
  allowUpgrades: true,
  upgradeTimeout: 10000,

  // Packet settings
  maxHttpBufferSize: 1e6, // 1MB

  // Path
  path: "/socket.io/",

  // Serve client
  serveClient: false,

  // Connection state recovery
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true,
  },
};

/**
 * Socket event names
 */
export const SOCKET_EVENTS = {
  // Connection events
  CONNECT: "connect",
  DISCONNECT: "disconnect",
  CONNECT_ERROR: "connect_error",

  // Message events
  MESSAGE_SEND: "message:send",
  MESSAGE_NEW: "message:new",
  MESSAGE_READ: "message:read",
  MESSAGE_DELIVERED: "message:delivered",
  MESSAGE_DELETED: "message:deleted",
  MESSAGE_EDITED: "message:edited",
  MESSAGE_REACTION: "message:reaction",

  // Conversation events
  CONVERSATION_NEW: "conversation:new",
  CONVERSATION_READ: "conversation:read",
  CONVERSATION_UPDATED: "conversation:updated",
  CONVERSATION_JOIN: "conversation:join",
  CONVERSATION_LEAVE: "conversation:leave",

  // Typing events
  TYPING_START: "typing:start",
  TYPING_STOP: "typing:stop",
  TYPING_GET: "typing:get",

  // Status events
  STATUS_UPDATE: "status:update",
  STATUS_GET: "status:get",
  USER_ONLINE: "user:online",
  USER_OFFLINE: "user:offline",
  USER_STATUS: "user:status",

  // System events
  CONNECTED: "connected",
  ERROR: "error",
  HEARTBEAT: "heartbeat",
};

/**
 * Room name generators
 */
export const getRoomNames = {
  user: (userId) => `user:${userId}`,
  conversation: (conversationId) => `conversation:${conversationId}`,
};

/**
 * Log socket statistics
 * @param {Object} io - Socket.io server instance
 */
export const logSocketStats = (io) => {
  const sockets = io.sockets.sockets;
  const rooms = io.sockets.adapter.rooms;

  const stats = {
    connectedSockets: sockets.size,
    totalRooms: rooms.size,
    timestamp: new Date().toISOString(),
  };

  logger.debug("Socket. io Stats:", stats);
  return stats;
};

/**
 * Get all sockets in a room
 * @param {Object} io - Socket. io server instance
 * @param {string} roomName - Room name
 * @returns {Array} Array of socket IDs
 */
export const getSocketsInRoom = (io, roomName) => {
  const room = io.sockets.adapter.rooms.get(roomName);
  return room ? Array.from(room) : [];
};

/**
 * Broadcast to room excluding sender
 * @param {Object} io - Socket.io server instance
 * @param {string} roomName - Room name
 * @param {string} event - Event name
 * @param {Object} data - Event data
 * @param {string} excludeSocketId - Socket ID to exclude
 */
export const broadcastToRoom = (
  io,
  roomName,
  event,
  data,
  excludeSocketId = null
) => {
  if (excludeSocketId) {
    io.to(roomName).except(excludeSocketId).emit(event, data);
  } else {
    io.to(roomName).emit(event, data);
  }
};

export default {
  socketOptions,
  SOCKET_EVENTS,
  getRoomNames,
  logSocketStats,
  getSocketsInRoom,
  broadcastToRoom,
};
