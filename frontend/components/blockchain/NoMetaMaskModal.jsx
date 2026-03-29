"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export default function NoMetaMaskModal({ isOpen, onClose, onContinue }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="MetaMask Not Found"
      description="Install MetaMask to connect your wallet and unlock blockchain features."
      size="md"
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-4 py-3">
          <p className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Your browser does not have MetaMask installed.
          </p>
        </div>

        <a
          href="https://metamask.io/download/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          Install MetaMask
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      <ModalFooter className="justify-between">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            onContinue?.();
            onClose?.();
          }}
        >
          Continue without wallet (read-only mode)
        </Button>
      </ModalFooter>
    </Modal>
  );
}
