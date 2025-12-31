/**
 * Socket.io Call Event Handlers
 * Handles real-time voice calling functionality
 */

import { socketManager } from "../../utils/socketManager.js";
import { logger, ApiError } from "../../utils/helpers.js";
import Conversation from "../../models/Conversation.js";

/**
 * Handle initiating a voice call
 * @param {Object} socket - Socket instance
 * @param {Object} data - Call data
 * @param {Function} callback - Acknowledgment callback
 */
export const handleCallInitiate = async (socket, data, callback) => {
  try {
    const { conversationId, callType = "voice" } = data;
    const callerId = socket.userId;

    // Verify conversation exists and user is participant
    const conversation = await Conversation.findById(conversationId).populate(
      "participants",
      "_id username firstName lastName avatar status"
    );

    if (!conversation) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Conversation not found" });
      }
      return;
    }

    if (!conversation.isParticipant(callerId)) {
      if (typeof callback === "function") {
        callback({
          success: false,
          error: "Not a participant in this conversation",
        });
      }
      return;
    }

    // Get the other participant
    const otherParticipant = conversation.participants.find(
      (p) => p._id.toString() !== callerId
    );

    if (!otherParticipant) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Other participant not found" });
      }
      return;
    }

    // Generate unique call ID
    const callId = `call_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Get caller info
    const caller = conversation.participants.find(
      (p) => p._id.toString() === callerId
    );

    const callData = {
      callId,
      conversationId,
      callType,
      caller: {
        id: caller._id.toString(),
        username: caller.username,
        firstName: caller.firstName,
        lastName: caller.lastName,
        avatar: caller.avatar,
      },
      recipient: {
        id: otherParticipant._id.toString(),
        username: otherParticipant.username,
        firstName: otherParticipant.firstName,
        lastName: otherParticipant.lastName,
        avatar: otherParticipant.avatar,
      },
      status: "ringing",
      startTime: new Date().toISOString(),
    };

    // Store call in socket manager
    socketManager.setCallData(callId, callData);

    // Emit call incoming to recipient
    const recipientSocketIds = socketManager.getUserSockets(
      otherParticipant._id.toString()
    );
    if (recipientSocketIds && recipientSocketIds.length > 0) {
      recipientSocketIds.forEach((socketId) => {
        const recipientSocket = socketManager.getSocket(socketId);
        if (recipientSocket) {
          recipientSocket.emit("call_incoming", callData);
        }
      });

      logger.info(
        `📞 Call initiated: ${callId} from ${caller.username} to ${otherParticipant.username}`
      );

      if (typeof callback === "function") {
        callback({ success: true, callId, callData });
      }
    } else {
      // Recipient is offline
      if (typeof callback === "function") {
        callback({
          success: false,
          error: "Recipient is not available",
          userOffline: true,
        });
      }
    }
  } catch (error) {
    logger.error("Error handling call initiate:", error);
    if (typeof callback === "function") {
      callback({ success: false, error: "Failed to initiate call" });
    }
  }
};

/**
 * Handle answering a call
 * @param {Object} socket - Socket instance
 * @param {Object} data - Call answer data
 * @param {Function} callback - Acknowledgment callback
 */
export const handleCallAnswer = async (socket, data, callback) => {
  try {
    const { callId } = data;
    const answerId = socket.userId;

    const callData = socketManager.getCallData(callId);
    if (!callData) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Call not found" });
      }
      return;
    }

    // Verify the answering user is the recipient
    if (callData.recipient.id !== answerId) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Unauthorized to answer this call" });
      }
      return;
    }

    // Update call status
    callData.status = "answered";
    callData.answerTime = new Date().toISOString();
    socketManager.setCallData(callId, callData);

    // Notify caller that call was answered
    const callerSocketIds = socketManager.getUserSockets(callData.caller.id);
    if (callerSocketIds && callerSocketIds.length > 0) {
      callerSocketIds.forEach((socketId) => {
        const callerSocket = socketManager.getSocket(socketId);
        if (callerSocket) {
          callerSocket.emit("call_answered", { callId, callData });
        }
      });
    }

    logger.info(`📞 Call answered: ${callId}`);

    if (typeof callback === "function") {
      callback({ success: true, callData });
    }
  } catch (error) {
    logger.error("Error handling call answer:", error);
    if (typeof callback === "function") {
      callback({ success: false, error: "Failed to answer call" });
    }
  }
};

/**
 * Handle declining a call
 * @param {Object} socket - Socket instance
 * @param {Object} data - Call decline data
 * @param {Function} callback - Acknowledgment callback
 */
export const handleCallDecline = async (socket, data, callback) => {
  try {
    const { callId } = data;
    const declinerId = socket.userId;

    const callData = socketManager.getCallData(callId);
    if (!callData) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Call not found" });
      }
      return;
    }

    // Verify the declining user is the recipient
    if (callData.recipient.id !== declinerId) {
      if (typeof callback === "function") {
        callback({
          success: false,
          error: "Unauthorized to decline this call",
        });
      }
      return;
    }

    // Update call status
    callData.status = "declined";
    callData.endTime = new Date().toISOString();

    // Notify caller that call was declined
    const callerSocketIds = socketManager.getUserSockets(callData.caller.id);
    if (callerSocketIds && callerSocketIds.length > 0) {
      callerSocketIds.forEach((socketId) => {
        const callerSocket = socketManager.getSocket(socketId);
        if (callerSocket) {
          callerSocket.emit("call_declined", { callId, callData });
        }
      });
    }

    // Clean up call data
    socketManager.removeCallData(callId);

    logger.info(`📞 Call declined: ${callId}`);

    if (typeof callback === "function") {
      callback({ success: true });
    }
  } catch (error) {
    logger.error("Error handling call decline:", error);
    if (typeof callback === "function") {
      callback({ success: false, error: "Failed to decline call" });
    }
  }
};

/**
 * Handle ending a call
 * @param {Object} socket - Socket instance
 * @param {Object} data - Call end data
 * @param {Function} callback - Acknowledgment callback
 */
export const handleCallEnd = async (socket, data, callback) => {
  try {
    const { callId } = data;
    const enderId = socket.userId;

    const callData = socketManager.getCallData(callId);
    if (!callData) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Call not found" });
      }
      return;
    }

    // Verify the ending user is a participant
    const isParticipant =
      callData.caller.id === enderId || callData.recipient.id === enderId;
    if (!isParticipant) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Unauthorized to end this call" });
      }
      return;
    }

    // Update call status
    callData.status = "ended";
    callData.endTime = new Date().toISOString();

    // Notify other participant that call ended
    const otherParticipantId =
      enderId === callData.caller.id
        ? callData.recipient.id
        : callData.caller.id;

    const otherParticipantSocketIds =
      socketManager.getUserSockets(otherParticipantId);
    if (otherParticipantSocketIds && otherParticipantSocketIds.length > 0) {
      otherParticipantSocketIds.forEach((socketId) => {
        const participantSocket = socketManager.getSocket(socketId);
        if (participantSocket) {
          participantSocket.emit("call_ended", {
            callId,
            callData,
            endedBy: enderId,
          });
        }
      });
    }

    // Clean up call data
    socketManager.removeCallData(callId);

    logger.info(`📞 Call ended: ${callId} by user ${enderId}`);

    if (typeof callback === "function") {
      callback({ success: true });
    }
  } catch (error) {
    logger.error("Error handling call end:", error);
    if (typeof callback === "function") {
      callback({ success: false, error: "Failed to end call" });
    }
  }
};

/**
 * Handle call timeout (no answer)
 * @param {Object} socket - Socket instance
 * @param {Object} data - Call timeout data
 * @param {Function} callback - Acknowledgment callback
 */
export const handleCallTimeout = async (socket, data, callback) => {
  try {
    const { callId } = data;

    const callData = socketManager.getCallData(callId);
    if (!callData) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Call not found" });
      }
      return;
    }

    // Update call status
    callData.status = "missed";
    callData.endTime = new Date().toISOString();

    // Notify both participants that call timed out
    const callerSocketIds = socketManager.getUserSockets(callData.caller.id);
    if (callerSocketIds && callerSocketIds.length > 0) {
      callerSocketIds.forEach((socketId) => {
        const callerSocket = socketManager.getSocket(socketId);
        if (callerSocket) {
          callerSocket.emit("call_timeout", { callId, callData });
        }
      });
    }

    const recipientSocketIds = socketManager.getUserSockets(
      callData.recipient.id
    );
    if (recipientSocketIds && recipientSocketIds.length > 0) {
      recipientSocketIds.forEach((socketId) => {
        const recipientSocket = socketManager.getSocket(socketId);
        if (recipientSocket) {
          recipientSocket.emit("call_timeout", { callId, callData });
        }
      });
    }

    // Clean up call data
    socketManager.removeCallData(callId);

    logger.info(`📞 Call timed out: ${callId}`);

    if (typeof callback === "function") {
      callback({ success: true });
    }
  } catch (error) {
    logger.error("Error handling call timeout:", error);
    if (typeof callback === "function") {
      callback({ success: false, error: "Failed to handle call timeout" });
    }
  }
};

/**
 * Handle ICE candidate exchange for WebRTC
 * @param {Object} socket - Socket instance
 * @param {Object} data - ICE candidate data
 * @param {Function} callback - Acknowledgment callback
 */
export const handleIceCandidate = async (socket, data, callback) => {
  try {
    const { callId, candidate, to } = data;
    const senderId = socket.userId;

    logger.debug(
      `ICE candidate received from ${senderId}, callId: ${callId}, to: ${to}`
    );

    const callData = socketManager.getCallData(callId);
    if (!callData) {
      logger.warn(`Call data not found for callId: ${callId}`);
      return; // Call might have ended
    }

    // Determine the target user ID if 'to' is not provided
    const targetUserId =
      to ||
      (callData.caller.id === senderId
        ? callData.recipient.id
        : callData.caller.id);

    if (!targetUserId) {
      logger.warn("Cannot determine target user for ICE candidate");
      return;
    }

    logger.debug(`Forwarding ICE candidate to user: ${targetUserId}`);

    // Forward ICE candidate to the other participant
    const targetSocketIds = socketManager.getUserSockets(targetUserId);
    if (targetSocketIds && targetSocketIds.length > 0) {
      targetSocketIds.forEach((socketId) => {
        const targetSocket = socketManager.getSocket(socketId);
        if (targetSocket) {
          targetSocket.emit("ice_candidate", {
            callId,
            candidate,
            from: senderId,
          });
        }
      });
    }
  } catch (error) {
    logger.error("Error handling ICE candidate:", error);
  }
};

/**
 * Handle WebRTC offer exchange
 * @param {Object} socket - Socket instance
 * @param {Object} data - Offer data
 * @param {Function} callback - Acknowledgment callback
 */
export const handleRtcOffer = async (socket, data, callback) => {
  try {
    const { callId, offer, to } = data;
    const senderId = socket.userId;

    const callData = socketManager.getCallData(callId);
    if (!callData) {
      return; // Call might have ended
    }

    // Determine the target user ID if 'to' is not provided
    const targetUserId =
      to ||
      (callData.caller.id === senderId
        ? callData.recipient.id
        : callData.caller.id);

    if (!targetUserId) {
      console.warn("Cannot determine target user for RTC offer");
      return;
    }

    // Forward offer to the other participant
    const targetSocketIds = socketManager.getUserSockets(targetUserId);
    if (targetSocketIds && targetSocketIds.length > 0) {
      targetSocketIds.forEach((socketId) => {
        const targetSocket = socketManager.getSocket(socketId);
        if (targetSocket) {
          targetSocket.emit("rtc_offer", {
            callId,
            offer,
            from: senderId,
          });
        }
      });
    }
  } catch (error) {
    logger.error("Error handling RTC offer:", error);
  }
};

/**
 * Handle WebRTC answer exchange
 * @param {Object} socket - Socket instance
 * @param {Object} data - Answer data
 * @param {Function} callback - Acknowledgment callback
 */
export const handleRtcAnswer = async (socket, data, callback) => {
  try {
    const { callId, answer, to } = data;
    const senderId = socket.userId;

    const callData = socketManager.getCallData(callId);
    if (!callData) {
      return; // Call might have ended
    }

    // Determine the target user ID if 'to' is not provided
    const targetUserId =
      to ||
      (callData.caller.id === senderId
        ? callData.recipient.id
        : callData.caller.id);

    if (!targetUserId) {
      console.warn("Cannot determine target user for RTC answer");
      return;
    }

    // Forward answer to the other participant
    const targetSocketIds = socketManager.getUserSockets(targetUserId);
    if (targetSocketIds && targetSocketIds.length > 0) {
      targetSocketIds.forEach((socketId) => {
        const targetSocket = socketManager.getSocket(socketId);
        if (targetSocket) {
          targetSocket.emit("rtc_answer", {
            callId,
            answer,
            from: senderId,
          });
        }
      });
    }
  } catch (error) {
    logger.error("Error handling RTC answer:", error);
  }
};
