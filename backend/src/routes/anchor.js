import { Router } from "express";
import { clerkMiddleware } from "@clerk/express";
import mongoose from "mongoose";
import { requireAuthentication } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { ApiError, sendSuccess } from "../utils/helpers.js";
import Conversation from "../models/Conversation.js";
import Group from "../models/Group.js";
import Message from "../models/Message.js";
import {
  anchorConversation,
  anchorGroup,
  getAnchorHashesForMessages,
  getLatestAnchor,
} from "../utils/merkleAnchor.js";
import { computeMerkleRoot } from "../utils/merkleTree.js";

const router = Router();

router.use(clerkMiddleware());

const MANUAL_ANCHOR_MIN_INTERVAL_MS = 60 * 60 * 1000;
const MESSAGE_BATCH_LIMIT = 100;

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const assertId = (value, label) => {
  if (!isValidObjectId(value)) {
    throw new ApiError(400, `Invalid ${label} ID`);
  }
};

const toTxEtherscanLink = (txHash) =>
  txHash ? `https://sepolia.etherscan.io/tx/${txHash}` : "";

const normalizeAnchorPayload = (anchor = null) => {
  if (!anchor?.merkleRoot) {
    return null;
  }

  return {
    txHash: anchor.txHash || "",
    merkleRoot: anchor.merkleRoot || "",
    anchoredAt: anchor.anchoredAt || null,
    messageCount: Number(anchor.messageCount || 0),
    etherscanLink: toTxEtherscanLink(anchor.txHash || ""),
  };
};

const fetchConversationMessages = async (conversationId) => {
  const messages = await Message.find({
    conversationId,
    isDeleted: false,
  })
    .select("_id content isEncrypted encryption sender createdAt type fileUrl")
    .sort({ createdAt: -1, _id: -1 })
    .limit(MESSAGE_BATCH_LIMIT)
    .lean();

  return messages.reverse();
};

const fetchGroupMessages = async (groupId) => {
  const messages = await Message.find({
    groupId,
    isDeleted: false,
  })
    .select("_id content isEncrypted encryption sender createdAt type fileUrl")
    .sort({ createdAt: -1, _id: -1 })
    .limit(MESSAGE_BATCH_LIMIT)
    .lean();

  return messages.reverse();
};

const enforceManualAnchorWindow = (lastAnchor) => {
  if (!lastAnchor?.anchoredAt) {
    return;
  }

  const diff = Date.now() - new Date(lastAnchor.anchoredAt).getTime();
  if (diff < MANUAL_ANCHOR_MIN_INTERVAL_MS) {
    const waitMinutes = Math.ceil(
      (MANUAL_ANCHOR_MIN_INTERVAL_MS - diff) / 60000,
    );
    throw new ApiError(
      429,
      `Manual anchor is rate limited for this thread. Try again in ${waitMinutes} minute(s).`,
    );
  }
};

const buildVerifyResult = ({
  computedMerkleRoot,
  chainAnchor,
  localAnchor,
  messageCount,
  fallbackTxHash,
}) => {
  if (!chainAnchor?.merkleRoot) {
    return {
      verified: false,
      messageCount,
      chainMerkleRoot: "",
      computedMerkleRoot: computedMerkleRoot || "",
      match: false,
      anchoredAt: null,
      etherscanLink: "",
      failReason: "No blockchain record found",
    };
  }

  const chainRoot = chainAnchor.merkleRoot;
  const dbRoot = localAnchor?.merkleRoot || "";
  const computedMatchesChain =
    Boolean(chainRoot) &&
    Boolean(computedMerkleRoot) &&
    computedMerkleRoot === chainRoot;
  const dbMatchesChain = Boolean(dbRoot) && dbRoot === chainRoot;

  let failReason = "";
  if (!dbRoot) {
    failReason = "Conversation/group does not have a stored local anchor";
  } else if (!dbMatchesChain) {
    failReason = "Stored DB Merkle root does not match on-chain record";
  } else if (!computedMatchesChain) {
    failReason = "Recomputed Merkle root does not match blockchain record";
  }

  const txHash = localAnchor?.txHash || fallbackTxHash || "";

  return {
    verified: computedMatchesChain && dbMatchesChain,
    messageCount,
    chainMerkleRoot: chainRoot,
    computedMerkleRoot: computedMerkleRoot || "",
    match: computedMatchesChain,
    anchoredAt: chainAnchor.anchoredAt || null,
    etherscanLink: toTxEtherscanLink(txHash),
    ...(failReason ? { failReason } : {}),
  };
};

router.get(
  "/conversation/:id",
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    assertId(id, "conversation");

    const conversation = await Conversation.findById(id).select(
      "participants isActive lastAnchor",
    );

    if (!conversation || !conversation.isActive) {
      throw new ApiError(404, "Conversation not found");
    }

    if (!conversation.isParticipant(req.userId)) {
      throw new ApiError(403, "Not a participant in this conversation");
    }

    sendSuccess(res, 200, "Anchor status retrieved", {
      lastAnchor: normalizeAnchorPayload(conversation.lastAnchor),
    });
  }),
);

router.get(
  "/group/:id",
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    assertId(id, "group");

    const group = await Group.findById(id).select(
      "members isActive lastAnchor",
    );

    if (!group || !group.isActive) {
      throw new ApiError(404, "Group not found");
    }

    if (!group.isMember(req.userId)) {
      throw new ApiError(403, "You are not a member of this group");
    }

    sendSuccess(res, 200, "Anchor status retrieved", {
      lastAnchor: normalizeAnchorPayload(group.lastAnchor),
    });
  }),
);

router.post(
  "/conversation/:id/now",
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    assertId(id, "conversation");

    const conversation = await Conversation.findById(id).select(
      "participants isActive lastAnchor",
    );

    if (!conversation || !conversation.isActive) {
      throw new ApiError(404, "Conversation not found");
    }

    if (!conversation.isParticipant(req.userId)) {
      throw new ApiError(403, "Not a participant in this conversation");
    }

    enforceManualAnchorWindow(conversation.lastAnchor);

    const messages = await fetchConversationMessages(id);
    if (!messages.length) {
      throw new ApiError(400, "No messages found to anchor");
    }

    const result = await anchorConversation(id, messages);
    conversation.lastAnchor = {
      txHash: result.txHash,
      merkleRoot: result.merkleRoot,
      anchoredAt: new Date(),
      messageCount: result.messageCount,
    };

    await conversation.save();

    sendSuccess(res, 200, "Conversation anchored", {
      anchor: normalizeAnchorPayload(conversation.lastAnchor),
    });
  }),
);

router.post(
  "/group/:id/now",
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    assertId(id, "group");

    const group = await Group.findById(id).select(
      "members isActive lastAnchor",
    );

    if (!group || !group.isActive) {
      throw new ApiError(404, "Group not found");
    }

    if (!group.isMember(req.userId)) {
      throw new ApiError(403, "You are not a member of this group");
    }

    enforceManualAnchorWindow(group.lastAnchor);

    const messages = await fetchGroupMessages(id);
    if (!messages.length) {
      throw new ApiError(400, "No messages found to anchor");
    }

    const result = await anchorGroup(id, messages);
    group.lastAnchor = {
      txHash: result.txHash,
      merkleRoot: result.merkleRoot,
      anchoredAt: new Date(),
      messageCount: result.messageCount,
    };

    await group.save();

    sendSuccess(res, 200, "Group anchored", {
      anchor: normalizeAnchorPayload(group.lastAnchor),
    });
  }),
);

router.get(
  "/conversation/:id/verify",
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    assertId(id, "conversation");

    const conversation = await Conversation.findById(id).select(
      "participants isActive lastAnchor",
    );

    if (!conversation || !conversation.isActive) {
      throw new ApiError(404, "Conversation not found");
    }

    if (!conversation.isParticipant(req.userId)) {
      throw new ApiError(403, "Not a participant in this conversation");
    }

    const [messages, chainAnchor] = await Promise.all([
      fetchConversationMessages(id),
      getLatestAnchor(id),
    ]);

    const computedMerkleRoot = computeMerkleRoot(
      getAnchorHashesForMessages(messages),
    );

    const verification = buildVerifyResult({
      computedMerkleRoot,
      chainAnchor,
      localAnchor: conversation.lastAnchor,
      messageCount: messages.length,
      fallbackTxHash: "",
    });

    sendSuccess(res, 200, "Conversation verification complete", verification);
  }),
);

router.get(
  "/group/:id/verify",
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    assertId(id, "group");

    const group = await Group.findById(id).select(
      "members isActive lastAnchor",
    );

    if (!group || !group.isActive) {
      throw new ApiError(404, "Group not found");
    }

    if (!group.isMember(req.userId)) {
      throw new ApiError(403, "You are not a member of this group");
    }

    const [messages, chainAnchor] = await Promise.all([
      fetchGroupMessages(id),
      getLatestAnchor(id),
    ]);

    const computedMerkleRoot = computeMerkleRoot(
      getAnchorHashesForMessages(messages),
    );

    const verification = buildVerifyResult({
      computedMerkleRoot,
      chainAnchor,
      localAnchor: group.lastAnchor,
      messageCount: messages.length,
      fallbackTxHash: "",
    });

    sendSuccess(res, 200, "Group verification complete", verification);
  }),
);

export default router;
