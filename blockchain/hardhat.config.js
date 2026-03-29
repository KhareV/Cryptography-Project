require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const { SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY, ETHERSCAN_API_KEY } =
  process.env;

const sepoliaAccounts = DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [];

/** @type import("hardhat/config").HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {},
    sepolia: {
      url: SEPOLIA_RPC_URL || "",
      accounts: sepoliaAccounts,
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY || "",
  },
};
