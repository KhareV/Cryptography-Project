"use client";

import { Coins, Lock } from "lucide-react";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export default function JoinCommunityModal({
  isOpen,
  onClose,
  group,
  isJoining,
  onJoin,
}) {
  const joinFeeEth = Number(group?.joinFeeEth || 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pay and Join Community"
      description="This group requires an on-chain payment to join."
      size="md"
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-border/70 bg-background-secondary/50 p-4">
          <p className="text-sm text-foreground-secondary">Community</p>
          <p className="mt-1 text-base font-semibold text-foreground">
            {group?.name || "Unknown Group"}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="flex items-center gap-2 text-emerald-500">
            <Coins className="h-4 w-4" />
            <p className="text-sm font-semibold">Join fee</p>
          </div>
          <p className="mt-1 text-xl font-bold text-foreground">
            {joinFeeEth.toFixed(4)} ETH
          </p>
          <p className="mt-1 text-xs text-foreground-secondary">
            The payment is executed through your wallet on Sepolia and verified
            by the backend before membership is granted.
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-background p-4 text-xs text-foreground-secondary">
          <div className="flex items-start gap-2">
            <Lock className="mt-0.5 h-3.5 w-3.5 text-foreground-secondary" />
            <p>
              Only your wallet can authorize this transaction. CryptoChat does
              not custody your funds.
            </p>
          </div>
        </div>

        <ModalFooter>
          <Button variant="ghost" onClick={onClose} disabled={isJoining}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onJoin} disabled={isJoining}>
            {isJoining ? "Processing..." : "Pay & Join"}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
