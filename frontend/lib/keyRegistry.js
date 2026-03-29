import { ethers } from "ethers";
import { BLOCKCHAIN_CONFIG } from "@/lib/blockchainConfig";
import { generateUserKeyMaterial } from "@/lib/e2ee";

const keyRegistryAbi = [
  "function registerKey(string userId,string publicKey,string fingerprint)",
  "function revokeKey(string userId)",
  "function getKey(string userId) view returns (string publicKey,string fingerprint,bool revoked,uint256 registeredAt,address registeredBy)",
  "function isRegistered(string userId) view returns (bool)",
];

const getEthereumProvider = () => {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask is required");
  }

  return new ethers.BrowserProvider(window.ethereum);
};

const getReadProvider = () => {
  if (typeof window !== "undefined" && window.ethereum) {
    return new ethers.BrowserProvider(window.ethereum);
  }

  return new ethers.JsonRpcProvider(BLOCKCHAIN_CONFIG.rpcUrl);
};

const assertSepolia = async (provider) => {
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== BLOCKCHAIN_CONFIG.chainId) {
    throw new Error("Switch wallet network to Sepolia");
  }
};

export const buildUserKeyMaterial = async ({ password }) => {
  return generateUserKeyMaterial({ password });
};

export const registerKeyOnChain = async ({
  userId,
  publicKey,
  fingerprint,
}) => {
  const provider = getEthereumProvider();
  await assertSepolia(provider);

  const signer = await provider.getSigner();
  const contract = new ethers.Contract(
    BLOCKCHAIN_CONFIG.keyRegistryAddress,
    keyRegistryAbi,
    signer,
  );

  const tx = await contract.registerKey(userId, publicKey, fingerprint);
  const receipt = await tx.wait();

  return {
    txHash: tx.hash,
    blockNumber: Number(receipt?.blockNumber || 0),
  };
};

export const getKeyStatusOnChain = async (userId) => {
  const provider = getReadProvider();
  const contract = new ethers.Contract(
    BLOCKCHAIN_CONFIG.keyRegistryAddress,
    keyRegistryAbi,
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

export const revokeKeyOnChain = async (userId) => {
  const provider = getEthereumProvider();
  await assertSepolia(provider);

  const signer = await provider.getSigner();
  const contract = new ethers.Contract(
    BLOCKCHAIN_CONFIG.keyRegistryAddress,
    keyRegistryAbi,
    signer,
  );

  const tx = await contract.revokeKey(userId);
  const receipt = await tx.wait();

  return {
    txHash: tx.hash,
    blockNumber: Number(receipt?.blockNumber || 0),
  };
};
