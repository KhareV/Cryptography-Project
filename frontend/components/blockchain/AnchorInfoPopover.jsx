"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, ExternalLink } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import IntegrityVerifyModal from "@/components/blockchain/IntegrityVerifyModal";
import { anchorAPI, setAuthToken } from "@/lib/api";

const formatDate = (value) => {
  if (!value) return "Unknown";
  return format(new Date(value), "MMM d, yyyy 'at' HH:mm");
};

const truncateHash = (value) => {
  if (!value) return "";
  if (value.length < 22) return value;
  return `${value.slice(0, 14)}...${value.slice(-8)}`;
};

export default function AnchorInfoPopover({
  type,
  id,
  title,
  isOpen,
  onClose,
  anchorRef,
  anchorData,
  onAnchorUpdated,
}) {
  const panelRef = useRef(null);
  const { getToken } = useAuth();

  const [style, setStyle] = useState({ top: 0, left: 0 });
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [isAnchoring, setIsAnchoring] = useState(false);

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const hasAnchor = Boolean(anchorData?.merkleRoot);

  const threadTypeLabel = type === "group" ? "group" : "conversation";

  useEffect(() => {
    if (!isOpen || !anchorRef?.current) return;

    const rect = anchorRef.current.getBoundingClientRect();
    const panelWidth = 360;
    const margin = 16;

    let left = rect.left;
    if (left + panelWidth > window.innerWidth - margin) {
      left = window.innerWidth - panelWidth - margin;
    }
    if (left < margin) {
      left = margin;
    }

    const prefersBottom = rect.bottom + 420 < window.innerHeight;
    const top = prefersBottom ? rect.bottom + 8 : rect.top - 8;

    setStyle({
      left,
      top,
      transform: prefersBottom ? "translateY(0)" : "translateY(-100%)",
    });
  }, [isOpen, anchorRef]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const onPointerDown = (event) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target) &&
        !anchorRef.current?.contains(event.target)
      ) {
        onClose?.();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [isOpen, onClose, anchorRef]);

  const copyValue = async (value, label) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Unable to copy");
    }
  };

  const handleAnchorNow = async () => {
    if (!id || !type) return;

    try {
      setIsAnchoring(true);
      const token = await getToken();
      setAuthToken(token);

      const response =
        type === "conversation"
          ? await anchorAPI.anchorConversationNow(id)
          : await anchorAPI.anchorGroupNow(id);

      const nextAnchor = response.data?.anchor || null;
      if (nextAnchor) {
        onAnchorUpdated?.(nextAnchor);
      }

      toast.success(`${threadTypeLabel} anchored successfully`);
    } catch (error) {
      toast.error(error.message || "Failed to anchor now");
    } finally {
      setIsAnchoring(false);
    }
  };

  const explanation = useMemo(
    () =>
      "Message hashes are periodically anchored on Ethereum Sepolia. This proves the server has not altered or deleted messages.",
    [],
  );

  if (!isMounted) return null;

  if (!isOpen && !verifyOpen) {
    return null;
  }

  return createPortal(
    <>
      {isOpen && (
        <div
          ref={panelRef}
          style={style}
          className="fixed z-[120] w-[22rem] rounded-2xl border border-border/80 bg-background/95 p-4 shadow-2xl backdrop-blur"
        >
          <h4 className="text-sm font-semibold text-foreground">
            Message Integrity
          </h4>

          {hasAnchor ? (
            <div className="mt-3 space-y-2 text-sm">
              <p className="text-foreground-secondary">
                Anchored:{" "}
                <span className="text-foreground">
                  {formatDate(anchorData.anchoredAt)}
                </span>
              </p>
              <p className="text-foreground-secondary">
                Messages in batch:{" "}
                <span className="text-foreground">
                  {anchorData.messageCount || 0} messages
                </span>
              </p>

              <div className="rounded-xl border border-border/70 bg-background p-2.5">
                <div className="flex items-center justify-between text-xs text-foreground-secondary">
                  <span>Merkle Root</span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-accent"
                    onClick={() =>
                      copyValue(anchorData.merkleRoot, "Merkle root")
                    }
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </button>
                </div>
                <p className="mt-1 font-mono text-xs text-foreground break-all">
                  {truncateHash(anchorData.merkleRoot)}
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-background p-2.5">
                <div className="flex items-center justify-between text-xs text-foreground-secondary">
                  <span>Transaction</span>
                  {anchorData.etherscanLink && (
                    <a
                      href={anchorData.etherscanLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-accent"
                    >
                      Etherscan <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
                <p className="mt-1 font-mono text-xs text-foreground break-all">
                  {truncateHash(anchorData.txHash)}
                </p>
              </div>

              <div className="border-t border-border/70 pt-3">
                <Button
                  className="w-full"
                  variant="primary"
                  onClick={() => {
                    setVerifyOpen(true);
                    onClose?.();
                  }}
                >
                  Verify Integrity
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-foreground-secondary">
                Messages not yet anchored on blockchain.
              </p>
              <Button
                className="w-full"
                variant="primary"
                isLoading={isAnchoring}
                onClick={handleAnchorNow}
              >
                Anchor Now
              </Button>
            </div>
          )}

          <p className="mt-3 text-xs text-foreground-secondary">
            {explanation}
          </p>
        </div>
      )}

      <IntegrityVerifyModal
        isOpen={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        type={type}
        id={id}
        title={title}
      />
    </>,
    document.body,
  );
}
