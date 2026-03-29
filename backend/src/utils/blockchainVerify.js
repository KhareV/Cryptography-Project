import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";
import { ApiError } from "./helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const contractAddressesPath = path.resolve(
  __dirname,
  "../config/contractAddresses.json",
);

const keyRegistryInterface = new ethers.Interface([
  "function registerKey(string userId,string publicKey,string fingerprint)",
  "function getKey(string userId) view returns (string publicKey,string fingerprint,bool revoked,uint256 registeredAt,address registeredBy)",
  "function isRegistered(string userId) view returns (bool)",
]);

const communityInterface = new ethers.Interface([
  "function createCommunity(string mongoGroupId,uint256 joinFeeWei)",
  "function joinCommunity(string mongoGroupId) payable",
  "function isMember(string mongoGroupId,address wallet) view returns (bool)",
]);

let providerCache = null;
let addressesCache = null;

const getRpcUrl = () => {
  return process.env.BLOCKCHAIN_RPC_URL || process.env.SEPOLIA_RPC_URL || "";
};

const getProvider = () => {
  const rpcUrl = getRpcUrl();
  if (!rpcUrl) {
    throw new ApiError(
      500,
      "Missing BLOCKCHAIN_RPC_URL or SEPOLIA_RPC_URL for blockchain verification",
    );
  }

  if (!providerCache) {
    providerCache = new ethers.JsonRpcProvider(rpcUrl);
  }

  return providerCache;
};

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

  if (!parsed?.keyRegistry || !parsed?.community || !parsed?.anchor) {
    throw new ApiError(500, "Contract addresses are incomplete");
  }

  addressesCache = parsed;
  return addressesCache;
};

const assertValidTxHash = (txHash) => {
  if (!ethers.isHexString(txHash, 32)) {
    throw new ApiError(400, "Invalid transaction hash format");
  }
};

const assertValidWallet = (walletAddress) => {
  if (!walletAddress || !ethers.isAddress(walletAddress)) {
    throw new ApiError(400, "Invalid wallet address");
  }
};

const loadTxAndReceipt = async (txHash) => {
  assertValidTxHash(txHash);

  const provider = getProvider();
  const tx = await provider.getTransaction(txHash);
  if (!tx) {
    throw new ApiError(400, "Transaction not found on chain");
  }

  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) {
    throw new ApiError(400, "Transaction receipt not available yet");
  }

  if (receipt.status !== 1) {
    throw new ApiError(400, "Transaction failed on chain");
  }

  return { tx, receipt };
};

const assertTxRecipient = (tx, expectedAddress, message) => {
  if (!tx.to || tx.to.toLowerCase() !== expectedAddress.toLowerCase()) {
    throw new ApiError(400, message);
  }
};

const assertTxSender = (tx, walletAddress, message) => {
  if (walletAddress && tx.from.toLowerCase() !== walletAddress.toLowerCase()) {
    throw new ApiError(400, message);
  }
};

export const verifyKeyRegistrationTx = async ({
  txHash,
  userId,
  walletAddress,
  publicKey,
  fingerprint,
}) => {
  assertValidWallet(walletAddress);

  const { keyRegistry } = getContractAddresses();
  const { tx, receipt } = await loadTxAndReceipt(txHash);

  assertTxRecipient(tx, keyRegistry, "Transaction target is not KeyRegistry");
  assertTxSender(tx, walletAddress, "Wallet does not match transaction sender");

  let parsed;
  try {
    parsed = keyRegistryInterface.parseTransaction({
      data: tx.data,
      value: tx.value,
    });
  } catch {
    throw new ApiError(400, "Could not decode key registration transaction");
  }

  if (!parsed || parsed.name !== "registerKey") {
    throw new ApiError(400, "Transaction is not a registerKey call");
  }

  const [txUserId, txPublicKey, txFingerprint] = parsed.args;
  if (txUserId !== userId) {
    throw new ApiError(400, "userId in transaction does not match request");
  }

  if (txPublicKey !== publicKey || txFingerprint !== fingerprint) {
    throw new ApiError(400, "Key payload mismatch between request and chain");
  }

  return {
    txHash,
    blockNumber: receipt.blockNumber,
    walletAddress: tx.from,
  };
};

export const verifyCreateCommunityTx = async ({
  txHash,
  groupId,
  walletAddress,
  joinFeeEth,
}) => {
  assertValidWallet(walletAddress);

  const { community } = getContractAddresses();
  const { tx, receipt } = await loadTxAndReceipt(txHash);

  assertTxRecipient(
    tx,
    community,
    "Transaction target is not Community contract",
  );
  assertTxSender(tx, walletAddress, "Wallet does not match transaction sender");

  let parsed;
  try {
    parsed = communityInterface.parseTransaction({
      data: tx.data,
      value: tx.value,
    });
  } catch {
    throw new ApiError(400, "Could not decode community creation transaction");
  }

  if (!parsed || parsed.name !== "createCommunity") {
    throw new ApiError(400, "Transaction is not a createCommunity call");
  }

  const [txGroupId, txJoinFeeWei] = parsed.args;
  const expectedJoinFeeWei = ethers.parseEther(String(joinFeeEth || 0));

  if (txGroupId !== groupId) {
    throw new ApiError(400, "Group id in transaction does not match request");
  }

  if (txJoinFeeWei !== expectedJoinFeeWei) {
    throw new ApiError(400, "Join fee in transaction does not match request");
  }

  return {
    txHash,
    blockNumber: receipt.blockNumber,
    walletAddress: tx.from,
  };
};

export const verifyJoinCommunityTx = async ({
  txHash,
  groupId,
  walletAddress,
  joinFeeEth,
}) => {
  assertValidWallet(walletAddress);

  const { community } = getContractAddresses();
  const { tx, receipt } = await loadTxAndReceipt(txHash);

  assertTxRecipient(
    tx,
    community,
    "Transaction target is not Community contract",
  );
  assertTxSender(tx, walletAddress, "Wallet does not match transaction sender");

  let parsed;
  try {
    parsed = communityInterface.parseTransaction({
      data: tx.data,
      value: tx.value,
    });
  } catch {
    throw new ApiError(400, "Could not decode community join transaction");
  }

  if (!parsed || parsed.name !== "joinCommunity") {
    throw new ApiError(400, "Transaction is not a joinCommunity call");
  }

  const [txGroupId] = parsed.args;
  const requiredFeeWei = ethers.parseEther(String(joinFeeEth || 0));

  if (txGroupId !== groupId) {
    throw new ApiError(400, "Group id in transaction does not match request");
  }

  if (tx.value < requiredFeeWei) {
    throw new ApiError(400, "Join transaction value is below required fee");
  }

  return {
    txHash,
    blockNumber: receipt.blockNumber,
    walletAddress: tx.from,
  };
};

export const getOnChainKeyStatus = async (userId) => {
  const { keyRegistry } = getContractAddresses();
  const provider = getProvider();

  const contract = new ethers.Contract(
    keyRegistry,
    keyRegistryInterface,
    provider,
  );

  const [publicKey, fingerprint, revoked, registeredAt, registeredBy] =
    await contract.getKey(userId);
  const registered = await contract.isRegistered(userId);

  return {
    registered,
    revoked,
    publicKey,
    fingerprint,
    registeredAt: Number(registeredAt || 0),
    registeredBy,
  };
};

export const getOnChainCommunityMembership = async (groupId, walletAddress) => {
  assertValidWallet(walletAddress);

  const { community } = getContractAddresses();
  const provider = getProvider();

  const contract = new ethers.Contract(community, communityInterface, provider);

  return contract.isMember(groupId, walletAddress);
};

export const getContractAddressSummary = () => {
  return getContractAddresses();
};
