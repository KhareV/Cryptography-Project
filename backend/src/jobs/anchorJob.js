import cron from "node-cron";
import Conversation from "../models/Conversation.js";
import Group from "../models/Group.js";
import Message from "../models/Message.js";
import { logger } from "../utils/helpers.js";
import { anchorConversation, anchorGroup } from "../utils/merkleAnchor.js";

const LOOKBACK_HOURS = 48;
const MESSAGE_BATCH_LIMIT = 100;

const isAnchoringConfigured = () => {
  return Boolean(
    process.env.BACKEND_WALLET_PRIVATE_KEY &&
    (process.env.SEPOLIA_RPC_URL || process.env.BLOCKCHAIN_RPC_URL),
  );
};

const fetchLatestConversationMessages = async (conversationId) => {
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

const fetchLatestGroupMessages = async (groupId) => {
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

export const runAnchorSweep = async () => {
  if (!isAnchoringConfigured()) {
    logger.warn(
      "Skipping anchor job: BACKEND_WALLET_PRIVATE_KEY or SEPOLIA_RPC_URL is missing",
    );
    return;
  }

  const cutoff = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000);

  const conversationIds = await Message.distinct("conversationId", {
    conversationId: { $ne: null },
    createdAt: { $gte: cutoff },
    isDeleted: false,
  });

  const groupIds = await Message.distinct("groupId", {
    groupId: { $ne: null },
    createdAt: { $gte: cutoff },
    isDeleted: false,
  });

  let anchoredConversations = 0;
  let anchoredGroups = 0;

  for (const conversationId of conversationIds) {
    try {
      const conversation = await Conversation.findById(conversationId);
      if (!conversation || !conversation.isActive) {
        continue;
      }

      const messages = await fetchLatestConversationMessages(conversationId);
      if (!messages.length) {
        continue;
      }

      const result = await anchorConversation(
        conversationId.toString(),
        messages,
      );

      conversation.lastAnchor = {
        txHash: result.txHash,
        merkleRoot: result.merkleRoot,
        anchoredAt: new Date(),
        messageCount: result.messageCount,
      };

      await conversation.save();
      anchoredConversations += 1;
    } catch (error) {
      logger.error(
        `Anchor job failed for conversation ${conversationId}: ${error.message}`,
      );
    }
  }

  for (const groupId of groupIds) {
    try {
      const group = await Group.findById(groupId);
      if (!group || !group.isActive) {
        continue;
      }

      const messages = await fetchLatestGroupMessages(groupId);
      if (!messages.length) {
        continue;
      }

      const result = await anchorGroup(groupId.toString(), messages);

      group.lastAnchor = {
        txHash: result.txHash,
        merkleRoot: result.merkleRoot,
        anchoredAt: new Date(),
        messageCount: result.messageCount,
      };

      await group.save();
      anchoredGroups += 1;
    } catch (error) {
      logger.error(`Anchor job failed for group ${groupId}: ${error.message}`);
    }
  }

  logger.info(
    `Anchored ${anchoredConversations} conversations, ${anchoredGroups} groups`,
  );
};

cron.schedule("0 3 * * *", async () => {
  try {
    await runAnchorSweep();
  } catch (error) {
    logger.error(`Anchor job crashed: ${error.message}`);
  }
});

logger.info("Anchor cron job scheduled: 0 3 * * * (daily at 3:00 AM)");
