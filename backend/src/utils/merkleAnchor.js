import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";
import { ApiError } from "./helpers.js";
import { computeMessageHash, computeMerkleRoot } from "./merkleTree.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const contractAddressesPath = path.resolve(
  __dirname,
  "../config/contractAddresses.json",
);

const anchorAbi = [
  "function anchor(string conversationId,string merkleRoot,uint256 messageCount)",
  "function getLatestAnchor(string conversationId) view returns (string merkleRoot,uint256 timestamp,address anchoredBy,uint256 messageCount)",
  "event Anchored(string indexed conversationId,string merkleRoot,uint256 messageCount,address anchoredBy,uint256 timestamp)",
];

let addressesCache = null;
let providerCache = null;
let walletCache = null;
let writeContractCache = null;
let readContractCache = null;

const getContractAddresses = () => {
  if (addressesCache) {
    return addressesCache;
  }

  if (!fs.existsSync(contractAddressesPath)) {
    throw new ApiError(
      500,
      "Contract addresses file is missing in backend config",
    );
  }

  const raw = fs.readFileSync(contractAddressesPath, "utf-8");
  const parsed = JSON.parse(raw);

  if (!parsed?.anchor) {
    throw new ApiError(500, "Anchor contract address is missing");
  }

  addressesCache = parsed;
  return addressesCache;
};

const getRpcProvider = () => {
  if (providerCache) {
    return providerCache;
  }

  const rpcUrl = process.env.SEPOLIA_RPC_URL || process.env.BLOCKCHAIN_RPC_URL;
  if (!rpcUrl) {
    throw new ApiError(500, "Missing SEPOLIA_RPC_URL for anchor operations");
  }

  providerCache = new ethers.JsonRpcProvider(rpcUrl);
  return providerCache;
};

const getWallet = () => {
  if (walletCache) {
    return walletCache;
  }

  const privateKey = process.env.BACKEND_WALLET_PRIVATE_KEY;
  if (!privateKey) {
    throw new ApiError(500, "Missing BACKEND_WALLET_PRIVATE_KEY");
  }

  walletCache = new ethers.Wallet(privateKey, getRpcProvider());
  return walletCache;
};

const getWriteContract = () => {
  if (writeContractCache) {
    return writeContractCache;
  }

  const { anchor } = getContractAddresses();
  writeContractCache = new ethers.Contract(anchor, anchorAbi, getWallet());
  return writeContractCache;
};

const getReadContract = () => {
  if (readContractCache) {
    return readContractCache;
  }

  const { anchor } = getContractAddresses();
  readContractCache = new ethers.Contract(anchor, anchorAbi, getRpcProvider());
  return readContractCache;
};

const toEtherscanTxLink = (txHash) =>
  txHash ? `https://sepolia.etherscan.io/tx/${txHash}` : "";

const toAnchorHashInput = (message) => {
  const senderValue =
    message?.senderId || message?.sender?._id || message?.sender || "";

  const encryptedData =
    message?.encryptedData ??
    (message?.isEncrypted
      ? JSON.stringify({
          content: message?.content || "",
          encryption: message?.encryption || {},
          type: message?.type || "text",
          fileUrl: message?.fileUrl || "",
        })
      : message?.content || "");

  return {
    _id: message?._id || message?.id,
    encryptedData,
    senderId: String(senderValue || ""),
    timestamp: message?.createdAt || message?.timestamp,
  };
};

const buildHashes = (messages = []) => {
  return messages.map((message) =>
    computeMessageHash(toAnchorHashInput(message)),
  );
};

const anchorScope = async (scopeId, messages) => {
  const hashes = buildHashes(messages);
  const merkleRoot = computeMerkleRoot(hashes);

  if (!merkleRoot) {
    throw new ApiError(400, "Cannot anchor empty message set");
  }

  const contract = getWriteContract();
  const tx = await contract.anchor(
    String(scopeId),
    merkleRoot,
    messages.length,
  );
  const receipt = await tx.wait();

  return {
    txHash: tx.hash,
    blockNumber: Number(receipt?.blockNumber || 0),
    merkleRoot,
    messageCount: messages.length,
    etherscanLink: toEtherscanTxLink(tx.hash),
  };
};

export const anchorConversation = async (conversationId, messages) => {
  return anchorScope(conversationId, messages);
};

export const anchorGroup = async (groupId, messages) => {
  return anchorScope(groupId, messages);
};

export const getLatestAnchor = async (scopeId) => {
  try {
    const contract = getReadContract();
    const [merkleRoot, timestamp, anchoredBy, messageCount] =
      await contract.getLatestAnchor(String(scopeId));

    return {
      merkleRoot,
      timestamp: Number(timestamp || 0),
      anchoredBy,
      messageCount: Number(messageCount || 0),
      anchoredAt: Number(timestamp || 0)
        ? new Date(Number(timestamp) * 1000)
        : null,
    };
  } catch (error) {
    if (
      String(error?.message || "")
        .toLowerCase()
        .includes("no anchors")
    ) {
      return null;
    }

    throw error;
  }
};

export const getLatestAnchorEvent = async (scopeId) => {
  const contract = getReadContract();
  const provider = getRpcProvider();
  const latestBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, latestBlock - 1_500_000);

  const filter = contract.filters.Anchored(String(scopeId));
  const events = await contract.queryFilter(filter, fromBlock, "latest");

  if (!events.length) {
    return null;
  }

  const latestEvent = events[events.length - 1];

  return {
    txHash: latestEvent.transactionHash || "",
    blockNumber: Number(latestEvent.blockNumber || 0),
    merkleRoot: latestEvent.args?.merkleRoot || "",
    messageCount: Number(latestEvent.args?.messageCount || 0),
    anchoredBy: latestEvent.args?.anchoredBy || "",
    timestamp: Number(latestEvent.args?.timestamp || 0),
    anchoredAt: Number(latestEvent.args?.timestamp || 0)
      ? new Date(Number(latestEvent.args.timestamp) * 1000)
      : null,
    etherscanLink: toEtherscanTxLink(latestEvent.transactionHash || ""),
  };
};

export const getAnchorHashesForMessages = (messages = []) => {
  return buildHashes(messages);
};

export default {
  anchorConversation,
  anchorGroup,
  getLatestAnchor,
  getLatestAnchorEvent,
  getAnchorHashesForMessages,
};
