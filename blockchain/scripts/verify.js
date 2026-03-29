const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function verifyContract(address, contractPathName) {
  try {
    await hre.run("verify:verify", {
      address,
      constructorArguments: [],
      contract: contractPathName,
    });
    console.log(`Verified: ${contractPathName} at ${address}`);
  } catch (error) {
    const message = error?.message || "";
    if (
      message.toLowerCase().includes("already verified") ||
      message.toLowerCase().includes("contract source code already verified")
    ) {
      console.log(`Already verified: ${address}`);
      return;
    }
    throw error;
  }
}

async function main() {
  if (hre.network.name === "hardhat") {
    throw new Error("Use a live network (e.g., sepolia) for verification.");
  }

  const addressesPath = path.resolve(
    __dirname,
    "..",
    "..",
    "frontend",
    "lib",
    "contractAddresses.json",
  );

  if (!fs.existsSync(addressesPath)) {
    throw new Error(
      "contractAddresses.json not found. Run deploy script first.",
    );
  }

  const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));

  await verifyContract(
    addresses.keyRegistry,
    "contracts/CryptoChatKeyRegistry.sol:CryptoChatKeyRegistry",
  );
  await verifyContract(
    addresses.community,
    "contracts/CryptoChatCommunity.sol:CryptoChatCommunity",
  );
  await verifyContract(
    addresses.anchor,
    "contracts/CryptoChatAnchor.sol:CryptoChatAnchor",
  );

  console.log("All verification jobs finished.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
