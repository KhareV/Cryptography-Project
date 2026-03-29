const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
require("dotenv").config();

function explorerBaseUrl(networkName) {
  if (networkName === "sepolia") return "https://sepolia.etherscan.io/address/";
  if (networkName === "mainnet") return "https://etherscan.io/address/";
  return "";
}

async function main() {
  const { ethers, network } = hre;
  const [deployer] = await ethers.getSigners();

  console.log("--------------------------------------------------");
  console.log(`Deploying contracts with wallet: ${deployer.address}`);
  console.log(`Network: ${network.name}`);
  console.log("--------------------------------------------------");

  const KeyRegistry = await ethers.getContractFactory("CryptoChatKeyRegistry");
  const keyRegistry = await KeyRegistry.deploy();
  await keyRegistry.waitForDeployment();
  const keyRegistryAddress = await keyRegistry.getAddress();
  console.log(`CryptoChatKeyRegistry deployed at: ${keyRegistryAddress}`);

  const Community = await ethers.getContractFactory("CryptoChatCommunity");
  const community = await Community.deploy();
  await community.waitForDeployment();
  const communityAddress = await community.getAddress();
  console.log(`CryptoChatCommunity deployed at: ${communityAddress}`);

  const Anchor = await ethers.getContractFactory("CryptoChatAnchor");
  const anchor = await Anchor.deploy();
  await anchor.waitForDeployment();
  const anchorAddress = await anchor.getAddress();
  console.log(`CryptoChatAnchor deployed at: ${anchorAddress}`);

  const backendWallet = process.env.BACKEND_WALLET_ADDRESS;
  if (!backendWallet) {
    throw new Error("BACKEND_WALLET_ADDRESS is missing in .env");
  }

  console.log(`Authorizing backend anchor wallet: ${backendWallet}`);
  const authTx = await anchor.addAuthorizedAnchorer(backendWallet);
  await authTx.wait();

  const contractAddresses = {
    keyRegistry: keyRegistryAddress,
    community: communityAddress,
    anchor: anchorAddress,
    network: network.name,
    deployedAt: new Date().toISOString(),
  };

  const outputPaths = [
    path.resolve(
      __dirname,
      "..",
      "..",
      "frontend",
      "lib",
      "contractAddresses.json",
    ),
    path.resolve(
      __dirname,
      "..",
      "..",
      "backend",
      "src",
      "config",
      "contractAddresses.json",
    ),
  ];

  for (const outputPath of outputPaths) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(contractAddresses, null, 2));
    console.log(`Wrote contract addresses -> ${outputPath}`);
  }

  const explorer = explorerBaseUrl(network.name);
  console.log("--------------------------------------------------");
  if (explorer) {
    console.log(`KeyRegistry Etherscan: ${explorer}${keyRegistryAddress}`);
    console.log(`Community Etherscan:  ${explorer}${communityAddress}`);
    console.log(`Anchor Etherscan:     ${explorer}${anchorAddress}`);
  } else {
    console.log("Etherscan links unavailable for this network.");
  }
  console.log("Deployment completed successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
