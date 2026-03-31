"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { anchorAPI, setAuthToken } from "@/lib/api";

const formatAnchorDate = (value) => {
  if (!value) return "Unknown";
  return format(new Date(value), "MMM d, yyyy 'at' HH:mm");
};

const truncateHash = (value, size = 14) => {
  if (!value) return "";
  if (value.length <= size) return value;
  return `${value.slice(0, size)}...${value.slice(-8)}`;
};

const getFriendlyFailReason = (value) => {
  const raw = String(value || "").trim();
  const normalized = raw.toLowerCase();

  if (!raw) {
    return {
      summary: "Verification failed due to an unknown error.",
      showRaw: false,
    };
  }

  if (
    normalized.includes("could not coalesce error") ||
    normalized.includes("missing response for request") ||
    normalized.includes("timed out")
  ) {
    return {
      summary:
        "Blockchain RPC provider timed out while fetching anchor logs. Please retry in a few seconds.",
      showRaw: true,
    };
  }

  return {
    summary: raw,
    showRaw: false,
  };
};

export default function IntegrityVerifyModal({
  isOpen,
  onClose,
  type,
  id,
  title,
}) {
  const { getToken } = useAuth();
  const [stage, setStage] = useState("idle");
  const [result, setResult] = useState(null);
  const [progressStep, setProgressStep] = useState(1);

  useEffect(() => {
    if (!isOpen || !id || !type) {
      return undefined;
    }

    let cancelled = false;
    const timers = [];

    const verify = async () => {
      try {
        setStage("loading");
        setResult(null);
        setProgressStep(1);

        timers.push(setTimeout(() => setProgressStep(2), 450));
        timers.push(setTimeout(() => setProgressStep(3), 1000));

        const token = await getToken();
        setAuthToken(token);

        const response =
          type === "conversation"
            ? await anchorAPI.verifyConversation(id)
            : await anchorAPI.verifyGroup(id);

        const payload = response.data || {};
        if (cancelled) return;

        setResult(payload);
        setProgressStep(3);

        if (!payload.chainMerkleRoot && !payload.verified) {
          setStage("never-anchored");
          return;
        }

        if (payload.verified) {
          setStage("success");
        } else {
          setStage("failed");
        }
      } catch (error) {
        if (cancelled) return;
        setResult({
          verified: false,
          failReason: error.message || "Verification failed",
          messageCount: 0,
          computedMerkleRoot: "",
          chainMerkleRoot: "",
          anchoredAt: null,
          etherscanLink: "",
        });
        setStage("failed");
      }
    };

    verify();

    return () => {
      cancelled = true;
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [getToken, id, isOpen, type]);

  const subtitle = useMemo(() => {
    if (!result) return "";
    if (stage === "success") {
      return `${result.messageCount || 0} messages - untampered since ${formatAnchorDate(result.anchoredAt)}`;
    }
    if (stage === "failed") {
      return "Message hashes do not match the blockchain record";
    }
    return "Messages have not been anchored yet";
  }, [result, stage]);

  const failReasonDisplay = useMemo(
    () => getFriendlyFailReason(result?.failReason),
    [result?.failReason],
  );

  const failedStateHint = failReasonDisplay.showRaw
    ? "Verification could not complete because the RPC provider rejected the request range. Retry shortly or use a stronger RPC plan."
    : "This could indicate messages have been modified or deleted by the server.";

  const handleCopy = async (value, label) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Unable to copy");
    }
  };

  const handleReport = async () => {
    try {
      const evidence = JSON.stringify(
        {
          title,
          type,
          id,
          verified: result?.verified,
          failReason: result?.failReason || "",
          computedMerkleRoot: result?.computedMerkleRoot || "",
          chainMerkleRoot: result?.chainMerkleRoot || "",
          anchoredAt: result?.anchoredAt || null,
          generatedAt: new Date().toISOString(),
        },
        null,
        2,
      );
      await navigator.clipboard.writeText(evidence);
      toast.success("Verification evidence copied");
    } catch {
      toast.error("Could not copy evidence");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        stage === "success" ? "All messages verified" : "Message Integrity"
      }
      description={subtitle}
      size="lg"
    >
      {stage === "loading" && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background-secondary/50 p-4">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
            <p className="text-sm text-foreground-secondary">
              Fetching messages and checking blockchain...
            </p>
          </div>

          <div className="space-y-2 rounded-2xl border border-border/70 bg-background p-4 text-sm">
            <p
              className={
                progressStep >= 1
                  ? "text-emerald-500"
                  : "text-foreground-secondary"
              }
            >
              {progressStep >= 1 ? "[check]" : "[ ]"} Fetching message history
            </p>
            <p
              className={
                progressStep >= 2
                  ? "text-emerald-500"
                  : "text-foreground-secondary"
              }
            >
              {progressStep >= 2 ? "[check]" : "[~]"} Computing message hashes
            </p>
            <p
              className={
                progressStep >= 3
                  ? "text-emerald-500"
                  : "text-foreground-secondary"
              }
            >
              {progressStep >= 3 ? "[check]" : "[ ]"} Comparing with Sepolia
            </p>
          </div>
        </div>
      )}

      {stage === "success" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
              <CheckCircle2 className="h-10 w-10 animate-pulse text-emerald-500" />
            </div>
            <h3 className="text-lg font-semibold text-emerald-500">
              All messages verified
            </h3>
            <p className="mt-1 text-sm text-foreground-secondary">{subtitle}</p>
          </div>

          <div className="space-y-3 rounded-2xl border border-border/70 bg-background p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-foreground-secondary">Computed Root</span>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-accent"
                onClick={() =>
                  handleCopy(result?.computedMerkleRoot, "Computed root")
                }
              >
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
            </div>
            <p className="font-mono text-xs text-foreground break-all">
              {result?.computedMerkleRoot}
            </p>

            <div className="flex items-center justify-between gap-3 pt-2">
              <span className="text-foreground-secondary">On-Chain Root</span>
              <div className="inline-flex items-center gap-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs text-accent"
                  onClick={() =>
                    handleCopy(result?.chainMerkleRoot, "On-chain root")
                  }
                >
                  <Copy className="h-3.5 w-3.5" /> Copy
                </button>
                {result?.etherscanLink && (
                  <a
                    href={result.etherscanLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-accent"
                  >
                    Etherscan <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
            <p className="font-mono text-xs text-foreground break-all">
              {result?.chainMerkleRoot}
            </p>

            <p className="pt-2 text-emerald-500">Match: Identical</p>
          </div>

          <p className="text-sm text-foreground-secondary">
            This conversation&apos;s integrity is mathematically proven on the
            Ethereum blockchain.
          </p>

          <div className="flex justify-end">
            <Button variant="primary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}

      {stage === "failed" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15">
              <ShieldAlert className="h-10 w-10 animate-pulse text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-red-500">
              Integrity Check Failed
            </h3>
            <p className="mt-1 text-sm text-foreground-secondary">{subtitle}</p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background p-4 text-sm space-y-3">
            <p className="text-foreground-secondary">Computed Root</p>
            <p className="font-mono text-xs break-all">
              {result?.computedMerkleRoot || "n/a"}
            </p>
            <p className="text-foreground-secondary">On-Chain Root</p>
            <p className="font-mono text-xs break-all">
              {result?.chainMerkleRoot || "n/a"}
            </p>
            <p className="text-xs text-red-500 break-words">
              Reason: {failReasonDisplay.summary}
            </p>
            {failReasonDisplay.showRaw && result?.failReason && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-2">
                <p className="text-[11px] font-semibold text-red-500">
                  Technical details
                </p>
                <p className="mt-1 max-h-24 overflow-y-auto font-mono text-[11px] text-red-500/90 break-all whitespace-pre-wrap">
                  {result.failReason}
                </p>
              </div>
            )}
          </div>

          <p className="text-sm text-foreground-secondary">{failedStateHint}</p>

          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={handleReport}>
              Report this
            </Button>
            <Button variant="primary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}

      {stage === "never-anchored" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/70 bg-background-secondary/40 p-5 text-center">
            <p className="text-3xl">#</p>
            <h3 className="mt-2 text-lg font-semibold text-foreground">
              No blockchain record found
            </h3>
            <p className="mt-1 text-sm text-foreground-secondary">
              Messages have not been anchored yet.
            </p>
          </div>
          <div className="flex justify-end">
            <Button variant="primary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
