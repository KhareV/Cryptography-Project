"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import {
  CheckCircle2,
  CircleOff,
  Copy,
  ExternalLink,
  Shield,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";
import WalletConnectButton from "@/components/blockchain/WalletConnectButton";
import BlockchainKeyBadge from "@/components/blockchain/BlockchainKeyBadge";
import { useWallet } from "@/context/WalletContext";
import { Avatar } from "@/components/ui/Avatar";
import { callAPI, keyAPI, setAuthToken } from "@/lib/api";
import { buildUserKeyMaterial, registerKeyOnChain } from "@/lib/keyRegistry";
import { getTxExplorerUrl } from "@/lib/blockchainConfig";
import { useStore } from "@/store/useStore";

function formatAddress(address) {
  if (!address) return "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatCallDuration(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const secs = (safe % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function getStatusBadgeClasses(status) {
  switch (status) {
    case "active":
    case "ended":
      return "bg-emerald-500/15 text-emerald-500";
    case "missed":
      return "bg-amber-500/15 text-amber-500";
    case "rejected":
      return "bg-red-500/15 text-red-500";
    default:
      return "bg-zinc-500/15 text-foreground-secondary";
  }
}

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const { getToken } = useAuth();
  const { user: appUser } = useStore();

  const [callHistory, setCallHistory] = useState([]);
  const [isLoadingCalls, setIsLoadingCalls] = useState(true);
  const [isRegisteringKey, setIsRegisteringKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState({
    loading: true,
    verified: false,
    fingerprint: "",
    txHash: "",
    walletMatches: false,
  });

  const {
    address,
    balance,
    chainId,
    isConnected,
    isCorrectNetwork,
    disconnect,
    switchToSepolia,
  } = useWallet();

  const activeTab = useMemo(() => {
    const tab = searchParams.get("tab");
    return tab === "preferences" ? "preferences" : "profile";
  }, [searchParams]);

  const setTab = (tab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`/settings?${params.toString()}`);
  };

  const handleCopy = async () => {
    if (!address) return;

    try {
      await navigator.clipboard.writeText(address);
      toast.success("Wallet address copied.");
    } catch {
      toast.error("Could not copy wallet address.");
    }
  };

  useEffect(() => {
    const fetchCallHistory = async () => {
      try {
        setIsLoadingCalls(true);
        const token = await getToken();
        setAuthToken(token);

        const response = await callAPI.getHistory();
        setCallHistory(response.data?.calls || []);
      } catch {
        toast.error("Failed to load call history.");
      } finally {
        setIsLoadingCalls(false);
      }
    };

    fetchCallHistory();
  }, [getToken]);

  useEffect(() => {
    const fetchKeyStatus = async () => {
      if (!appUser?.id) {
        setKeyStatus((prev) => ({ ...prev, loading: false }));
        return;
      }

      try {
        setKeyStatus((prev) => ({ ...prev, loading: true }));
        const token = await getToken();
        setAuthToken(token);

        const response = await keyAPI.getStatus(appUser.id);
        const status = response.data?.status;

        setKeyStatus({
          loading: false,
          verified: Boolean(status?.verified),
          fingerprint: status?.onChain?.fingerprint || "",
          txHash: appUser?.blockchainTxHash || "",
          walletMatches: Boolean(status?.walletMatches),
        });
      } catch {
        setKeyStatus({
          loading: false,
          verified: false,
          fingerprint: "",
          txHash: "",
          walletMatches: false,
        });
      }
    };

    fetchKeyStatus();
  }, [appUser?.id, appUser?.blockchainTxHash, getToken]);

  const handleRegisterKey = async () => {
    if (!appUser?.id) {
      toast.error("User profile not ready yet.");
      return;
    }

    if (!isConnected || !address) {
      toast.error("Connect your wallet first.");
      return;
    }

    if (!isCorrectNetwork) {
      toast.error("Switch to Sepolia first.");
      return;
    }

    try {
      setIsRegisteringKey(true);

      const password = window.prompt("Create an encryption password");
      if (!password) {
        toast.error("Encryption password is required.");
        return;
      }

      const confirmPassword = window.prompt("Confirm encryption password");
      if (!confirmPassword) {
        toast.error("Please confirm your encryption password.");
        return;
      }

      if (password !== confirmPassword) {
        toast.error("Encryption passwords do not match.");
        return;
      }

      const keyMaterial = await buildUserKeyMaterial({ password });
      const { publicKey, fingerprint } = keyMaterial;

      const { txHash } = await registerKeyOnChain({
        userId: appUser.id,
        publicKey,
        fingerprint,
      });

      const token = await getToken();
      setAuthToken(token);
      await keyAPI.register({
        publicKey,
        fingerprint,
        walletAddress: address,
        txHash,
        encryptedPrivateKey: keyMaterial.encryptedPrivateKey,
        keyEncryptionSalt: keyMaterial.keyEncryptionSalt,
        keyEncryptionIv: keyMaterial.keyEncryptionIv,
        keyEncryptionIterations: keyMaterial.keyEncryptionIterations,
        keyEncryptionAlgorithm: keyMaterial.keyEncryptionAlgorithm,
        keyEncryptionKdf: keyMaterial.keyEncryptionKdf,
      });

      setKeyStatus({
        loading: false,
        verified: true,
        fingerprint,
        txHash,
        walletMatches: true,
      });

      toast.success("Key registered and verified on-chain.");
    } catch (error) {
      toast.error(error.message || "Failed to register key on-chain.");
    } finally {
      setIsRegisteringKey(false);
    }
  };

  return (
    <main className="min-h-screen bg-background chat-surface px-4 py-8 md:px-8">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border/70 bg-background/90 backdrop-blur p-5 shadow-lg">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Profile & Settings
            </h1>
            <p className="text-sm text-foreground-secondary">
              Manage your account and blockchain wallet preferences.
            </p>
          </div>
          <WalletConnectButton />
        </header>

        <div className="inline-flex rounded-2xl border border-border/70 bg-background/85 p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setTab("profile")}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "profile"
                ? "bg-gradient-to-r from-accent to-blue-600 text-white shadow"
                : "text-foreground-secondary hover:text-foreground hover:bg-background-secondary/70"
            }`}
          >
            Profile
          </button>
          <button
            type="button"
            onClick={() => setTab("preferences")}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "preferences"
                ? "bg-gradient-to-r from-accent to-blue-600 text-white shadow"
                : "text-foreground-secondary hover:text-foreground hover:bg-background-secondary/70"
            }`}
          >
            Preferences
          </button>
        </div>

        {activeTab === "profile" ? (
          <section className="space-y-4">
            <article className="rounded-3xl border border-border/70 bg-background/90 backdrop-blur p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-foreground">
                Account
              </h2>

              <dl className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                <div>
                  <dt className="text-foreground-secondary">Name</dt>
                  <dd className="font-medium text-foreground">
                    {user?.fullName || user?.username || "Not available"}
                  </dd>
                </div>
                <div>
                  <dt className="text-foreground-secondary">Email</dt>
                  <dd className="font-medium text-foreground">
                    {user?.primaryEmailAddress?.emailAddress || "Not available"}
                  </dd>
                </div>
                <div>
                  <dt className="text-foreground-secondary">Username</dt>
                  <dd className="font-medium text-foreground">
                    {user?.username || "Not available"}
                  </dd>
                </div>
                <div>
                  <dt className="text-foreground-secondary">Wallet</dt>
                  <dd className="font-medium text-foreground">
                    {formatAddress(address)}
                  </dd>
                </div>
              </dl>
            </article>

            <article className="rounded-3xl border border-border/70 bg-background/90 backdrop-blur p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-foreground">
                  Wallet Details
                </h2>
                {isConnected ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-1 text-xs font-semibold text-emerald-500">
                    <CheckCircle2 className="h-3 w-3" /> Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/20 px-2 py-1 text-xs font-semibold text-foreground-secondary">
                    <CircleOff className="h-3 w-3" /> Disconnected
                  </span>
                )}
              </div>

              <div className="space-y-3 text-sm">
                <div className="rounded-2xl border border-border/70 bg-background px-4 py-3">
                  <p className="text-foreground-secondary">Address</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="break-all font-mono text-xs text-foreground">
                      {address || "Not connected"}
                    </p>
                    {address && (
                      <button
                        onClick={handleCopy}
                        type="button"
                        className="rounded-lg p-2 text-foreground-secondary transition-colors hover:bg-background-secondary hover:text-foreground"
                        aria-label="Copy wallet address"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-border/70 bg-background px-4 py-3">
                    <p className="text-foreground-secondary">Network</p>
                    <p className="mt-1 font-medium text-foreground">
                      {isConnected
                        ? isCorrectNetwork
                          ? "Sepolia"
                          : `Chain ${chainId || "Unknown"}`
                        : "-"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background px-4 py-3">
                    <p className="text-foreground-secondary">Balance</p>
                    <p className="mt-1 font-medium text-foreground">
                      {isConnected ? `${Number(balance).toFixed(4)} ETH` : "-"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background px-4 py-3">
                    <p className="text-foreground-secondary">Status</p>
                    <p className="mt-1 font-medium text-foreground">
                      {isConnected ? "Connected" : "Read-only"}
                    </p>
                  </div>
                </div>
              </div>
            </article>

            <article className="rounded-3xl border border-border/70 bg-background/90 backdrop-blur p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-foreground">
                  Key Registry
                </h2>
                <BlockchainKeyBadge
                  status={
                    keyStatus.loading
                      ? "loading"
                      : keyStatus.verified
                        ? "verified"
                        : "unverified"
                  }
                />
              </div>

              <div className="space-y-3 text-sm">
                <div className="rounded-2xl border border-border/70 bg-background px-4 py-3">
                  <p className="text-foreground-secondary">Fingerprint</p>
                  <p className="mt-1 break-all font-mono text-xs text-foreground">
                    {keyStatus.fingerprint || "No key registered yet"}
                  </p>
                </div>

                <div className="rounded-2xl border border-border/70 bg-background px-4 py-3">
                  <p className="text-foreground-secondary">Wallet match</p>
                  <p className="mt-1 font-medium text-foreground">
                    {keyStatus.loading
                      ? "Checking..."
                      : keyStatus.walletMatches
                        ? "Wallet binding verified"
                        : "Wallet mismatch or no on-chain key"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleRegisterKey}
                    disabled={isRegisteringKey}
                    className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <Shield className="h-4 w-4" />
                    {isRegisteringKey
                      ? "Registering key..."
                      : "Register key on-chain"}
                  </button>

                  {keyStatus.txHash && (
                    <button
                      type="button"
                      onClick={() =>
                        window.open(
                          getTxExplorerUrl(keyStatus.txHash),
                          "_blank",
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-background-secondary"
                    >
                      <ExternalLink className="h-4 w-4" /> View tx
                    </button>
                  )}
                </div>
              </div>
            </article>

            <article className="rounded-3xl border border-border/70 bg-background/90 backdrop-blur p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-foreground">
                  Recent Calls
                </h2>
                <span className="text-xs text-foreground-secondary">
                  Last 20
                </span>
              </div>

              {isLoadingCalls ? (
                <p className="text-sm text-foreground-secondary">
                  Loading call history...
                </p>
              ) : callHistory.length === 0 ? (
                <p className="text-sm text-foreground-secondary">
                  No calls yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {callHistory.map((call) => {
                    const currentUserId = appUser?.id || appUser?._id;
                    const isOutgoing =
                      call?.initiator?.id?.toString?.() ===
                      currentUserId?.toString?.();

                    const peer = isOutgoing ? call.receiver : call.initiator;

                    return (
                      <div
                        key={call.callId}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background px-4 py-3 shadow-sm"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar
                            src={peer?.avatar}
                            name={peer?.name || "Unknown"}
                            size="md"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {peer?.name || "Unknown"}
                            </p>
                            <p className="truncate text-xs text-foreground-secondary">
                              {isOutgoing ? "Outgoing" : "Incoming"} ·{" "}
                              {formatCallDuration(call.duration)}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeClasses(
                              call.status,
                            )}`}
                          >
                            {call.status}
                          </span>
                          <p className="mt-1 text-xs text-foreground-secondary">
                            {call.createdAt
                              ? formatDistanceToNow(new Date(call.createdAt), {
                                  addSuffix: true,
                                })
                              : "Unknown"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          </section>
        ) : (
          <section className="space-y-4">
            <article className="rounded-3xl border border-border/70 bg-background/90 backdrop-blur p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-foreground">
                Blockchain Preferences
              </h2>

              <div className="space-y-3 text-sm">
                <div className="rounded-2xl border border-border/70 bg-background px-4 py-3">
                  <p className="text-foreground-secondary">Preferred Network</p>
                  <p className="mt-1 font-medium text-foreground">
                    Sepolia Testnet
                  </p>
                </div>

                <div className="rounded-2xl border border-border/70 bg-background px-4 py-3">
                  <p className="text-foreground-secondary">Current Wallet</p>
                  <p className="mt-1 font-medium text-foreground">
                    {formatAddress(address)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  {!isConnected ? (
                    <WalletConnectButton />
                  ) : (
                    <>
                      {!isCorrectNetwork && (
                        <button
                          onClick={switchToSepolia}
                          type="button"
                          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
                        >
                          Switch to Sepolia
                        </button>
                      )}
                      <button
                        onClick={disconnect}
                        type="button"
                        className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-500 transition-colors hover:bg-red-500/20"
                      >
                        Disconnect Wallet
                      </button>
                    </>
                  )}
                </div>
              </div>
            </article>
          </section>
        )}
      </div>
    </main>
  );
}
