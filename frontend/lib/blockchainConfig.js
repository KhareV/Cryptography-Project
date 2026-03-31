import contractAddresses from "@/lib/contractAddresses.json";

export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_CHAIN_HEX = "0xaa36a7";

export const BLOCKCHAIN_CONFIG = {
  chainId: SEPOLIA_CHAIN_ID,
  chainHex: SEPOLIA_CHAIN_HEX,
  networkName: "sepolia",
  rpcUrl:
    process.env.NEXT_PUBLIC_BLOCKCHAIN_RPC_URL ||
    "https://ethereum-sepolia-rpc.publicnode.com",
  keyRegistryAddress: contractAddresses.keyRegistry,
  communityAddress: contractAddresses.community,
  anchorAddress: contractAddresses.anchor,
};

export const getTxExplorerUrl = (txHash) => {
  if (!txHash) return "";
  return `https://sepolia.etherscan.io/tx/${txHash}`;
};

export const getAddressExplorerUrl = (address) => {
  if (!address) return "";
  return `https://sepolia.etherscan.io/address/${address}`;
};

export const hasBlockchainAddresses = () => {
  return Boolean(
    BLOCKCHAIN_CONFIG.keyRegistryAddress &&
    BLOCKCHAIN_CONFIG.communityAddress &&
    BLOCKCHAIN_CONFIG.anchorAddress,
  );
};
