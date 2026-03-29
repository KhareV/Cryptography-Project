"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { Button } from "@/components/ui/Button";

export default function NetworkWarningBanner() {
  const pathname = usePathname();
  const { isConnected, isCorrectNetwork, switchToSepolia } = useWallet();

  const [dismissed, setDismissed] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [pathname]);

  if (!isConnected || isCorrectNetwork || dismissed) {
    return null;
  }

  const handleSwitch = async () => {
    setIsSwitching(true);
    try {
      await switchToSepolia();
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div className="sticky top-0 z-[60] w-full border-b border-red-500/30 bg-red-500/10 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
        <p className="flex-1 text-sm text-foreground">
          You&apos;re on the wrong network. Switch to Sepolia to use blockchain
          features.
        </p>

        <Button
          size="sm"
          className="rounded-full"
          onClick={handleSwitch}
          isLoading={isSwitching}
        >
          {isSwitching ? "Switching..." : "Switch Now"}
        </Button>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-lg p-1 text-foreground-secondary transition-colors hover:bg-background-secondary hover:text-foreground"
          aria-label="Dismiss network warning"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
