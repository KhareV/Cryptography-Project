import { ethers } from "ethers";
import { BLOCKCHAIN_CONFIG } from "@/lib/blockchainConfig";

const communityAbi = [
  "function createCommunity(string mongoGroupId,uint256 joinFeeWei)",
  "function joinCommunity(string mongoGroupId) payable",
  "function withdrawFees(string mongoGroupId)",
  "function isMember(string mongoGroupId,address wallet) view returns (bool)",
  "function getCommunity(string mongoGroupId) view returns (uint256 joinFeeWei,uint256 memberCount,address admin,uint256 pendingWithdrawal,uint256 totalFeesCollected)",
  "function getMembership(string mongoGroupId,address wallet) view returns (bool memberStatus,uint256 joinedAt,uint256 paidAmountWei)",
  "event CommunityCreated(string indexed mongoGroupId,address indexed admin,uint256 joinFeeWei,uint256 timestamp)",
  "event MemberJoined(string indexed mongoGroupId,address indexed wallet,uint256 paidAmountWei,uint256 timestamp)",
  "event FeesWithdrawn(string indexed mongoGroupId,address indexed admin,uint256 amount,uint256 timestamp)",
];

const getEthereumProvider = () => {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask is required");
  }

  return new ethers.BrowserProvider(window.ethereum);
};

const assertSepolia = async (provider) => {
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== BLOCKCHAIN_CONFIG.chainId) {
    throw new Error("Switch wallet network to Sepolia");
  }
};

const getCommunityContract = async () => {
  const provider = getEthereumProvider();
  await assertSepolia(provider);

  const signer = await provider.getSigner();
  return new ethers.Contract(
    BLOCKCHAIN_CONFIG.communityAddress,
    communityAbi,
    signer,
  );
};

const getReadOnlyCommunityContract = () => {
  const provider = new ethers.JsonRpcProvider(BLOCKCHAIN_CONFIG.rpcUrl);
  return new ethers.Contract(
    BLOCKCHAIN_CONFIG.communityAddress,
    communityAbi,
    provider,
  );
};

const getReadProviders = () => {
  const candidates = Array.from(
    new Set([
      BLOCKCHAIN_CONFIG.rpcUrl,
      "https://ethereum-sepolia-rpc.publicnode.com",
      "https://sepolia.drpc.org",
      "https://rpc.sepolia.org",
    ]),
  ).filter(Boolean);

  const providers = candidates.map(
    (rpcUrl) => new ethers.JsonRpcProvider(rpcUrl, BLOCKCHAIN_CONFIG.chainId),
  );

  if (typeof window !== "undefined" && window.ethereum) {
    providers.push(new ethers.BrowserProvider(window.ethereum));
  }

  return providers;
};

const withReadFallback = async (reader) => {
  const providers = getReadProviders();
  let lastError = null;

  for (const provider of providers) {
    try {
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== BLOCKCHAIN_CONFIG.chainId) {
        continue;
      }

      const contract = new ethers.Contract(
        BLOCKCHAIN_CONFIG.communityAddress,
        communityAbi,
        provider,
      );

      return await reader(contract, provider);
    } catch (error) {
      lastError = error;
    }
  }

  throw (
    lastError || new Error("Unable to read on-chain community state right now")
  );
};

export const createCommunityOnChain = async ({ groupId, joinFeeEth }) => {
  const contract = await getCommunityContract();
  const joinFeeWei = ethers.parseEther(String(joinFeeEth || 0));

  const tx = await contract.createCommunity(groupId, joinFeeWei);
  const receipt = await tx.wait();

  return {
    txHash: tx.hash,
    blockNumber: Number(receipt?.blockNumber || 0),
  };
};

export const joinCommunityOnChain = async ({ groupId, joinFeeEth }) => {
  const contract = await getCommunityContract();
  const value = ethers.parseEther(String(joinFeeEth || 0));

  const tx = await contract.joinCommunity(groupId, { value });
  const receipt = await tx.wait();

  return {
    txHash: tx.hash,
    blockNumber: Number(receipt?.blockNumber || 0),
  };
};

export const checkCommunityMembershipOnChain = async ({
  groupId,
  walletAddress,
}) => {
  const provider = getEthereumProvider();
  await assertSepolia(provider);

  const contract = new ethers.Contract(
    BLOCKCHAIN_CONFIG.communityAddress,
    communityAbi,
    provider,
  );

  return contract.isMember(groupId, walletAddress);
};

export const getCommunitySnapshotOnChain = async ({ groupId }) => {
  const [
    joinFeeWei,
    memberCount,
    admin,
    pendingWithdrawal,
    totalFeesCollected,
  ] = await withReadFallback((contract) => contract.getCommunity(groupId));

  return {
    joinFeeWei,
    memberCount: Number(memberCount || 0),
    admin,
    pendingWithdrawal,
    totalFeesCollected,
  };
};

export const getCommunityMembershipOnChain = async ({
  groupId,
  walletAddress,
}) => {
  const [memberStatus, joinedAt, paidAmountWei] = await withReadFallback(
    (contract) => contract.getMembership(groupId, walletAddress),
  );

  return {
    memberStatus: Boolean(memberStatus),
    joinedAt: Number(joinedAt || 0),
    paidAmountWei,
  };
};

export const withdrawFeesOnChain = async ({ groupId }) => {
  const contract = await getCommunityContract();
  const tx = await contract.withdrawFees(groupId);
  const receipt = await tx.wait();

  return {
    txHash: tx.hash,
    blockNumber: Number(receipt?.blockNumber || 0),
  };
};

export const findCommunityCreateTxHashOnChain = async ({
  groupId,
  adminAddress,
}) => {
  if (!groupId) return "";

  const normalizedAdmin =
    adminAddress && ethers.isAddress(adminAddress)
      ? ethers.getAddress(adminAddress)
      : null;

  return withReadFallback(async (contract, provider) => {
    const latestBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latestBlock - 1_500_000);

    let events = [];

    if (normalizedAdmin) {
      const strictFilter = contract.filters.CommunityCreated(
        groupId,
        normalizedAdmin,
      );
      events = await contract.queryFilter(strictFilter, fromBlock, "latest");
    }

    if (!events.length) {
      const relaxedFilter = contract.filters.CommunityCreated(groupId, null);
      events = await contract.queryFilter(relaxedFilter, fromBlock, "latest");
    }

    if (!events.length) {
      return "";
    }

    const event = events[0];
    return event?.transactionHash || event?.log?.transactionHash || "";
  });
};
