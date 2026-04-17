# ChatFlow

ChatFlow is a full-stack, real-time messaging system designed for strong confidentiality, zero-knowledge relay behavior, and tamper-evident integrity.

Direct messages are encrypted on the client using per-message AES-256-GCM keys. Each message key is wrapped with RSA-OAEP for both sender and recipient, so both parties can decrypt independently while the server stores and relays only ciphertext.

It combines:

- End-to-end encrypted messaging (AES-256-GCM with RSA-OAEP key wrapping)
- Zero-knowledge relay behavior on the server
- WebRTC peer-to-peer audio calling
- Optional Ethereum Sepolia anchoring for message integrity proofs

## At a Glance

| Metric                           | Value                                         |
| -------------------------------- | --------------------------------------------- |
| End-to-end message latency       | 1.62 ms                                       |
| Per-message crypto overhead      | 0.37 ms                                       |
| AES-256-GCM encrypt/decrypt      | 0.19 ms / 0.18 ms                             |
| PBKDF2 derivation (login-time)   | 28.41 ms                                      |
| Stable concurrent sockets tested | 1,000                                         |
| Server storage model             | Ciphertext-only for encrypted direct messages |

## Why This Project

Most chat systems still rely on server trust for confidentiality and integrity controls. ChatFlow minimizes this trust assumption by keeping encryption client-side and making the backend an authenticated ciphertext relay.

For high-assurance workflows, digest anchoring on Ethereum Sepolia provides tamper-evident integrity checks without exposing message content.

## Project Description

ChatFlow follows a browser-native cryptography model using the Web Crypto API (`window.crypto.subtle`) and avoids server-side plaintext handling for encrypted direct messages.

The system extends standard E2EE chat with:

- strict encrypted-payload validation at socket ingress
- ciphertext-only message persistence in MongoDB
- optional Ethereum Sepolia anchoring for integrity verification
- optional on-chain key-fingerprint and community management contracts

In practical terms, the backend validates encrypted envelope structure, stores encrypted payloads, and forwards them in real time without requiring plaintext access.

## Core Features

- Per-message encryption using fresh AES-256-GCM keys
- RSA-OAEP wrapping for sender and recipient key recovery
- Encrypted payload format enforcement at socket ingress
- Ciphertext-only persistence model in MongoDB
- Authenticated real-time delivery via Socket.io
- WebRTC audio calling with socket signaling
- Ethereum Sepolia integration for key fingerprints, community rules, and integrity anchoring

## What Makes ChatFlow Different

1. Dual RSA-OAEP wrapping lets both sender and recipient recover per-message keys independently.
2. Strict encrypted-format enforcement helps prevent plaintext leakage at relay boundaries.
3. Optional blockchain anchoring enables tamper-evident integrity trails without publishing plaintext.
4. Browser-native crypto avoids dependency on native binaries.

## How Encrypted Messaging Works

1. Sender generates a fresh per-message AES-256-GCM key and 96-bit IV.
2. Plaintext is encrypted locally on the client.
3. The AES key is wrapped with sender and recipient RSA public keys (RSA-OAEP-SHA-256).
4. Client emits encrypted payload through Socket.io.
5. Server validates encrypted format and rejects plaintext-style direct payloads.
6. Server stores encrypted payload object and relays it to recipient room.
7. Recipient unwraps the message key using local private key.
8. Recipient decrypts message locally using AES-256-GCM.

## Threat Model Coverage

| Threat                           | Typical Risk                                            | ChatFlow Mitigation                                      |
| -------------------------------- | ------------------------------------------------------- | -------------------------------------------------------- |
| Relay-level MITM                 | Relay can read or alter plaintext traffic               | Relay handles ciphertext and wrapped keys only           |
| Unauthorized policy manipulation | Central server can silently change authority/membership | Optional on-chain community state is auditable           |
| Message history tampering        | Historical records can be altered post-facto            | Optional digest anchoring enables integrity verification |

## Monorepo Layout

```text
backend/     Node.js + Express + Socket.io API and relay server
frontend/    Next.js 14 application (chat UI, wallet integration)
blockchain/  Hardhat project (KeyRegistry, Community, Anchor contracts)
```

## High-Level Architecture

- Client layer: Next.js 14, Web Crypto API, ethers.js
- Server layer: Node.js, Express, Socket.io
- Database layer: MongoDB Atlas (Mongoose)
- Auth layer: Clerk (JWT/session)
- Blockchain layer: Ethereum Sepolia contracts

## Blockchain Components (Optional)

| Contract    | Purpose                                                     |
| ----------- | ----------------------------------------------------------- |
| KeyRegistry | Stores key fingerprints for tamper-evident verification     |
| Community   | Handles group/community membership rules                    |
| Anchor      | Stores conversation/group digest roots for integrity proofs |

## Security Model Summary

- Server does not need plaintext to relay messages.
- Encrypted direct-message envelope is validated before persistence/relay.
- Message integrity uses AES-GCM authentication tags.
- Optional on-chain anchoring provides tamper evidence for history checks.
- Key fingerprints can be recorded on-chain for verification workflows.

Example encrypted envelope fields:

- `isEncrypted`
- `encryption.format` (`e2ee-v1`)
- `encryption.algorithm` (`AES-256-GCM`)
- `encryption.keyExchange` (`RSA-OAEP-SHA-256`)
- `encryption.iv`
- `encryption.senderWrappedKey`
- `encryption.recipientWrappedKey`

## Prerequisites

- Node.js 18+
- npm 9+
- MongoDB connection string (Atlas or self-hosted)
- Clerk project credentials
- Sepolia RPC endpoint (for blockchain/anchoring features)
- Wallet private key for backend anchoring (if anchoring enabled)

## Quick Start

### 1) Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install

cd ../blockchain
npm install
```

### 2) Configure environment files

Create these files locally (do not commit):

- backend/.env
- frontend/.env
- blockchain/.env

Backend required variables:

```bash
MONGODB_URI=
CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

Backend common optional variables:

```bash
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
RATE_LIMIT_WINDOW=15
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/webp
LOG_LEVEL=info
MESSAGE_ENCRYPTION_KEY=
MESSAGE_ENCRYPTION_KEY_VERSION=v1
SEPOLIA_RPC_URL=
BLOCKCHAIN_RPC_URL=
BACKEND_WALLET_PRIVATE_KEY=
```

Frontend variables:

```bash
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_BLOCKCHAIN_RPC_URL=
```

Blockchain variables:

```bash
SEPOLIA_RPC_URL=
DEPLOYER_PRIVATE_KEY=
BACKEND_WALLET_ADDRESS=
ETHERSCAN_API_KEY=
```

### 3) Compile and deploy contracts (optional but required for blockchain features)

```bash
cd blockchain
npm run compile
npm run test
npm run deploy:sepolia
```

Deployment writes addresses to:

- frontend/lib/contractAddresses.json
- backend/src/config/contractAddresses.json

### 4) Run backend

```bash
cd backend
npm run dev
```

### 5) Run frontend

```bash
cd frontend
npm run dev
```

Open http://localhost:3000

## Useful Commands

Backend:

```bash
npm run dev
npm run lint
npm run test
```

Frontend:

```bash
npm run dev
npm run build
npm run lint
```

Blockchain:

```bash
npm run compile
npm run test
npm run deploy:sepolia
npm run verify:sepolia
```

## Performance and Validation Metrics

Benchmark context:

- Runtime: Node.js 20 LTS
- Database: MongoDB Atlas M0
- Browser benchmark environment: Chrome 124 (`performance.now()`)
- Crypto sampling: 1,000 iterations per operation
- Socket load: Artillery ramp from 10 to 1,000 virtual users

### Performance Metrics

| Metric                            | ChatFlow | Baseline | Notes                           |
| --------------------------------- | -------: | -------: | ------------------------------- |
| End-to-end message latency        |  1.62 ms |  0.34 ms | Low overhead for encrypted path |
| AES-256-GCM encryption            |  0.19 ms |      N/A | Sub-millisecond encryption cost |
| AES-256-GCM decryption            |  0.18 ms |      N/A | Sub-millisecond decryption cost |
| Total per-message crypto overhead |  0.37 ms |      N/A | Encrypt + decrypt               |
| PBKDF2 key derivation             | 28.41 ms |      N/A | Login-time cost only            |
| Max concurrent sockets            |    1,000 |    1,000 | Stable at tested concurrency    |
| Indexed DB query latency          |  2.71 ms |  2.71 ms | No observed DB penalty          |

Derived latency split:

- Cryptographic share of end-to-end latency: approximately 23%
- Network/runtime share of end-to-end latency: approximately 77%

Interpretation:

- The encrypted path adds overhead but remains low-latency for real-time chat UX.
- Per-message cryptographic operations remain sub-millisecond.
- The dominant latency component is transport/runtime, not cryptographic compute.

### Security Verification Metrics

| Verification                   | Method                       | Result                                                          |
| ------------------------------ | ---------------------------- | --------------------------------------------------------------- |
| Zero-knowledge storage check   | MongoDB document inspection  | Encrypted payload artifacts stored, no direct plaintext content |
| Encrypted envelope enforcement | Network payload inspection   | Encrypted metadata structure present in direct-message flow     |
| AES-GCM tamper detection       | Bit-flip ciphertext test     | Decryption fails with authentication error                      |
| Abuse resistance behavior      | Auth endpoint threshold test | HTTP 429 returned with retry behavior                           |

## Current Limitations

- TURN server is not documented as part of the default setup, so some NAT combinations may impact WebRTC call establishment.
- RSA-OAEP wrapping is strong for key transport but does not provide full ratcheting-style forward secrecy.
- On-chain anchoring is optional and incurs gas cost.

## Production Hardening Checklist

- Keep all env files local and rotated if exposed.
- Enforce HTTPS end-to-end.
- Restrict allowed origins in FRONTEND_URL.
- Enable centralized logging and alerting.
- Monitor dependency vulnerabilities and patch regularly.
- Add TURN infrastructure for broader WebRTC compatibility.

## References

- W3C Web Crypto API
- NIST SP 800-38D (GCM)
- NIST SP 800-132 (PBKDF2)
- RFC 6455 (WebSocket)

## License

Backend package declares MIT. Confirm repository-level licensing before external distribution.
