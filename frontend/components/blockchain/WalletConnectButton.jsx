"use client";

import { useMemo, useState } from "react";
import { Copy, ExternalLink, LogOut, Check } from "lucide-react";
import toast from "react-hot-toast";
import { useWallet } from "@/context/WalletContext";
import {
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
} from "@/components/ui/Dropdown";
import { Button } from "@/components/ui/Button";
import NoMetaMaskModal from "@/components/blockchain/NoMetaMaskModal";

function MetaMaskFoxIcon({ className = "w-5 h-5" }) {
  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d="M8 10l18 13-6-13h-12z" fill="#e17726" />
      <path d="M56 10l-18 13 6-13h12z" fill="#e27625" />
      <path d="M13 42l7 12 12-8-19-4z" fill="#e27625" />
      <path d="M51 42l-19 4 12 8 7-12z" fill="#e27625" />
      <path d="M44 31l3 9-9-1 6-8z" fill="#d5bfb2" />
      <path d="M20 31l6 8-9 1 3-9z" fill="#d5bfb2" />
      <path d="M32 23l11 6-4 17h-14l-4-17 11-6z" fill="#f6851b" />
      <path d="M32 23v23h-7l-4-17 11-6z" fill="#e27625" />
      <path d="M32 51l8-5-8-3-8 3 8 5z" fill="#c0ad9e" />
      <circle cx="27" cy="34" r="2" fill="#2f343b" />
      <circle cx="37" cy="34" r="2" fill="#2f343b" />
    </svg>
  );
}

function truncateAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getExplorerBase(chainId) {
  if (chainId === 11155111) {
    return "https://sepolia.etherscan.io/address/";
  }

  return "https://etherscan.io/address/";
}

export default function WalletConnectButton({ className = "" }) {
  const {
    address,
    balance,
    chainId,
    isConnected,
    isCorrectNetwork,
    connect,
    disconnect,
  } = useWallet();

  const [isConnecting, setIsConnecting] = useState(false);
  const [showNoMetaMaskModal, setShowNoMetaMaskModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const truncated = useMemo(() => truncateAddress(address), [address]);

  const handleConnect = async () => {
    const hasMetaMask =
      typeof window !== "undefined" && Boolean(window.ethereum?.isMetaMask);

    if (!hasMetaMask) {
      setShowNoMetaMaskModal(true);
      return;
    }

    setIsConnecting(true);
    try {
      await connect();
      toast.success("Wallet connected.");
    } catch (error) {
      if (error?.code === "NO_METAMASK") {
        setShowNoMetaMaskModal(true);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleCopy = async () => {
    if (!address) return;

    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success("Wallet address copied.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Unable to copy address.");
    }
  };

  if (!isConnected) {
    return (
      <>
        <Button
          onClick={handleConnect}
          isLoading={isConnecting}
          variant="secondary"
          className={`h-10 rounded-full px-4 ${className}`}
          leftIcon={
            !isConnecting ? <MetaMaskFoxIcon className="h-5 w-5" /> : null
          }
        >
          {isConnecting ? "Connecting Wallet..." : "Connect Wallet"}
        </Button>

        <NoMetaMaskModal
          isOpen={showNoMetaMaskModal}
          onClose={() => setShowNoMetaMaskModal(false)}
          onContinue={() => toast("Read-only mode enabled.")}
        />
      </>
    );
  }

  return (
    <>
      <Dropdown
        align="right"
        className="w-72"
        trigger={
          <button
            type="button"
            className={`inline-flex h-10 items-center gap-3 rounded-full border border-border bg-background-secondary px-3 transition-colors hover:bg-background-tertiary ${className}`}
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-[10px] font-bold text-white">
              {address.slice(2, 4).toUpperCase()}
            </div>
            <div className="min-w-0 text-left">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">
                  {truncated}
                </p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    isCorrectNetwork
                      ? "bg-emerald-500/20 text-emerald-500"
                      : "bg-red-500/20 text-red-500"
                  }`}
                >
                  {isCorrectNetwork ? "Sepolia" : "Wrong Network"}
                </span>
              </div>
              <p className="text-xs text-foreground-secondary">
                {Number(balance).toFixed(4)} ETH
              </p>
            </div>
          </button>
        }
      >
        <DropdownLabel>Connected Wallet</DropdownLabel>

        <div className="px-4 pb-2">
          <p className="break-all text-xs text-zinc-400">{address}</p>
        </div>

        <DropdownItem
          icon={
            copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )
          }
          onClick={handleCopy}
        >
          {copied ? "Copied" : "Copy Address"}
        </DropdownItem>

        <DropdownItem
          icon={<ExternalLink className="h-4 w-4" />}
          onClick={() =>
            window.open(`${getExplorerBase(chainId)}${address}`, "_blank")
          }
        >
          View on Etherscan
        </DropdownItem>

        <DropdownSeparator />

        <DropdownItem
          icon={<LogOut className="h-4 w-4" />}
          onClick={disconnect}
          isDestructive
        >
          Disconnect
        </DropdownItem>
      </Dropdown>

      <NoMetaMaskModal
        isOpen={showNoMetaMaskModal}
        onClose={() => setShowNoMetaMaskModal(false)}
        onContinue={() => toast("Read-only mode enabled.")}
      />
    </>
  );
}
