import { ethers } from "ethers";
import { BLOCKCHAIN_CONFIG } from "@/lib/blockchainConfig";

export const anchorAbi = [
  "function getLatestAnchor(string conversationId) view returns (string merkleRoot,uint256 timestamp,address anchoredBy,uint256 messageCount)",
  "event Anchored(string indexed conversationId,string merkleRoot,uint256 messageCount,address anchoredBy,uint256 timestamp)",
];

export const getAnchorReadContract = () => {
  const provider = new ethers.JsonRpcProvider(BLOCKCHAIN_CONFIG.rpcUrl);
  return new ethers.Contract(
    BLOCKCHAIN_CONFIG.anchorAddress,
    anchorAbi,
    provider,
  );
};

export const getAnchorReadProvider = () => {
  return new ethers.JsonRpcProvider(BLOCKCHAIN_CONFIG.rpcUrl);
};

export const getLatestAnchorOnChain = async (scopeId) => {
  const contract = getAnchorReadContract();
  const [merkleRoot, timestamp, anchoredBy, messageCount] =
    await contract.getLatestAnchor(scopeId);

  return {
    merkleRoot,
    timestamp: Number(timestamp || 0),
    anchoredBy,
    messageCount: Number(messageCount || 0),
  };
};

export default {
  getAnchorReadContract,
  getAnchorReadProvider,
  getLatestAnchorOnChain,
};
