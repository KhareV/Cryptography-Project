"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import toast from "react-hot-toast";

const WalletContext = createContext(null);

const SEPOLIA_CHAIN_ID_DEC = 11155111;
const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";
const WALLET_CONNECTED_FLAG = "cryptochat_wallet_connected";

function parseChainId(chainIdValue) {
  if (!chainIdValue) return null;

  if (typeof chainIdValue === "number") {
    return chainIdValue;
  }

  if (typeof chainIdValue === "string") {
    if (chainIdValue.startsWith("0x")) {
      return Number.parseInt(chainIdValue, 16);
    }

    return Number.parseInt(chainIdValue, 10);
  }

  return null;
}

function formatEthBalance(weiHex, fractionDigits = 4) {
  if (!weiHex) return "0";

  const WEI_PER_ETH = 10n ** 18n;

  try {
    const wei = BigInt(weiHex);
    const whole = wei / WEI_PER_ETH;
    const fraction = wei % WEI_PER_ETH;

    if (fractionDigits <= 0) {
      return whole.toString();
    }

    const paddedFraction = fraction.toString().padStart(18, "0");
    const trimmedFraction = paddedFraction
      .slice(0, fractionDigits)
      .replace(/0+$/, "");

    if (!trimmedFraction) {
      return whole.toString();
    }

    return `${whole.toString()}.${trimmedFraction}`;
  } catch {
    return "0";
  }
}

export function WalletProvider({ children }) {
  const [address, setAddress] = useState("");
  const [balance, setBalance] = useState("0");
  const [chainId, setChainId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMetaMaskInstalled, setIsMetaMaskInstalled] = useState(false);

  const isCorrectNetwork = chainId === SEPOLIA_CHAIN_ID_DEC;

  const getEthereum = useCallback(() => {
    if (typeof window === "undefined") return null;

    const { ethereum } = window;
    if (!ethereum || !ethereum.isMetaMask) {
      return null;
    }

    return ethereum;
  }, []);

  const refreshBalance = useCallback(
    async (walletAddress) => {
      const ethereum = getEthereum();
      if (!ethereum || !walletAddress) {
        setBalance("0");
        return;
      }

      try {
        const wei = await ethereum.request({
          method: "eth_getBalance",
          params: [walletAddress, "latest"],
        });

        setBalance(formatEthBalance(wei));
      } catch (error) {
        console.error("Failed to fetch wallet balance", error);
        setBalance("0");
      }
    },
    [getEthereum],
  );

  const applyWalletState = useCallback(
    async ({ nextAddress, nextChainId, persistConnection = false }) => {
      const normalizedChainId = parseChainId(nextChainId);

      if (nextAddress) {
        setAddress(nextAddress);
        setIsConnected(true);
        if (normalizedChainId !== null) {
          setChainId(normalizedChainId);
        }

        if (persistConnection && typeof window !== "undefined") {
          localStorage.setItem(WALLET_CONNECTED_FLAG, "true");
        }

        await refreshBalance(nextAddress);
        return;
      }

      setAddress("");
      setBalance("0");
      setIsConnected(false);
      if (normalizedChainId !== null) {
        setChainId(normalizedChainId);
      }
    },
    [refreshBalance],
  );

  const syncFromWallet = useCallback(async () => {
    const ethereum = getEthereum();
    if (!ethereum) {
      setIsMetaMaskInstalled(false);
      return;
    }

    setIsMetaMaskInstalled(true);

    try {
      const [accounts, activeChainId] = await Promise.all([
        ethereum.request({ method: "eth_accounts" }),
        ethereum.request({ method: "eth_chainId" }),
      ]);

      await applyWalletState({
        nextAddress: accounts?.[0],
        nextChainId: activeChainId,
      });
    } catch (error) {
      console.error("Failed to sync wallet state", error);
    }
  }, [applyWalletState, getEthereum]);

  const connect = useCallback(async () => {
    const ethereum = getEthereum();

    if (!ethereum) {
      const error = new Error("MetaMask not installed");
      error.code = "NO_METAMASK";
      throw error;
    }

    try {
      const accounts = await ethereum.request({
        method: "eth_requestAccounts",
      });
      const activeChainId = await ethereum.request({ method: "eth_chainId" });

      if (!accounts || accounts.length === 0) {
        const error = new Error(
          "MetaMask is locked or no account is available",
        );
        error.code = "WALLET_LOCKED";
        throw error;
      }

      await applyWalletState({
        nextAddress: accounts[0],
        nextChainId: activeChainId,
        persistConnection: true,
      });

      return {
        address: accounts[0],
        chainId: parseChainId(activeChainId),
      };
    } catch (error) {
      if (error?.code === 4001) {
        toast.error("Wallet connection was rejected.");
      } else if (error?.code === -32002) {
        toast.error("MetaMask already has a pending connection request.");
      } else if (error?.code === "WALLET_LOCKED") {
        toast.error("Unlock MetaMask and try connecting again.");
      } else {
        toast.error("Unable to connect wallet right now.");
      }

      throw error;
    }
  }, [applyWalletState, getEthereum]);

  const disconnect = useCallback(() => {
    setAddress("");
    setBalance("0");
    setIsConnected(false);

    if (typeof window !== "undefined") {
      localStorage.removeItem(WALLET_CONNECTED_FLAG);
    }

    toast.success("Wallet disconnected.");
  }, []);

  const switchToSepolia = useCallback(async () => {
    const ethereum = getEthereum();
    if (!ethereum) {
      const error = new Error("MetaMask not installed");
      error.code = "NO_METAMASK";
      throw error;
    }

    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
      });

      setChainId(SEPOLIA_CHAIN_ID_DEC);

      if (address) {
        await refreshBalance(address);
      }

      toast.success("Switched to Sepolia.");
    } catch (error) {
      if (error?.code === 4902) {
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: SEPOLIA_CHAIN_ID_HEX,
              chainName: "Sepolia",
              nativeCurrency: {
                name: "Sepolia Ether",
                symbol: "ETH",
                decimals: 18,
              },
              rpcUrls: ["https://rpc.sepolia.org"],
              blockExplorerUrls: ["https://sepolia.etherscan.io"],
            },
          ],
        });

        await ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
        });

        setChainId(SEPOLIA_CHAIN_ID_DEC);
        if (address) {
          await refreshBalance(address);
        }
        toast.success("Sepolia network added.");
        return;
      }

      if (error?.code === 4001) {
        toast.error("Network switch request was rejected.");
      } else {
        toast.error("Could not switch network.");
      }

      throw error;
    }
  }, [address, getEthereum, refreshBalance]);

  useEffect(() => {
    const ethereum = getEthereum();

    if (!ethereum) {
      setIsMetaMaskInstalled(false);
      return;
    }

    setIsMetaMaskInstalled(true);

    const tryReconnect = async () => {
      const shouldReconnect =
        typeof window !== "undefined" &&
        localStorage.getItem(WALLET_CONNECTED_FLAG) === "true";

      if (!shouldReconnect) {
        // Keep chain state synced even when disconnected.
        try {
          const currentChainId = await ethereum.request({
            method: "eth_chainId",
          });
          setChainId(parseChainId(currentChainId));
        } catch {
          setChainId(null);
        }
        return;
      }

      await syncFromWallet();
    };

    tryReconnect();

    const handleAccountsChanged = (accounts) => {
      const nextAddress = accounts?.[0] || "";

      if (!nextAddress) {
        setAddress("");
        setBalance("0");
        setIsConnected(false);
        if (typeof window !== "undefined") {
          localStorage.removeItem(WALLET_CONNECTED_FLAG);
        }
        return;
      }

      setAddress(nextAddress);
      setIsConnected(true);
      if (typeof window !== "undefined") {
        localStorage.setItem(WALLET_CONNECTED_FLAG, "true");
      }
      refreshBalance(nextAddress);
    };

    const handleChainChanged = (nextChainId) => {
      const normalizedChainId = parseChainId(nextChainId);
      setChainId(normalizedChainId);

      if (address) {
        refreshBalance(address);
      }
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);

    return () => {
      if (ethereum.removeListener) {
        ethereum.removeListener("accountsChanged", handleAccountsChanged);
        ethereum.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, [address, getEthereum, refreshBalance, syncFromWallet]);

  const value = useMemo(
    () => ({
      address,
      balance,
      chainId,
      isConnected,
      isCorrectNetwork,
      connect,
      disconnect,
      switchToSepolia,
    }),
    [
      address,
      balance,
      chainId,
      isConnected,
      isCorrectNetwork,
      connect,
      disconnect,
      switchToSepolia,
    ],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);

  if (!context) {
    throw new Error("useWallet must be used inside WalletProvider");
  }

  return context;
}
