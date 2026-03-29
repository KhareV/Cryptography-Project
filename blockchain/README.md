# CryptoChat Blockchain (Phase 4)

This folder contains the Hardhat project for CryptoChat smart contracts.

## Why blockchain (viva-ready)

### 1) CryptoChatKeyRegistry

- Problem with a normal database: the backend could silently swap a user's public key and execute a server-level MITM attack.
- Why smart contract: key fingerprints are immutably anchored on-chain, so clients can verify key ownership independently of server claims.
- Security impact: even if the backend is compromised, unauthorized key substitution is detectable and blocked by wallet ownership checks.

### 2) CryptoChatCommunity

- Problem with a normal database/payment gateway: platform operators can alter balances, reverse records, or withhold payouts.
- Why smart contract: join fees are escrowed and released by immutable contract code; no intermediary and no app-owner custody trick.
- Security impact: members/admins can verify membership and fee flows trustlessly on-chain.

### 3) CryptoChatAnchor

- Problem with a normal database: message history can be edited/deleted without users knowing.
- Why smart contract: Merkle roots for message batches are committed to immutable ledger history.
- Security impact: any later alteration/deletion breaks Merkle verification, producing cryptographic tamper evidence.

## Project structure

- contracts/CryptoChatKeyRegistry.sol
- contracts/CryptoChatCommunity.sol
- contracts/CryptoChatAnchor.sol
- scripts/deploy.js
- scripts/verify.js
- test/KeyRegistry.test.js
- test/Community.test.js
- test/Anchor.test.js
- hardhat.config.js
- .env.example

## Environment variables

Copy .env.example to .env and fill values:

- SEPOLIA_RPC_URL: your Sepolia RPC endpoint
- DEPLOYER_PRIVATE_KEY: deployer private key
- BACKEND_WALLET_ADDRESS: backend wallet authorized to anchor
- ETHERSCAN_API_KEY: Etherscan API key for verification

## Commands

1. Install dependencies

```bash
cd blockchain
npm install
```

2. Compile contracts

```bash
npx hardhat compile
```

3. Run tests

```bash
npx hardhat test
```

4. Deploy to Sepolia

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

5. Verify contracts on Etherscan

Option A (single contract, native command):

```bash
npx hardhat verify --network sepolia <address>
```

Option B (verify all deployed addresses from JSON):

```bash
npx hardhat run scripts/verify.js --network sepolia
```

## Deployment outputs

After deployment, script writes one shared JSON to both:

- frontend/lib/contractAddresses.json
- backend/src/config/contractAddresses.json

Format:

```json
{
  "keyRegistry": "0x...",
  "community": "0x...",
  "anchor": "0x...",
  "network": "sepolia",
  "deployedAt": "2024-01-01T00:00:00Z"
}
```

## Sepolia faucet links

- https://sepoliafaucet.com/
- https://www.alchemy.com/faucets/ethereum-sepolia
- https://faucet.quicknode.com/ethereum/sepolia

## How to confirm deployment worked

1. Check deployment logs for all three addresses.
2. Open each address on Sepolia Etherscan:
   - https://sepolia.etherscan.io/address/<KEY_REGISTRY_ADDRESS>
   - https://sepolia.etherscan.io/address/<COMMUNITY_ADDRESS>
   - https://sepolia.etherscan.io/address/<ANCHOR_ADDRESS>
3. Confirm the backend wallet was authorized on CryptoChatAnchor:
   - call isAuthorizedAnchorer(BACKEND_WALLET_ADDRESS)
4. Confirm JSON files were written in both frontend and backend paths.

## Notes for viva defense

- KeyRegistry proves identity-key mapping without trusting backend integrity.
- Community proves payment and membership logic without trusting platform operators.
- Anchor proves historical message integrity with tamper evidence, not plaintext storage on-chain.
