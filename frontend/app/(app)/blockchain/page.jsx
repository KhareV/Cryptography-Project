"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  RefreshCcw,
  Shield,
  Wallet,
} from "lucide-react";
import { ethers } from "ethers";
import { format, formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";
import Sidebar from "@/components/chat/Sidebar";
import WalletConnectButton from "@/components/blockchain/WalletConnectButton";
import IntegrityVerifyModal from "@/components/blockchain/IntegrityVerifyModal";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { useStore } from "@/store/useStore";
import { useWallet } from "@/context/WalletContext";
import { useConversations } from "@/hooks/useConversations";
import { useGroups } from "@/hooks/useGroups";
import {
  BLOCKCHAIN_CONFIG,
  getAddressExplorerUrl,
  getTxExplorerUrl,
} from "@/lib/blockchainConfig";
import {
  buildUserKeyMaterial,
  registerKeyOnChain,
  revokeKeyOnChain,
} from "@/lib/keyRegistry";
import {
  getCommunityMembershipOnChain,
  getCommunitySnapshotOnChain,
  withdrawFeesOnChain,
} from "@/lib/communityContract";
import { anchorAPI, keyAPI, setAuthToken } from "@/lib/api";

const KEY_REGISTRY_ABI = [
  "event KeyRegistered(string indexed userId,string fingerprint,address indexed wallet,uint256 timestamp)",
  "event KeyRevoked(string indexed userId,address indexed wallet,uint256 timestamp)",
];

const COMMUNITY_ABI = [
  "event MemberJoined(string indexed mongoGroupId,address indexed wallet,uint256 paidAmountWei,uint256 timestamp)",
  "event CommunityCreated(string indexed mongoGroupId,address indexed admin,uint256 joinFeeWei,uint256 timestamp)",
  "event FeesWithdrawn(string indexed mongoGroupId,address indexed admin,uint256 amount,uint256 timestamp)",
];

const ANCHOR_ABI = [
  "event Anchored(string indexed conversationId,string merkleRoot,uint256 messageCount,address anchoredBy,uint256 timestamp)",
];

const formatDateTime = (value) => {
  if (!value) return "-";
  return format(new Date(value), "MMM d, yyyy 'at' HH:mm");
};

const truncate = (value, start = 8, end = 6) => {
  if (!value) return "";
  if (value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
};

const formatEthValue = (value, decimals = 4) => {
  try {
    const asEth = ethers.formatEther(value || 0n);
    return Number(asEth).toFixed(decimals);
  } catch {
    return "0.0000";
  }
};

const formatGwei = (value) => {
  try {
    return Number(ethers.formatUnits(value || 0n, "gwei")).toFixed(2);
  } catch {
    return "0.00";
  }
};

const getBlockchainWriteErrorMessage = (error) => {
  const raw = String(
    error?.reason || error?.shortMessage || error?.message || "",
  ).toLowerCase();

  if (
    raw.includes("user rejected") ||
    raw.includes("action rejected") ||
    error?.code === 4001
  ) {
    return "Transaction was rejected in MetaMask.";
  }

  if (raw.includes("switch wallet network") || raw.includes("wrong network")) {
    return "Switch MetaMask to Sepolia and try again.";
  }

  if (raw.includes("insufficient funds")) {
    return "Insufficient wallet balance for gas.";
  }

  if (raw.includes("missing") || raw.includes("required")) {
    return error?.message || "Required blockchain configuration is missing.";
  }

  return "Transaction failed on-chain. Please retry.";
};

export default function BlockchainDashboardPage() {
  const { getToken } = useAuth();
  const { user: appUser, setMobileView, isMobileView } = useStore();
  const { conversations } = useConversations();
  const { groups } = useGroups();
  const {
    address,
    balance,
    chainId,
    isConnected,
    isCorrectNetwork,
    disconnect,
  } = useWallet();

  const [walletBalanceLive, setWalletBalanceLive] = useState(balance || "0");
  const [walletRefreshing, setWalletRefreshing] = useState(false);
  const [networkInfo, setNetworkInfo] = useState({
    blockNumber: 0,
    gasPriceGwei: "0.00",
    chainId: 0,
    networkName: "Sepolia Testnet",
  });
  const [isNetworkLoading, setIsNetworkLoading] = useState(false);

  const [keyStatus, setKeyStatus] = useState({ loading: true, status: null });
  const [isRegisteringKey, setIsRegisteringKey] = useState(false);
  const [isRevokingKey, setIsRevokingKey] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [lastKeyTxHash, setLastKeyTxHash] = useState("");

  const [groupTab, setGroupTab] = useState("admin");
  const [integrityTab, setIntegrityTab] = useState("conversation");
  const [groupChainData, setGroupChainData] = useState({});
  const [isGroupChainLoading, setIsGroupChainLoading] = useState(false);
  const [withdrawTarget, setWithdrawTarget] = useState(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const [transactions, setTransactions] = useState([]);
  const [isTxLoading, setIsTxLoading] = useState(false);
  const [txVisibleCount, setTxVisibleCount] = useState(10);

  const [anchorStatus, setAnchorStatus] = useState({
    conversations: {},
    groups: {},
  });
  const [anchoringNow, setAnchoringNow] = useState({});
  const [verifyModal, setVerifyModal] = useState({
    isOpen: false,
    type: "conversation",
    id: "",
    title: "",
  });

  const [abiModal, setAbiModal] = useState({
    isOpen: false,
    title: "",
    abi: [],
  });

  const networkConnected = isConnected && isCorrectNetwork;

  const adminGroups = useMemo(
    () => groups.filter((group) => Boolean(group.isAdmin)),
    [groups],
  );

  const groupsIn = useMemo(() => groups, [groups]);

  const withAuth = useCallback(
    async (fn) => {
      const token = await getToken();
      setAuthToken(token);
      return fn();
    },
    [getToken],
  );

  const refreshLiveBalance = useCallback(async () => {
    if (!address || typeof window === "undefined" || !window.ethereum) {
      setWalletBalanceLive(balance || "0");
      return;
    }

    setWalletRefreshing(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const value = await provider.getBalance(address);
      setWalletBalanceLive(Number(ethers.formatEther(value)).toFixed(4));
    } catch {
      toast.error("Failed to refresh wallet balance");
    } finally {
      setWalletRefreshing(false);
    }
  }, [address, balance]);

  const loadNetworkInfo = useCallback(async () => {
    setIsNetworkLoading(true);
    try {
      const provider = new ethers.JsonRpcProvider(BLOCKCHAIN_CONFIG.rpcUrl);
      const [blockNumber, feeData, network] = await Promise.all([
        provider.getBlockNumber(),
        provider.getFeeData(),
        provider.getNetwork(),
      ]);

      setNetworkInfo({
        blockNumber,
        gasPriceGwei: formatGwei(feeData.gasPrice),
        chainId: Number(network.chainId || BLOCKCHAIN_CONFIG.chainId),
        networkName: "Sepolia Testnet",
      });
    } catch {
      setNetworkInfo((prev) => ({ ...prev, blockNumber: 0 }));
    } finally {
      setIsNetworkLoading(false);
    }
  }, []);

  const loadKeyStatus = useCallback(async () => {
    if (!appUser?.id) {
      setKeyStatus({ loading: false, status: null });
      return;
    }

    try {
      setKeyStatus((prev) => ({ ...prev, loading: true }));
      const response = await withAuth(() => keyAPI.getMyStatus());
      setKeyStatus({ loading: false, status: response.data?.status || null });
    } catch {
      setKeyStatus({ loading: false, status: null });
    }
  }, [appUser?.id, withAuth]);

  const handleRegisterKey = useCallback(async () => {
    if (!appUser?.id) {
      toast.error("User profile is not ready.");
      return;
    }

    if (!isConnected || !address) {
      toast.error("Connect your wallet first.");
      return;
    }

    if (!isCorrectNetwork) {
      toast.error("Switch MetaMask to Sepolia and try again.");
      return;
    }

    try {
      setIsRegisteringKey(true);

      const password = window.prompt("Create an encryption password");
      if (!password) {
        toast.error("Encryption password is required.");
        return;
      }

      const confirm = window.prompt("Confirm encryption password");
      if (!confirm) {
        toast.error("Please confirm your encryption password.");
        return;
      }

      if (password !== confirm) {
        toast.error("Encryption passwords do not match.");
        return;
      }

      const keyMaterial = await buildUserKeyMaterial({ password });
      const onChain = await registerKeyOnChain({
        userId: appUser.id,
        publicKey: keyMaterial.publicKey,
        fingerprint: keyMaterial.fingerprint,
      });

      await withAuth(() =>
        keyAPI.register({
          publicKey: keyMaterial.publicKey,
          fingerprint: keyMaterial.fingerprint,
          walletAddress: address,
          txHash: onChain.txHash,
          encryptedPrivateKey: keyMaterial.encryptedPrivateKey,
          keyEncryptionSalt: keyMaterial.keyEncryptionSalt,
          keyEncryptionIv: keyMaterial.keyEncryptionIv,
          keyEncryptionIterations: keyMaterial.keyEncryptionIterations,
          keyEncryptionAlgorithm: keyMaterial.keyEncryptionAlgorithm,
          keyEncryptionKdf: keyMaterial.keyEncryptionKdf,
        }),
      );

      setLastKeyTxHash(onChain.txHash);
      toast.success("Key fingerprint registered on Sepolia");
      await Promise.all([loadKeyStatus(), loadTransactions()]);
    } catch (error) {
      toast.error(getBlockchainWriteErrorMessage(error));
    } finally {
      setIsRegisteringKey(false);
    }
  }, [
    appUser?.id,
    isConnected,
    address,
    isCorrectNetwork,
    withAuth,
    loadKeyStatus,
  ]);

  const handleRevokeKey = useCallback(async () => {
    if (!appUser?.id) return;

    if (!isConnected || !address) {
      toast.error("Connect your wallet first.");
      return;
    }

    if (!isCorrectNetwork) {
      toast.error("Switch MetaMask to Sepolia and try again.");
      return;
    }

    try {
      setIsRevokingKey(true);
      const result = await revokeKeyOnChain(appUser.id);
      setLastKeyTxHash(result.txHash);
      toast.success("Key revoked on-chain.");
      setShowRevokeDialog(false);
      await Promise.all([loadKeyStatus(), loadTransactions()]);
    } catch (error) {
      toast.error(getBlockchainWriteErrorMessage(error));
    } finally {
      setIsRevokingKey(false);
    }
  }, [appUser?.id, isConnected, address, isCorrectNetwork, loadKeyStatus]);

  const loadGroupChainData = useCallback(async () => {
    if (!groups.length) {
      setGroupChainData({});
      return;
    }

    setIsGroupChainLoading(true);
    try {
      const entries = await Promise.all(
        groups.map(async (group) => {
          if (!group.onChainRegistered) {
            return [
              group.id,
              {
                joinFeeEth: Number(group.joinFeeEth || 0),
                totalFeesEth: "0.0000",
                pendingWithdrawalEth: "0.0000",
                adminAddress: "",
                memberStatus: false,
                joinedAt: 0,
                paidEth:
                  Number(group.joinFeeEth || 0) > 0
                    ? Number(group.joinFeeEth).toFixed(4)
                    : "0",
              },
            ];
          }

          const snapshot = await getCommunitySnapshotOnChain({
            groupId: group.id,
          });
          let membership = null;
          if (address && ethers.isAddress(address)) {
            membership = await getCommunityMembershipOnChain({
              groupId: group.id,
              walletAddress: address,
            });
          }

          return [
            group.id,
            {
              joinFeeEth: Number(ethers.formatEther(snapshot.joinFeeWei || 0n)),
              totalFeesEth: formatEthValue(snapshot.totalFeesCollected),
              pendingWithdrawalEth: formatEthValue(snapshot.pendingWithdrawal),
              pendingWithdrawalWei: snapshot.pendingWithdrawal,
              adminAddress: snapshot.admin,
              memberStatus: Boolean(membership?.memberStatus),
              joinedAt: Number(membership?.joinedAt || 0),
              paidEth: membership?.paidAmountWei
                ? Number(ethers.formatEther(membership.paidAmountWei)).toFixed(
                    4,
                  )
                : Number(group.joinFeeEth || 0) > 0
                  ? Number(group.joinFeeEth).toFixed(4)
                  : "0",
            },
          ];
        }),
      );

      setGroupChainData(Object.fromEntries(entries));
    } catch {
      setGroupChainData({});
    } finally {
      setIsGroupChainLoading(false);
    }
  }, [groups, address]);

  const loadAnchorStatus = useCallback(async () => {
    if (!conversations.length && !groups.length) {
      setAnchorStatus({ conversations: {}, groups: {} });
      return;
    }

    try {
      const [conversationEntries, groupEntries] = await Promise.all([
        Promise.all(
          conversations.map(async (conversation) => {
            try {
              const response = await withAuth(() =>
                anchorAPI.getConversationAnchor(conversation.id),
              );
              return [conversation.id, response.data?.lastAnchor || null];
            } catch {
              return [conversation.id, null];
            }
          }),
        ),
        Promise.all(
          groups.map(async (group) => {
            try {
              const response = await withAuth(() =>
                anchorAPI.getGroupAnchor(group.id),
              );
              return [group.id, response.data?.lastAnchor || null];
            } catch {
              return [group.id, null];
            }
          }),
        ),
      ]);

      setAnchorStatus({
        conversations: Object.fromEntries(conversationEntries),
        groups: Object.fromEntries(groupEntries),
      });
    } catch {
      setAnchorStatus({ conversations: {}, groups: {} });
    }
  }, [conversations, groups, withAuth]);

  const handleAnchorNow = useCallback(
    async (type, id) => {
      const key = `${type}:${id}`;
      setAnchoringNow((prev) => ({ ...prev, [key]: true }));

      try {
        const response = await withAuth(() =>
          type === "conversation"
            ? anchorAPI.anchorConversationNow(id)
            : anchorAPI.anchorGroupNow(id),
        );

        const nextAnchor = response.data?.anchor || null;

        setAnchorStatus((prev) => {
          if (type === "conversation") {
            return {
              ...prev,
              conversations: {
                ...prev.conversations,
                [id]: nextAnchor,
              },
            };
          }

          return {
            ...prev,
            groups: {
              ...prev.groups,
              [id]: nextAnchor,
            },
          };
        });

        toast.success("Anchor transaction submitted and confirmed");
        await loadTransactions();
      } catch (error) {
        toast.error(error.message || "Failed to anchor now");
      } finally {
        setAnchoringNow((prev) => ({ ...prev, [key]: false }));
      }
    },
    [withAuth],
  );

  const handleWithdraw = useCallback(async () => {
    if (!withdrawTarget?.id) return;

    if (!isConnected || !address) {
      toast.error("Connect your wallet first.");
      return;
    }

    if (!isCorrectNetwork) {
      toast.error("Switch MetaMask to Sepolia and try again.");
      return;
    }

    try {
      setIsWithdrawing(true);
      const result = await withdrawFeesOnChain({ groupId: withdrawTarget.id });
      toast.success("Fees withdrawn to your wallet.");
      setWithdrawTarget(null);
      await Promise.all([loadGroupChainData(), loadTransactions()]);
      return result;
    } catch (error) {
      toast.error(getBlockchainWriteErrorMessage(error));
      return null;
    } finally {
      setIsWithdrawing(false);
    }
  }, [
    withdrawTarget?.id,
    isConnected,
    address,
    isCorrectNetwork,
    loadGroupChainData,
  ]);

  const loadTransactions = useCallback(async () => {
    if (!address || !ethers.isAddress(address)) {
      setTransactions([]);
      return;
    }

    setIsTxLoading(true);
    try {
      const provider = new ethers.JsonRpcProvider(BLOCKCHAIN_CONFIG.rpcUrl);
      const keyContract = new ethers.Contract(
        BLOCKCHAIN_CONFIG.keyRegistryAddress,
        KEY_REGISTRY_ABI,
        provider,
      );
      const communityContract = new ethers.Contract(
        BLOCKCHAIN_CONFIG.communityAddress,
        COMMUNITY_ABI,
        provider,
      );
      const anchorContract = new ethers.Contract(
        BLOCKCHAIN_CONFIG.anchorAddress,
        ANCHOR_ABI,
        provider,
      );

      const latestBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, latestBlock - 1_500_000);
      const normalizedAddress = address.toLowerCase();

      const [
        keyRegisteredEvents,
        keyRevokedEvents,
        joinedEvents,
        createdEvents,
        withdrawnEvents,
        anchoredEvents,
      ] = await Promise.all([
        keyContract.queryFilter(
          keyContract.filters.KeyRegistered(null, address),
          fromBlock,
          "latest",
        ),
        keyContract.queryFilter(
          keyContract.filters.KeyRevoked(null, address),
          fromBlock,
          "latest",
        ),
        communityContract.queryFilter(
          communityContract.filters.MemberJoined(null, address),
          fromBlock,
          "latest",
        ),
        communityContract.queryFilter(
          communityContract.filters.CommunityCreated(null, address),
          fromBlock,
          "latest",
        ),
        communityContract.queryFilter(
          communityContract.filters.FeesWithdrawn(null, address),
          fromBlock,
          "latest",
        ),
        anchorContract.queryFilter(
          anchorContract.filters.Anchored(),
          fromBlock,
          "latest",
        ),
      ]);

      const merged = [
        ...keyRegisteredEvents.map((event) => ({
          type: "Key Registration",
          subject: event.args?.userId || appUser?.username || "Me",
          amount: "-",
          txHash: event.transactionHash,
          date: Number(event.args?.timestamp || 0) * 1000,
          status: "Confirmed",
        })),
        ...keyRevokedEvents.map((event) => ({
          type: "Key Revoke",
          subject: event.args?.userId || appUser?.username || "Me",
          amount: "-",
          txHash: event.transactionHash,
          date: Number(event.args?.timestamp || 0) * 1000,
          status: "Confirmed",
        })),
        ...joinedEvents.map((event) => ({
          type: "Join Group",
          subject: event.args?.mongoGroupId || "Group",
          amount: `${formatEthValue(event.args?.paidAmountWei, 4)} ETH`,
          txHash: event.transactionHash,
          date: Number(event.args?.timestamp || 0) * 1000,
          status: "Confirmed",
        })),
        ...createdEvents.map((event) => ({
          type: "Create Group",
          subject: event.args?.mongoGroupId || "Group",
          amount: `${formatEthValue(event.args?.joinFeeWei, 4)} ETH`,
          txHash: event.transactionHash,
          date: Number(event.args?.timestamp || 0) * 1000,
          status: "Confirmed",
        })),
        ...withdrawnEvents.map((event) => ({
          type: "Withdraw Fees",
          subject: event.args?.mongoGroupId || "Group",
          amount: `${formatEthValue(event.args?.amount, 4)} ETH`,
          txHash: event.transactionHash,
          date: Number(event.args?.timestamp || 0) * 1000,
          status: "Confirmed",
        })),
        ...anchoredEvents
          .filter(
            (event) =>
              String(event.args?.anchoredBy || "").toLowerCase() ===
              normalizedAddress,
          )
          .map((event) => ({
            type: "Message Anchor",
            subject: event.args?.conversationId || "Thread",
            amount: "-",
            txHash: event.transactionHash,
            date: Number(event.args?.timestamp || 0) * 1000,
            status: "Confirmed",
          })),
      ].sort((a, b) => b.date - a.date);

      setTransactions(merged);
    } catch {
      setTransactions([]);
    } finally {
      setIsTxLoading(false);
    }
  }, [address, appUser?.username]);

  useEffect(() => {
    const handleResize = () => {
      setMobileView(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setMobileView]);

  useEffect(() => {
    setWalletBalanceLive(balance || "0");
  }, [balance]);

  useEffect(() => {
    loadNetworkInfo();
    const interval = setInterval(loadNetworkInfo, 30_000);
    return () => clearInterval(interval);
  }, [loadNetworkInfo]);

  useEffect(() => {
    loadKeyStatus();
  }, [loadKeyStatus]);

  useEffect(() => {
    loadGroupChainData();
  }, [loadGroupChainData]);

  useEffect(() => {
    loadAnchorStatus();
  }, [loadAnchorStatus]);

  useEffect(() => {
    loadTransactions();
    setTxVisibleCount(10);
  }, [loadTransactions]);

  const keyRegistered = Boolean(
    keyStatus.status?.onChain?.registered &&
    !keyStatus.status?.onChain?.revoked,
  );

  const contractCards = [
    {
      name: "Key Registry",
      address: BLOCKCHAIN_CONFIG.keyRegistryAddress,
      abi: KEY_REGISTRY_ABI,
    },
    {
      name: "Community",
      address: BLOCKCHAIN_CONFIG.communityAddress,
      abi: COMMUNITY_ABI,
    },
    {
      name: "Anchor",
      address: BLOCKCHAIN_CONFIG.anchorAddress,
      abi: ANCHOR_ABI,
    },
  ];

  const selectedIntegrityItems =
    integrityTab === "conversation" ? conversations : groupsIn;

  return (
    <div className="h-screen flex overflow-hidden">
      {!isMobileView && <Sidebar />}

      <main className="flex-1 overflow-y-auto bg-background chat-surface p-4 md:p-6">
        <div className="mx-auto max-w-7xl space-y-5">
          <header className="rounded-3xl border border-border/70 bg-background/95 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Blockchain Dashboard
                </h1>
                <p className="text-sm text-foreground-secondary">
                  Decentralized features powered by Ethereum Sepolia
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                  networkConnected
                    ? "bg-emerald-500/15 text-emerald-500"
                    : "bg-red-500/15 text-red-500"
                }`}
              >
                {networkConnected ? "Sepolia Connected" : "Not Connected"}
              </span>
            </div>
          </header>

          <section className="rounded-3xl border border-border/70 bg-background/95 p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Wallet Overview
            </h2>

            {!isConnected ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-background-secondary/40 px-5 py-10 text-center">
                <div className="mb-3 rounded-full bg-background p-3">
                  <Wallet className="h-6 w-6 text-foreground-secondary" />
                </div>
                <p className="mb-3 text-sm text-foreground-secondary">
                  Connect your wallet to use blockchain features.
                </p>
                <WalletConnectButton />
              </div>
            ) : (
              <div className="space-y-3 rounded-2xl border border-border/70 bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={address} size="md" />
                    <p className="truncate font-mono text-sm text-foreground">
                      {address}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(address)}
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-foreground-secondary">Balance</p>
                  <div className="inline-flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {walletBalanceLive} ETH
                    </p>
                    <button
                      type="button"
                      className="rounded-lg p-1 text-foreground-secondary hover:bg-background-secondary"
                      onClick={refreshLiveBalance}
                    >
                      <RefreshCcw
                        className={`h-4 w-4 ${walletRefreshing ? "animate-spin" : ""}`}
                      />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-foreground-secondary">Network</p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      isCorrectNetwork
                        ? "bg-emerald-500/15 text-emerald-500"
                        : "bg-red-500/15 text-red-500"
                    }`}
                  >
                    {isCorrectNetwork ? "Sepolia Testnet" : "Wrong Network"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <a
                    href="https://sepoliafaucet.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-accent hover:underline"
                  >
                    Get Sepolia ETH
                  </a>
                  <Button variant="secondary" size="sm" onClick={disconnect}>
                    Disconnect
                  </Button>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-border/70 bg-background/95 p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              My Encryption Key
            </h2>

            {keyStatus.loading ? (
              <div className="flex items-center gap-2 text-sm text-foreground-secondary">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading key
                status...
              </div>
            ) : keyRegistered ? (
              <div className="space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <p className="text-sm font-semibold text-emerald-500">
                  Registered on Sepolia
                </p>
                <div className="space-y-2 text-sm">
                  <p className="text-foreground-secondary">
                    Fingerprint:
                    <span className="ml-2 font-mono text-xs text-foreground break-all">
                      {keyStatus.status?.onChain?.fingerprint || "-"}
                    </span>
                  </p>
                  <p className="text-foreground-secondary">
                    Registered by:
                    <span className="ml-2 font-mono text-xs text-foreground">
                      {keyStatus.status?.onChain?.registeredBy || "-"}
                    </span>
                  </p>
                  <p className="text-foreground-secondary">
                    Registered:
                    <span className="ml-2 text-foreground">
                      {keyStatus.status?.onChain?.registeredAt
                        ? formatDateTime(
                            keyStatus.status.onChain.registeredAt * 1000,
                          )
                        : "-"}
                    </span>
                  </p>
                  {(lastKeyTxHash || appUser?.blockchainTxHash) && (
                    <a
                      href={getTxExplorerUrl(
                        lastKeyTxHash || appUser?.blockchainTxHash,
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-accent"
                    >
                      View on Etherscan <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    isLoading={isRegisteringKey}
                    onClick={handleRegisterKey}
                  >
                    Re-register Key
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-500/50 text-red-500"
                    onClick={() => setShowRevokeDialog(true)}
                  >
                    Revoke Key
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 rounded-2xl border border-border/70 bg-background-secondary/40 p-4">
                <p className="text-sm font-semibold text-foreground-secondary">
                  Not registered on-chain
                </p>
                <p className="text-sm text-foreground-secondary">
                  Register your key fingerprint on Sepolia to enable
                  cryptographic verification of your identity.
                </p>
                {isConnected ? (
                  <Button
                    variant="primary"
                    isLoading={isRegisteringKey}
                    onClick={handleRegisterKey}
                  >
                    Register Key
                  </Button>
                ) : (
                  <WalletConnectButton />
                )}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-border/70 bg-background/95 p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              My Groups (on-chain)
            </h2>
            <div className="mb-4 inline-flex rounded-2xl border border-border/70 bg-background-secondary/40 p-1">
              <button
                type="button"
                className={`rounded-xl px-3 py-1.5 text-sm ${
                  groupTab === "admin"
                    ? "bg-background text-foreground"
                    : "text-foreground-secondary"
                }`}
                onClick={() => setGroupTab("admin")}
              >
                Groups I Admin
              </button>
              <button
                type="button"
                className={`rounded-xl px-3 py-1.5 text-sm ${
                  groupTab === "member"
                    ? "bg-background text-foreground"
                    : "text-foreground-secondary"
                }`}
                onClick={() => setGroupTab("member")}
              >
                Groups I&apos;m In
              </button>
            </div>

            {isGroupChainLoading ? (
              <div className="flex items-center gap-2 text-sm text-foreground-secondary">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading on-chain
                group state...
              </div>
            ) : (
              <div className="space-y-3">
                {(groupTab === "admin" ? adminGroups : groupsIn).map(
                  (group) => {
                    const chain = groupChainData[group.id] || {};
                    const canWithdraw =
                      Number(chain.pendingWithdrawalEth || "0") > 0;

                    return (
                      <div
                        key={group.id}
                        className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background p-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar
                            src={group.avatar}
                            name={group.name}
                            size="md"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground">
                              {group.name}
                            </p>
                            <p className="text-xs text-foreground-secondary">
                              {group.memberCount || group.members?.length || 0}{" "}
                              members
                            </p>
                          </div>
                        </div>

                        {groupTab === "admin" ? (
                          <div className="flex-1 text-sm text-foreground-secondary md:px-4">
                            <p>
                              Join fee:{" "}
                              {Number(
                                chain.joinFeeEth || group.joinFeeEth || 0,
                              ).toFixed(4)}{" "}
                              ETH per member
                            </p>
                            <p>
                              Fees collected: Total:{" "}
                              {chain.totalFeesEth || "0.0000"} ETH
                            </p>
                            <p>
                              Pending withdrawal:{" "}
                              {chain.pendingWithdrawalEth || "0.0000"} ETH
                              available
                            </p>
                          </div>
                        ) : (
                          <div className="flex-1 text-sm text-foreground-secondary md:px-4">
                            <p>
                              Joined:{" "}
                              {chain.joinedAt
                                ? formatDateTime(chain.joinedAt * 1000)
                                : "Unknown"}
                            </p>
                            <p>
                              Paid:{" "}
                              {Number(chain.paidEth || 0) > 0
                                ? `${Number(chain.paidEth).toFixed(4)} ETH`
                                : "Free"}
                            </p>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                          {groupTab === "admin" ? (
                            <Button
                              variant={canWithdraw ? "primary" : "secondary"}
                              size="sm"
                              disabled={!canWithdraw}
                              onClick={() =>
                                setWithdrawTarget({
                                  id: group.id,
                                  name: group.name,
                                  amount:
                                    chain.pendingWithdrawalEth || "0.0000",
                                })
                              }
                            >
                              Withdraw
                            </Button>
                          ) : (
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                chain.memberStatus
                                  ? "bg-emerald-500/15 text-emerald-500"
                                  : "bg-background-secondary text-foreground-secondary"
                              }`}
                            >
                              {chain.memberStatus
                                ? "Member verified"
                                : "Joined off-chain"}
                            </span>
                          )}

                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              group.onChainRegistered
                                ? "bg-emerald-500/15 text-emerald-500"
                                : "bg-background-secondary text-foreground-secondary"
                            }`}
                          >
                            {group.onChainRegistered
                              ? "Registered"
                              : "Not on-chain"}
                          </span>
                        </div>
                      </div>
                    );
                  },
                )}

                {(groupTab === "admin" ? adminGroups : groupsIn).length ===
                  0 && (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-background-secondary/30 p-6 text-center text-sm text-foreground-secondary">
                    No groups to display.
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-border/70 bg-background/95 p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Transaction History
            </h2>

            {isTxLoading ? (
              <div className="flex items-center gap-2 text-sm text-foreground-secondary">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading wallet
                events...
              </div>
            ) : transactions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-background-secondary/30 p-8 text-center">
                <Link2 className="mx-auto mb-3 h-6 w-6 text-foreground-secondary" />
                <p className="text-sm text-foreground-secondary">
                  No blockchain transactions yet
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border/70 text-xs uppercase tracking-wide text-foreground-secondary">
                      <th className="pb-3 pr-3">Type</th>
                      <th className="pb-3 pr-3">Group/User</th>
                      <th className="pb-3 pr-3">Amount</th>
                      <th className="pb-3 pr-3">Tx Hash</th>
                      <th className="pb-3 pr-3">Date</th>
                      <th className="pb-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.slice(0, txVisibleCount).map((tx) => (
                      <tr
                        key={`${tx.txHash}-${tx.type}`}
                        className="border-b border-border/40"
                      >
                        <td className="py-3 pr-3 text-foreground">{tx.type}</td>
                        <td className="py-3 pr-3 text-foreground-secondary">
                          {tx.subject}
                        </td>
                        <td className="py-3 pr-3 text-foreground-secondary">
                          {tx.amount}
                        </td>
                        <td className="py-3 pr-3">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              className="font-mono text-xs text-accent"
                              onClick={() =>
                                navigator.clipboard.writeText(tx.txHash)
                              }
                            >
                              {truncate(tx.txHash)}
                            </button>
                            <a
                              href={getTxExplorerUrl(tx.txHash)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-accent"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-foreground-secondary">
                          {tx.date ? formatDateTime(tx.date) : "-"}
                        </td>
                        <td className="py-3">
                          <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-500">
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {txVisibleCount < transactions.length && (
                  <div className="pt-4">
                    <Button
                      variant="secondary"
                      onClick={() => setTxVisibleCount((prev) => prev + 10)}
                    >
                      Load more
                    </Button>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-border/70 bg-background/95 p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Message Integrity
            </h2>
            <div className="mb-4 inline-flex rounded-2xl border border-border/70 bg-background-secondary/40 p-1">
              <button
                type="button"
                className={`rounded-xl px-3 py-1.5 text-sm ${
                  integrityTab === "conversation"
                    ? "bg-background text-foreground"
                    : "text-foreground-secondary"
                }`}
                onClick={() => setIntegrityTab("conversation")}
              >
                Direct Chats
              </button>
              <button
                type="button"
                className={`rounded-xl px-3 py-1.5 text-sm ${
                  integrityTab === "group"
                    ? "bg-background text-foreground"
                    : "text-foreground-secondary"
                }`}
                onClick={() => setIntegrityTab("group")}
              >
                Groups
              </button>
            </div>

            <div className="space-y-3">
              {selectedIntegrityItems.map((item) => {
                const isConversation = integrityTab === "conversation";
                const entityId = item.id;
                const anchor = isConversation
                  ? anchorStatus.conversations[entityId]
                  : anchorStatus.groups[entityId];
                const anchoredAt = anchor?.anchoredAt
                  ? new Date(anchor.anchoredAt)
                  : null;
                const stale = anchoredAt
                  ? Date.now() - anchoredAt.getTime() > 7 * 24 * 60 * 60 * 1000
                  : false;

                const displayName = isConversation
                  ? `${item.otherParticipant?.firstName || ""} ${item.otherParticipant?.lastName || ""}`.trim() ||
                    item.otherParticipant?.username ||
                    "Direct chat"
                  : item.name;

                const avatarSrc = isConversation
                  ? item.otherParticipant?.avatar
                  : item.avatar;

                return (
                  <div
                    key={`${integrityTab}-${entityId}`}
                    className="grid grid-cols-1 gap-3 rounded-2xl border border-border/70 bg-background p-4 lg:grid-cols-[1.3fr_1fr_1fr_auto] lg:items-center"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar src={avatarSrc} name={displayName} size="md" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">
                          {displayName}
                        </p>
                        <p className="text-xs text-foreground-secondary">
                          {anchor?.anchoredAt
                            ? `${anchor.messageCount || 0} messages`
                            : "No anchor batch yet"}
                        </p>
                      </div>
                    </div>

                    <div className="text-sm text-foreground-secondary">
                      <p>
                        {anchor?.anchoredAt
                          ? formatDistanceToNow(new Date(anchor.anchoredAt), {
                              addSuffix: true,
                            })
                          : "Never anchored"}
                      </p>
                      <p className="font-mono text-xs">
                        {truncate(anchor?.merkleRoot || "") || "-"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      {anchor?.merkleRoot ? (
                        <span
                          className={`rounded-full px-2.5 py-1 font-semibold ${
                            stale
                              ? "bg-red-500/15 text-red-500"
                              : "bg-emerald-500/15 text-emerald-500"
                          }`}
                        >
                          {stale ? "Stale (>7 days)" : "Anchored"}
                        </span>
                      ) : (
                        <span className="rounded-full bg-background-secondary px-2.5 py-1 font-semibold text-foreground-secondary">
                          Never anchored
                        </span>
                      )}
                      {anchor?.etherscanLink && (
                        <a
                          href={anchor.etherscanLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-accent"
                        >
                          Etherscan <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-2 lg:justify-end">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          setVerifyModal({
                            isOpen: true,
                            type: isConversation ? "conversation" : "group",
                            id: entityId,
                            title: displayName,
                          })
                        }
                      >
                        Verify
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        isLoading={Boolean(
                          anchoringNow[
                            `${isConversation ? "conversation" : "group"}:${entityId}`
                          ],
                        )}
                        onClick={() =>
                          handleAnchorNow(
                            isConversation ? "conversation" : "group",
                            entityId,
                          )
                        }
                      >
                        Anchor Now
                      </Button>
                    </div>
                  </div>
                );
              })}

              {selectedIntegrityItems.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border/70 bg-background-secondary/30 p-6 text-center text-sm text-foreground-secondary">
                  No threads available for integrity monitoring.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-border/70 bg-background/95 p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">
                Network Info
              </h2>
              <Button
                variant="secondary"
                size="sm"
                onClick={loadNetworkInfo}
                isLoading={isNetworkLoading}
              >
                Refresh
              </Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-background p-4 text-sm text-foreground-secondary space-y-2">
                <p>
                  Current block:{" "}
                  <span className="text-foreground">
                    {networkInfo.blockNumber || "-"}
                  </span>
                </p>
                <p>
                  Gas price:{" "}
                  <span className="text-foreground">
                    {networkInfo.gasPriceGwei} gwei
                  </span>
                </p>
                <p>
                  Network:{" "}
                  <span className="text-foreground">
                    {networkInfo.networkName}
                  </span>
                </p>
                <p>
                  Chain ID:{" "}
                  <span className="text-foreground">
                    {networkInfo.chainId || BLOCKCHAIN_CONFIG.chainId}
                  </span>
                </p>
              </div>

              <div className="space-y-3">
                {contractCards.map((contract) => (
                  <div
                    key={contract.name}
                    className="rounded-2xl border border-border/70 bg-background p-4 text-sm"
                  >
                    <p className="font-semibold text-foreground">
                      {contract.name}
                    </p>
                    <p className="mt-1 font-mono text-xs text-foreground-secondary">
                      {truncate(contract.address, 12, 10)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          navigator.clipboard.writeText(contract.address)
                        }
                      >
                        <Copy className="h-4 w-4" />
                        Copy
                      </Button>
                      <a
                        href={getAddressExplorerUrl(contract.address)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-accent"
                      >
                        View on Etherscan{" "}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          setAbiModal({
                            isOpen: true,
                            title: `${contract.name} ABI`,
                            abi: contract.abi,
                          })
                        }
                      >
                        View ABI
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>

      <Modal
        isOpen={showRevokeDialog}
        onClose={() => setShowRevokeDialog(false)}
        title="Revoke Key"
        description="Are you sure? This will permanently mark your encryption key as invalid on-chain."
      >
        <p className="text-sm text-foreground-secondary">
          Anyone checking your key will see it as revoked.
        </p>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => setShowRevokeDialog(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            isLoading={isRevokingKey}
            onClick={handleRevokeKey}
          >
            Revoke
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={Boolean(withdrawTarget)}
        onClose={() => setWithdrawTarget(null)}
        title="Withdraw Fees"
        description={
          withdrawTarget
            ? `Withdraw ${withdrawTarget.amount} ETH to your wallet?`
            : ""
        }
      >
        <ModalFooter>
          <Button variant="secondary" onClick={() => setWithdrawTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isLoading={isWithdrawing}
            onClick={handleWithdraw}
          >
            Withdraw
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={abiModal.isOpen}
        onClose={() => setAbiModal({ isOpen: false, title: "", abi: [] })}
        title={abiModal.title}
        size="xl"
      >
        <pre className="max-h-[60vh] overflow-auto rounded-xl border border-border/70 bg-background p-3 text-xs text-foreground-secondary">
          {JSON.stringify(abiModal.abi, null, 2)}
        </pre>
      </Modal>

      <IntegrityVerifyModal
        isOpen={verifyModal.isOpen}
        onClose={() => setVerifyModal((prev) => ({ ...prev, isOpen: false }))}
        type={verifyModal.type}
        id={verifyModal.id}
        title={verifyModal.title}
      />
    </div>
  );
}
