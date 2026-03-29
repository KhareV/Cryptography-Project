/**
 * Socket.io Call Event Handlers
 * Handles signaling for peer-to-peer audio calls
 */

import Call from "../../models/Call.js";
import { socketManager } from "../../utils/socketManager.js";
import { logger } from "../../utils/helpers.js";

const TERMINAL_STATUSES = new Set(["ended", "rejected", "missed"]);

const emitToUser = (userId, event, payload) => {
  const sockets = socketManager.getUserSockets(userId);
  if (!sockets.length) return;

  sockets.forEach((socketId) => {
    const userSocket = socketManager.getSocket(socketId);
    if (userSocket) {
      userSocket.emit(event, payload);
    }
  });
};

const emitCallPresenceChanged = (userId) => {
  const userIdStr = userId.toString();
  const { changed, isInCall } = socketManager.refreshUserCallState(userIdStr);

  if (!changed) return;

  const event = isInCall ? "user:in-call" : "user:call-ended";
  const payload = { userId: userIdStr, timestamp: new Date().toISOString() };

  socketManager.getOnlineUsers().forEach((onlineUserId) => {
    emitToUser(onlineUserId, event, payload);
  });
};

const updateCallEndState = async (callId, status) => {
  const call = await Call.findOne({ callId });
  const endedAt = new Date();

  if (!call) return { endedAt, duration: 0 };

  if (TERMINAL_STATUSES.has(call.status)) {
    return {
      endedAt: call.endedAt || endedAt,
      duration: typeof call.duration === "number" ? call.duration : 0,
    };
  }

  const duration = call.startedAt
    ? Math.max(
        0,
        Math.floor((endedAt.getTime() - call.startedAt.getTime()) / 1000),
      )
    : 0;

  call.status = status;
  call.endedAt = endedAt;
  call.duration = duration;
  await call.save();

  return { endedAt, duration };
};

/**
 * call:initiate
 * Payload: { to, callId, callerName, callerAvatar }
 */
export const handleCallInitiate = async (socket, data = {}, callback) => {
  try {
    const callerId = socket.userId.toString();
    const { to, callId, callerName = "Unknown", callerAvatar = "" } = data;

    if (!to || !callId) {
      if (typeof callback === "function") {
        callback({ success: false, error: "to and callId are required" });
      }
      return;
    }

    if (to.toString() === callerId) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Cannot call yourself" });
      }
      return;
    }

    await Call.findOneAndUpdate(
      { callId },
      {
        $setOnInsert: {
          callId,
          callType: "audio",
          callMode: "direct",
          initiatorId: callerId,
          receiverId: to,
        },
        $set: {
          status: "ringing",
          startedAt: null,
          endedAt: null,
          duration: 0,
        },
      },
      { new: true, upsert: true },
    );

    const targetSockets = socketManager.getUserSockets(to);
    if (!targetSockets.length) {
      await updateCallEndState(callId, "missed");

      socket.emit("call:user-offline", {
        callId,
        to,
        message: "User is offline",
      });

      if (typeof callback === "function") {
        callback({ success: false, error: "User is offline" });
      }
      return;
    }

    const busyCalls = socketManager.getUserActiveCalls(to).filter((call) => {
      return !TERMINAL_STATUSES.has(call.status);
    });

    if (busyCalls.length > 0) {
      await updateCallEndState(callId, "rejected");
      socket.emit("call:rejected", { callId, reason: "busy", from: to });

      if (typeof callback === "function") {
        callback({ success: false, error: "User is busy", reason: "busy" });
      }
      return;
    }

    socketManager.setCallData(callId, {
      callId,
      initiatorId: callerId,
      receiverId: to.toString(),
      status: "ringing",
      createdAt: new Date().toISOString(),
    });

    emitToUser(to, "call:incoming", {
      callId,
      callerId,
      callerName,
      callerAvatar,
    });

    if (typeof callback === "function") {
      callback({ success: true, callId });
    }

    logger.info(`Call initiated: ${callId} from ${callerId} to ${to}`);
  } catch (error) {
    logger.error("Error handling call:initiate:", error);
    if (typeof callback === "function") {
      callback({ success: false, error: "Failed to initiate call" });
    }
  }
};

/**
 * call:accept
 * Payload: { callId, to }
 */
export const handleCallAccept = async (socket, data = {}, callback) => {
  try {
    const accepterId = socket.userId.toString();
    const { callId, to } = data;

    if (!callId || !to) {
      if (typeof callback === "function") {
        callback({ success: false, error: "callId and to are required" });
      }
      return;
    }

    const startedAt = new Date();

    await Call.findOneAndUpdate(
      { callId },
      {
        $set: {
          status: "active",
          startedAt,
          endedAt: null,
          duration: 0,
        },
      },
      { new: true },
    );

    const existingCall = socketManager.getCallData(callId);
    if (existingCall) {
      socketManager.setCallData(callId, {
        ...existingCall,
        status: "active",
        acceptedAt: startedAt.toISOString(),
      });
    } else {
      socketManager.setCallData(callId, {
        callId,
        initiatorId: to.toString(),
        receiverId: accepterId,
        status: "active",
        acceptedAt: startedAt.toISOString(),
      });
    }

    emitToUser(to, "call:accepted", {
      callId,
      from: accepterId,
      startedAt: startedAt.toISOString(),
    });

    emitCallPresenceChanged(to.toString());
    emitCallPresenceChanged(accepterId);

    if (typeof callback === "function") {
      callback({ success: true, callId });
    }

    logger.info(`Call accepted: ${callId} by ${accepterId}`);
  } catch (error) {
    logger.error("Error handling call:accept:", error);
    if (typeof callback === "function") {
      callback({ success: false, error: "Failed to accept call" });
    }
  }
};

/**
 * call:reject
 * Payload: { callId, to, reason: 'busy' | 'declined' }
 */
export const handleCallReject = async (socket, data = {}, callback) => {
  try {
    const rejectorId = socket.userId.toString();
    const { callId, to, reason = "declined", missed = false } = data;

    if (!callId || !to) {
      if (typeof callback === "function") {
        callback({ success: false, error: "callId and to are required" });
      }
      return;
    }

    const safeReason = reason === "busy" ? "busy" : "declined";
    const status = missed ? "missed" : "rejected";
    const { endedAt, duration } = await updateCallEndState(callId, status);

    const existingCall = socketManager.getCallData(callId);
    socketManager.removeCallData(callId);

    emitToUser(to, "call:rejected", {
      callId,
      reason: safeReason,
      from: rejectorId,
      endedAt: endedAt.toISOString(),
      duration,
    });

    if (existingCall) {
      emitCallPresenceChanged(existingCall.initiatorId);
      emitCallPresenceChanged(existingCall.receiverId);
    } else {
      emitCallPresenceChanged(to.toString());
      emitCallPresenceChanged(rejectorId);
    }

    if (typeof callback === "function") {
      callback({ success: true, callId });
    }

    logger.info(`Call rejected: ${callId} by ${rejectorId} (${safeReason})`);
  } catch (error) {
    logger.error("Error handling call:reject:", error);
    if (typeof callback === "function") {
      callback({ success: false, error: "Failed to reject call" });
    }
  }
};

/**
 * call:ice-candidate
 * Payload: { callId, to, candidate }
 */
export const handleCallIceCandidate = async (socket, data = {}, callback) => {
  try {
    const senderId = socket.userId.toString();
    const { callId, to, candidate } = data;

    if (!callId || !to || !candidate) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Invalid ICE payload" });
      }
      return;
    }

    emitToUser(to, "call:ice-candidate", {
      callId,
      from: senderId,
      candidate,
    });

    if (typeof callback === "function") {
      callback({ success: true });
    }
  } catch (error) {
    logger.error("Error handling call:ice-candidate:", error);
    if (typeof callback === "function") {
      callback({ success: false, error: "Failed to relay ICE candidate" });
    }
  }
};

/**
 * call:offer
 * Payload: { callId, to, offer }
 */
export const handleCallOffer = async (socket, data = {}, callback) => {
  try {
    const senderId = socket.userId.toString();
    const { callId, to, offer } = data;

    if (!callId || !to || !offer) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Invalid offer payload" });
      }
      return;
    }

    emitToUser(to, "call:offer", {
      callId,
      from: senderId,
      offer,
    });

    if (typeof callback === "function") {
      callback({ success: true });
    }
  } catch (error) {
    logger.error("Error handling call:offer:", error);
    if (typeof callback === "function") {
      callback({ success: false, error: "Failed to relay offer" });
    }
  }
};

/**
 * call:answer
 * Payload: { callId, to, answer }
 */
export const handleCallAnswer = async (socket, data = {}, callback) => {
  try {
    const senderId = socket.userId.toString();
    const { callId, to, answer } = data;

    if (!callId || !to || !answer) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Invalid answer payload" });
      }
      return;
    }

    emitToUser(to, "call:answer", {
      callId,
      from: senderId,
      answer,
    });

    if (typeof callback === "function") {
      callback({ success: true });
    }
  } catch (error) {
    logger.error("Error handling call:answer:", error);
    if (typeof callback === "function") {
      callback({ success: false, error: "Failed to relay answer" });
    }
  }
};

/**
 * call:end
 * Payload: { callId, to }
 */
export const handleCallEnd = async (socket, data = {}, callback) => {
  try {
    const enderId = socket.userId.toString();
    const { callId, to } = data;

    if (!callId || !to) {
      if (typeof callback === "function") {
        callback({ success: false, error: "callId and to are required" });
      }
      return;
    }

    const { endedAt, duration } = await updateCallEndState(callId, "ended");

    const existingCall = socketManager.getCallData(callId);
    socketManager.removeCallData(callId);

    emitToUser(to, "call:ended", {
      callId,
      from: enderId,
      endedAt: endedAt.toISOString(),
      duration,
    });

    if (existingCall) {
      emitCallPresenceChanged(existingCall.initiatorId);
      emitCallPresenceChanged(existingCall.receiverId);
    } else {
      emitCallPresenceChanged(to.toString());
      emitCallPresenceChanged(enderId);
    }

    if (typeof callback === "function") {
      callback({ success: true, callId, duration });
    }

    logger.info(`Call ended: ${callId} by ${enderId}`);
  } catch (error) {
    logger.error("Error handling call:end:", error);
    if (typeof callback === "function") {
      callback({ success: false, error: "Failed to end call" });
    }
  }
};

/**
 * Cleanup calls when a peer goes offline mid-call
 */
export const handleUserOfflineCallCleanup = async (offlineUserId) => {
  const offlineId = offlineUserId.toString();
  const calls = socketManager.getUserActiveCalls(offlineId);

  if (!calls.length) {
    emitCallPresenceChanged(offlineId);
    return;
  }

  for (const call of calls) {
    const otherPeerId =
      call.initiatorId === offlineId ? call.receiverId : call.initiatorId;

    const status = call.status === "active" ? "ended" : "missed";
    const { endedAt, duration } = await updateCallEndState(call.callId, status);

    emitToUser(otherPeerId, "call:ended", {
      callId: call.callId,
      from: offlineId,
      dropped: true,
      endedAt: endedAt.toISOString(),
      duration,
    });

    socketManager.removeCallData(call.callId);
    emitCallPresenceChanged(otherPeerId);
  }

  emitCallPresenceChanged(offlineId);
};

export default {
  handleCallInitiate,
  handleCallAccept,
  handleCallReject,
  handleCallIceCandidate,
  handleCallOffer,
  handleCallAnswer,
  handleCallEnd,
  handleUserOfflineCallCleanup,
};
