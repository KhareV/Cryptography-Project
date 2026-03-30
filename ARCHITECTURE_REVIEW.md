## 2. System Topology and Trust Boundaries

## 2.1 Topology at a Glance

```text
+------------------------+            +--------------------------+
| Frontend (Next.js)     |  HTTPS     | Backend API (Express)    |
| - UI + state           +----------->+ - REST routes            |
| - Web Crypto E2EE      |            | - Auth + validators      |
| - Wallet integration   |            | - DB + blockchain verify |
+-----------+------------+            +------------+-------------+
            |                                      |
            | WebSocket (Socket.io)                | MongoDB (Mongoose)
            v                                      v
+------------------------+            +--------------------------+
| Backend Socket Server  |            | MongoDB                  |
| - Presence/typing      |            | - Users                  |
| - Message/call events  |            | - Conversations          |
| - Group events         |            | - Messages               |
+-----------+------------+            | - Groups, Calls          |
            |                         +--------------------------+
            |
            | JSON-RPC / signed tx
            v
+------------------------+
| Sepolia Contracts      |
| - KeyRegistry          |
| - Community            |
| - Anchor               |
+------------------------+
```

## 2.2 Trust Boundary Model

Primary trust zones:

- Zone A: Browser runtime (user-controlled, untrusted for server integrity, trusted for local key use)
- Zone B: Backend application runtime (trusted service boundary, not trusted to decrypt user plaintext)
- Zone C: MongoDB persistence (trusted for availability, not trusted as immutable source of truth)
- Zone D: Blockchain (trusted for immutable commitments and ownership proofs)
- Zone E: Third-party identity/media systems (Clerk, Cloudinary)

Cryptographic trust decisions:

- Direct 1:1 text confidentiality is browser-end to browser-end via E2EE payloads.
- Backend stores ciphertext and metadata for direct encrypted messages.
- Identity key attestation and message history integrity are anchored on chain.

---

## 3. Runtime Components

## 3.1 Backend Runtime

Entry file: `backend/src/server.js`

Main startup sequence:

1. Validate critical environment variables.
2. Validate Clerk config format (`pk_`, `sk_` checks).
3. Connect MongoDB with pooling and health listeners.
4. Build Express app and middleware chain.
5. Create HTTP server.
6. Initialize Socket.io and attach auth middleware + handlers.
7. Expose health routes and API routes.
8. Register graceful shutdown for SIGINT/SIGTERM.

Background task initialization:

- `backend/src/jobs/anchorJob.js` is imported at startup and schedules a daily anchoring cron job.

## 3.2 Frontend Runtime

Root and providers:

- `frontend/app/layout.jsx`
- `frontend/app/providers.jsx`

Composition:

- ClerkProvider
- WalletProvider
- CallProvider
- ThemeProvider
- Global overlays (network warning, incoming call alert, call bar, call screen, toasts)

Protected app shell:

- `frontend/app/(app)/layout.jsx`
- Syncs authenticated user with backend and initializes socket stack.

## 3.3 Blockchain Runtime

Contracts:

- `blockchain/contracts/CryptoChatKeyRegistry.sol`
- `blockchain/contracts/CryptoChatCommunity.sol`
- `blockchain/contracts/CryptoChatAnchor.sol`

Deployment toolchain:

- Hardhat (`blockchain/hardhat.config.js`)
- Deployment script writes addresses into frontend and backend config JSON.

---

## 4. End-to-End Control Flow

## 4.1 Authentication and Session Binding Flow

```text
User signs in (Clerk)
  -> Frontend gets Clerk token
  -> Frontend sets API auth token
  -> POST /api/auth/sync
  -> Backend middleware resolves Clerk userId
  -> Backend finds or syncs Mongo User
  -> Frontend receives normalized app user profile
```

Socket auth path:

```text
Frontend initSocket(token, userId)
  -> Backend socket middleware extracts token
  -> Clerk session validation
  -> Resolve or create Mongo User
  -> Attach socket.userId + socket.user
  -> Register socket in socketManager maps
```

## 4.2 Direct Message Send (Encrypted) Flow

```text
MessageInput submit
  -> useMessages.sendMessage(...)
  -> optimistic local message added to store
  -> key status checks (sender + recipient)
  -> if sender key missing: key registration bootstrap
  -> encryptDirectMessagePayload(...)
     - generate AES-256-GCM key
     - encrypt plaintext with AES-GCM
     - wrap AES key for sender and recipient using RSA-OAEP
  -> socket emit message:send with ciphertext + e2ee metadata
  -> backend validates direct text requires e2ee-v1 payload
  -> backend stores message + encryption metadata
  -> backend emits message:new to recipient
  -> sender optimistic message replaced by confirmed message
```

## 4.3 Message Receive and Local Decrypt Flow

```text
Socket message:new
  -> useSocket handler stores incoming message in Zustand
  -> conversation preview updated (encrypted preview placeholder)
  -> on conversation render, useMessages hydrate/decrypt
  -> ensureUnlockedPrivateKey (PBKDF2 + AES-GCM envelope decrypt)
  -> choose senderWrappedKey or recipientWrappedKey by current user role
  -> unwrap AES key (RSA-OAEP)
  -> decrypt ciphertext (AES-GCM)
  -> UI renders plaintext
```

## 4.4 Voice Call Signaling Flow

Canonical active implementation path is context provider based (`frontend/context/CallContext.jsx`) with `call:*` event namespace.

```text
Caller initiateCall
  -> socket call:initiate
  -> receiver gets call:incoming
  -> receiver acceptCall -> call:accept
  -> caller gets call:accepted
  -> offer/answer exchange (call:offer / call:answer)
  -> ICE exchange (call:ice-candidate)
  -> call status active
  -> call:end or call:ended path on teardown/drop
```

Backend persistence side effects:

- Call documents are upserted and status progressed through `ringing`, `active`, terminal statuses.
- Presence events `user:in-call` and `user:call-ended` are emitted on transitions.

## 4.5 Group Paid Join Flow

```text
Admin creates on-chain community (frontend contract helper)
  -> tx hash returned
  -> backend verifyCreateCommunityTx(...)
  -> backend creates Group record (onChainRegistered=true)

Member joins on chain with fee
  -> tx hash returned
  -> backend verifyJoinCommunityTx(...)
  -> backend adds member to Group
  -> sockets join group room
  -> group membership events broadcast
```

## 4.6 Merkle Anchor and Verification Flow

```text
Periodic job or manual anchor route
  -> fetch latest message batch
  -> map each message to deterministic hash input
  -> compute SHA-256 hashes
  -> compute Merkle root
  -> submit anchor transaction
  -> persist lastAnchor metadata in DB

Verification request
  -> recompute local root from message batch
  -> read latest on-chain root
  -> compare computed root, chain root, and DB root
  -> return verified true/false + fail reason
```

---

## 5. Data Model and Persistence Contracts

## 5.1 User (`backend/src/models/User.js`)

Core fields:

- Identity: `clerkId`, `email`, `username`, names, avatar, bio
- Presence: `status`, `lastSeen`, `isActive`
- Contacts: array of User references
- Wallet + key snapshot: `walletAddress`, `blockchainTxHash`, `keyFingerprint`, `keyPublicKey`
- Encrypted private key envelope: `encryptedPrivateKey`, salt/iv/iterations/algorithm/kdf

Important behavior:

- Username uniqueness guarded both by schema and pre-save check.
- Static `findByClerkId` and search utility support auth and user discovery.

## 5.2 Conversation (`backend/src/models/Conversation.js`)

Core fields:

- Participants
- Type: `direct` or `group`
- Last message preview
- Per-user unread counts
- User-local soft deletion (`deletedFor`)
- Pin/mute per user
- Last anchor metadata (`txHash`, `merkleRoot`, `anchoredAt`, `messageCount`)

Important behavior:

- Direct conversation uniqueness helper.
- Unread count increment on new message via `updateLastMessage`.
- Validation: direct must have exactly 2 participants.

## 5.3 Message (`backend/src/models/Message.js`)

Scope model:

- Exactly one of `conversationId` or `groupId` must be set.

Content model:

- `content`, `type`, `fileUrl`, file metadata
- Delivery/read arrays
- Reactions, edit history, soft delete flags

Encryption model for direct E2EE:

- `isEncrypted`
- `encryption.format` (`e2ee-v1`)
- Algorithm metadata (`AES-256-GCM`, `RSA-OAEP-SHA-256`)
- IV, wrapped keys for both participants, key fingerprints and IDs

## 5.4 Group (`backend/src/models/Group.js`)

Core fields:

- Name, description, avatar
- `members`, `admins`, `createdBy`
- `joinFeeEth`, `onChainRegistered`, `blockchainTxHash`
- Invite token, activity flag
- Last message and last anchor metadata

## 5.5 Call (`backend/src/models/Call.js`)

Core fields:

- `callId`, type/mode
- initiator/receiver references
- status progression and timing (`startedAt`, `endedAt`, `duration`)

---

## 6. Backend Architecture Deep Dive

## 6.1 Middleware Pipeline (`backend/src/server.js`)

Order is critical:

1. `helmet`
2. `cors` with dynamic origin allowlist
3. `compression`
4. JSON + URL parser
5. static uploads mount
6. request timing logger
7. `/api` rate limiter
8. `clerkMiddleware()`
9. route mounts
10. not-found handler
11. global error handler

Consequence:

- Any route-level logic runs only after rate limiting and Clerk middleware preparation.

## 6.2 Authentication Middleware (`backend/src/middleware/auth.js`)

`requireAuthentication` logic:

- Read Clerk auth context from request.
- Resolve Mongo user by Clerk ID.
- If missing, sync from Clerk and create app user record.
- Reject inactive accounts.
- Attach `req.user`, `req.userId`, `req.clerkUserId`.

## 6.3 Validation and Error Handling

Validation (`backend/src/middleware/validators.js`):

- Centralized express-validator chains.
- ObjectId checks, ETH address/tx hash regex checks, sanitization.
- Socket message validation utility for realtime events.

Error handling (`backend/src/middleware/errorHandler.js`):

- Catches framework/model/upload/parser errors.
- Maps to consistent JSON shape.
- Includes stack trace only in development.

## 6.4 Rate Limiting Facilities (`backend/src/middleware/rateLimiter.js`)

Policies:

- API general limiter with env-tunable window.
- Auth limiter (strict).
- Message limiter (anti-spam).
- Upload limiter.
- Search limiter.
- Socket in-memory connection limiter per IP.

## 6.5 REST Route Matrix

Auth routes (`/api/auth`):

- `POST /sync`
- `GET /me`
- `POST /refresh`
- `DELETE /account`

User routes (`/api/users`):

- search, contacts list/add/remove, profile fetch/update, online list

Conversation routes (`/api/conversations`):

- list, get by id, create, mark read, pin/unpin, soft delete

Message routes (`/api/messages`):

- paged get, send, read ack, edit, delete, reaction mutate
- direct text requires E2EE payload for creation

Group routes (`/api/groups`):

- my groups, discovery, create with on-chain proof, on-chain registration, join via paid proof,
  admin member changes, update, leave, delete, group message get/send

Call routes (`/api/calls`):

- call history retrieval

Key routes (`/api/keys`):

- registration proof verify and key envelope persistence
- own status and other-user status retrieval

Anchor routes (`/api/anchor`):

- read current anchor state for conversation/group
- manual anchor now (rate limited by interval)
- verify computed roots against chain

Upload routes (`/api/upload`):

- avatar upload/delete
- generic file upload
- image processing with Sharp and Cloudinary storage

## 6.6 Socket Runtime and Event Matrix

Socket bootstrap file:

- `backend/src/socket/index.js`

Authentication middleware:

- `backend/src/socket/middleware/socketAuth.js`

Connection lifecycle:

- On connection: `handleUserConnect`
- On disconnect: `handleUserDisconnect` + offline call cleanup

Message events:

- `message:send`
- `message:read`
- `message:delete`
- `message:reaction`

Conversation events:

- `conversation:read`
- `conversation:join`
- `conversation:leave`

Typing events:

- `typing:start`
- `typing:stop`
- `typing:get`

Status events:

- `status:update`
- `status:get`
- `heartbeat`

Call events:

- `call:initiate`
- `call:accept`
- `call:reject`
- `call:offer`
- `call:answer`
- `call:ice-candidate`
- `call:end`

Group events:

- `group:create`
- `group:join`
- `group:leave`
- `group:message:send`

Room strategy:

- `user:{id}`
- `conversation:{id}`
- `group:{id}`

Socket manager maps:

- user -> sockets
- socket -> user
- socket -> socket instance
- active calls and typing indicators
- in-call user set

## 6.7 Background Anchoring Job

File: `backend/src/jobs/anchorJob.js`

Behavior:

- Daily cron at 03:00.
- Lookback window 48h.
- Message batch limit 100.
- Separate conversation and group sweep.
- Writes `lastAnchor` metadata back to DB when successful.
- Skips execution if wallet key or RPC config missing.

---

## 7. Frontend Architecture Deep Dive

## 7.1 App Routing and Gatekeeping

Middleware: `frontend/middleware.js`

- Public routes: landing and auth pages.
- Protected app routes gated through Clerk middleware.

Route groups:

- `(landing)` public marketing area
- `(auth)` sign-in/sign-up
- `(app)` authenticated application area

## 7.2 Provider Chain and Global Runtime Services

Providers composed in `frontend/app/providers.jsx`:

- Clerk auth context
- Wallet context
- Call context
- Theme context
- Global notification and call overlays

## 7.3 Client State Model (Zustand)

File: `frontend/store/useStore.js`

Domains:

- User
- Conversations + active conversation
- Messages by conversation
- Groups + group messages + unread counts
- Typing map by conversation
- Online users and in-call users
- UI panel and modal state
- Settings (persisted)
- Socket connected flag

Persistence:

- Only settings are persisted by partialize strategy.

## 7.4 API Client Layer

File: `frontend/lib/api.js`

Features:

- Central axios instance with timeout and base URL.
- Bearer token injector via interceptor.
- Centralized error normalization.
- Domain-specific endpoint groups: auth, users, conversations, messages, upload, calls, groups, keys, anchor.

## 7.5 Socket Client Layer

File: `frontend/lib/socket.js`

Key behaviors:

- Global singleton socket via window namespace.
- Listener attachment guard flag to avoid duplicates.
- Reconnect policy with capped attempts.
- Promise-based ack helper (`emitWithAck`).
- Exported event method wrappers aligned to backend namespaces.

## 7.6 Realtime Hook Orchestration

File: `frontend/hooks/useSocket.js`

Responsibilities:

- Initialize socket when signed in.
- Attach all event handlers once.
- Update store on incoming events.
- Trigger notifications and sounds for non-active message arrivals.
- Keep presence and group updates synchronized.

## 7.7 Messaging Hook Orchestration

File: `frontend/hooks/useMessages.js`

Key responsibilities:

- Message fetch + pagination + polling every 3s.
- Local optimistic send and reconciliation.
- E2EE send/decrypt pipeline.
- Sender key bootstrap and recipient key verification.
- Typing signal debounce.
- Message read/edit/delete/reaction wrappers.

Key caches/refs:

- Key status caches for sender and recipients.
- Password cache in session storage.
- Unlock promise cache and key bootstrap guard.

## 7.8 Group Hook Orchestration

File: `frontend/hooks/useGroups.js`

Responsibilities:

- My groups fetch, discovery, creation, on-chain registration, join/leave.
- Membership mutation and local state alignment.

## 7.9 Calling Runtime

Primary call runtime:

- `frontend/context/CallContext.jsx`

Responsibilities:

- Own incoming/active call state machine.
- Manage RTCPeerConnection lifecycle.
- Manage local media stream and ICE candidate queue.
- Emit and consume `call:*` events.
- Expose mute/speaker/end actions.

Secondary call hook exists:

- `frontend/hooks/useCalling.js`
- Uses partially different event naming style and can be treated as an alternative or legacy path in reviews.

## 7.10 Wallet Runtime

File: `frontend/context/WalletContext.jsx`

Responsibilities:

- Detect and connect MetaMask.
- Track address, chain, balance, connected status.
- Enforce Sepolia network and provide switch helper.
- Persist basic connected flag for reconnection attempt.

---

## 8. Cryptography and Integrity Algorithms

## 8.1 Key Generation and Private Key Envelope (Client)

File: `frontend/lib/e2ee.js`

Algorithmic sequence:

1. Generate RSA-OAEP key pair (2048-bit, SHA-256).
2. Export public key (SPKI) and private key (PKCS8).
3. Derive AES-256-GCM key from user password using PBKDF2-SHA-256.
4. Random salt (16 bytes) and IV (12 bytes).
5. Encrypt private key with AES-GCM.
6. Compute SHA-256 fingerprint of public key bytes.

Output bundle includes:

- Public key
- Fingerprint
- Encrypted private key
- Salt/IV/iterations/algorithm metadata

## 8.2 Message Encryption Algorithm (Client)

Direct text encryption path uses hybrid encryption:

- Symmetric: AES-256-GCM for message payload
- Asymmetric key exchange: RSA-OAEP for wrapping AES key

Detailed steps:

1. Generate random AES key.
2. Encrypt plaintext with AES-GCM using random IV.
3. Export raw AES key.
4. Encrypt raw AES key twice:
   - once with sender public key
   - once with recipient public key
5. Build e2ee payload with wrapped keys and metadata.

Why dual wrapped keys:

- Recipient can decrypt message.
- Sender can also decrypt their own sent history across sessions/devices.

## 8.3 Message Decryption Algorithm (Client)

1. Unlock private key from encrypted envelope (if not cached).
2. Select correct wrapped key based on current user role in message metadata.
3. RSA decrypt wrapped AES key.
4. Import raw AES key.
5. AES-GCM decrypt ciphertext using IV.
6. Decode plaintext UTF-8.

## 8.4 PBKDF2 Parameters and Security Implications

Parameters currently implemented:

- Hash: SHA-256
- Iterations: default 100000
- Salt: per-user/per-key material

Implications:

- Slows password brute-force relative to raw hash use.
- Security still depends on user password entropy and client compromise risk.

## 8.5 Merkle Hashing and Root Algorithm (Server)

File: `backend/src/utils/merkleTree.js`

Message hash payload fields (normalized):

- message id
- encrypted data representation
- sender id
- timestamp

Tree algorithm:

- Hash each message leaf using SHA-256.
- Build binary levels by concatenating adjacent hashes and hashing again.
- Duplicate last element when level has odd count.
- Continue until one root remains.

Complexity:

- Root construction: O(n)
- Proof verification: O(log n)

## 8.6 Membership Proof Verification

Proof object per step:

- sibling hash
- sibling position (`left` or `right`)

Verification logic:

- Iteratively reconstruct parent hash chain.
- Final reconstructed hash must equal expected root.

## 8.7 On-Chain Transaction Verification Algorithms (Server)

File: `backend/src/utils/blockchainVerify.js`

Pattern for each verification helper:

1. Validate tx hash and wallet address format.
2. Load transaction and receipt from provider.
3. Require receipt status success.
4. Enforce expected contract address in `tx.to`.
5. Enforce expected sender in `tx.from`.
6. ABI-parse transaction calldata.
7. Enforce expected function name.
8. Compare parsed args with backend request payload.

This is a critical anti-spoof mechanism for key registration and paid group actions.

---

## 9. Smart Contract Architecture

## 9.1 CryptoChatKeyRegistry

File: `blockchain/contracts/CryptoChatKeyRegistry.sol`

Purpose:

- Immutable userId -> public key fingerprint registry

State model:

- `keys[userId] -> KeyRecord`
- `keyOwners[userId] -> wallet`
- wallet to userId index arrays/maps

Core controls:

- First registration claims ownership.
- Future updates require same owner wallet.
- Revocation supported.
- Pausable write path for incident response.

Key guarantees:

- Backend cannot silently rotate key ownership to different wallet.

## 9.2 CryptoChatCommunity

File: `blockchain/contracts/CryptoChatCommunity.sol`

Purpose:

- Paid community membership and fee escrow

State model:

- `communities[groupId] -> Community`
- `memberships[groupId][wallet] -> Membership`
- wallet community index

Core controls and protections:

- Create community once per group ID.
- Join requires fee threshold.
- Excess ETH refunded.
- `withdrawFees` admin-only + nonReentrant.
- `updateFee` admin-only.
- `removeMember` admin-only.
- `transferAdmin` restricted to active member target.
- Contract pausable by owner for emergencies.

## 9.3 CryptoChatAnchor

File: `blockchain/contracts/CryptoChatAnchor.sol`

Purpose:

- Immutable root commitments for message batches

State model:

- `anchors[conversationId] -> AnchorRecord[]`
- authorized anchor submitter map

Core controls:

- Only authorized anchorers can write root records.
- Owner can add/remove authorized anchorers.

Audit benefit:

- Any message tampering becomes detectable when recomputed roots diverge from chain roots.

## 9.4 Deployment and Verification Pipeline

Deploy script (`blockchain/scripts/deploy.js`):

1. Deploy KeyRegistry
2. Deploy Community
3. Deploy Anchor
4. Authorize backend anchor wallet
5. Write contract addresses JSON to frontend and backend paths

Verify script (`blockchain/scripts/verify.js`):

- Runs Hardhat verify for all three contract artifacts.
- Handles already-verified condition gracefully.

Hardhat config (`blockchain/hardhat.config.js`):

- Solidity 0.8.20
- Optimizer enabled (runs 200)
- Networks: hardhat + sepolia

---

## 10. Test Coverage and Proven Invariants

## 10.1 Anchor Contract Tests

File: `blockchain/test/Anchor.test.js`

Validated invariants:

- Unauthorized anchoring reverts.
- Authorized anchorers can submit.
- Latest anchor retrieval returns newest root.
- History preserves insertion order.
- Multiple anchors per scope supported.
- Removed anchorer loses write privilege.

## 10.2 Community Contract Tests

File: `blockchain/test/Community.test.js`

Validated invariants:

- Community creation populates expected state.
- Free and paid joins function as expected.
- Insufficient fee rejects.
- Double join rejects.
- Excess payment refund works.
- Withdraw path transfers and resets pending value.
- Non-admin cannot withdraw/update admin-only actions.
- Admin transfer grants effective admin control.

## 10.3 KeyRegistry Contract Tests

File: `blockchain/test/KeyRegistry.test.js`

Validated invariants:

- Register/read correctness.
- Same wallet can update same user ID.
- Different wallet cannot hijack mapping.
- Owner revoke transitions registration status.
- Non-owner revoke rejected.
- Wallet listing index works.
- Pause/unpause gates writes.

---

## 11. Operational Facilities and Non-Functional Behavior

## 11.1 Resilience and Lifecycle

Backend:

- Graceful shutdown closes HTTP, Socket.io, and Mongo connection.
- DB connection events logged.
- Global handlers for uncaught exception and unhandled rejection.

Socket:

- Ping interval/timeout configured server-side.
- Client has reconnect strategy and capped attempts.
- Global singleton prevents accidental socket duplication.

Frontend:

- Optimistic UI for message send reduces perceived latency.
- Polling fallback in `useMessages` adds eventual consistency.

## 11.2 Security Facilities

- Helmet hardening and CORS origin control.
- Request validation and sanitization.
- Multi-tier rate limiting.
- Clerk auth middleware for HTTP and socket.
- Enforced E2EE requirement for direct text at backend route and socket layers.
- Transaction verification against chain before state transitions.

## 11.3 Data Integrity Facilities

- Message-level immutable root commitments via Anchor contract.
- DB local `lastAnchor` snapshot for quick API responses.
- Verification endpoint returns explicit mismatch reason classes.

## 11.4 Media Facilities

- Upload rate-limited.
- In-memory multer + Sharp processing for avatar and image optimization.
- Cloudinary storage and old avatar cleanup.

## 11.5 Observability

Logging:

- Request timing logs
- Socket stats periodic logging
- Error context logging includes path/method/body/query/user where available

Health:

- `/health` and `/api/health` endpoints

---

## 12. Configuration Surface (Redacted-Friendly)

Core backend env variables:

- `MONGODB_URI`
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `FRONTEND_URL`
- `PORT`
- `NODE_ENV`
- `RATE_LIMIT_WINDOW`
- `MAX_FILE_SIZE`
- `ALLOWED_FILE_TYPES`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `SEPOLIA_RPC_URL` or `BLOCKCHAIN_RPC_URL`
- `BACKEND_WALLET_PRIVATE_KEY`
- `BACKEND_WALLET_ADDRESS`

Blockchain config references:

- Key registry address: `<MASKED_KEY_REGISTRY_ADDRESS>`
- Community address: `<MASKED_COMMUNITY_ADDRESS>`
- Anchor address: `<MASKED_ANCHOR_ADDRESS>`

Frontend env references:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_BLOCKCHAIN_RPC_URL`

---

## 13. Detailed Reviewer Walkthrough Checklist

Use this checklist in order for a strict review:

1. Confirm auth chain:

- Sign in via Clerk
- `POST /api/auth/sync`
- Socket connect and authenticated event

2. Confirm user and contact lifecycle:

- Search users
- Add/remove contacts
- Online status transitions on connect/disconnect

3. Confirm direct message E2EE enforcement:

- Attempt direct text without E2EE payload and confirm rejection
- Send encrypted direct message with valid payload and confirm acceptance

4. Confirm key lifecycle:

- First-time key registration on chain and backend persistence
- Key status retrieval for self and recipient
- Verify local key storage payload only present on self endpoint

5. Confirm decryption path:

- Wrong password yields decrypt failure placeholder
- Correct password restores plaintext rendering

6. Confirm call signaling and cleanup:

- Initiate/accept call
- Verify offer/answer/ICE relay
- Verify end/reject/offline drop flows update call records and presence events

7. Confirm group paid workflow:

- Create community on chain
- Backend verifies create transaction
- Join with paid tx and backend verify
- Member appears in group and receives room updates

8. Confirm anchoring workflow:

- Trigger manual anchor now
- Verify DB `lastAnchor` update
- Verify on-chain latest anchor retrieval
- Verify recompute check endpoint for match

9. Confirm uploads:

- Avatar upload transforms and stores URL
- File upload enforces limits and allowed types

10. Confirm non-functional controls:

- Rate limit behavior
- Health endpoints
- Graceful shutdown behavior

---

## 14. Known Design Notes for Review Discussion

1. There are two frontend call orchestration surfaces (`CallContext` and `useCalling`) with partially different event naming styles; this is review-worthy for consolidation and long-term maintainability.

2. Message polling runs every 3 seconds in addition to realtime events; this is useful for eventual consistency but can be reviewed for tuning under high scale.

3. Key unlock and password caching are session-scoped in browser storage; this balances usability and security but should be reviewed against threat model requirements.

4. Contract authorization for anchoring is owner-managed. Key rotation/incident runbooks should be documented operationally.

---

## 15. Appendix A - Route-to-File Index

Backend key route files:

- `backend/src/routes/auth.js`
- `backend/src/routes/users.js`
- `backend/src/routes/conversations.js`
- `backend/src/routes/messages.js`
- `backend/src/routes/groups.js`
- `backend/src/routes/calls.js`
- `backend/src/routes/keys.js`
- `backend/src/routes/anchor.js`
- `backend/src/routes/upload.js`

Socket handler files:

- `backend/src/socket/handlers/messageHandlers.js`
- `backend/src/socket/handlers/typingHandlers.js`
- `backend/src/socket/handlers/statusHandlers.js`
- `backend/src/socket/handlers/callHandlers.js`
- `backend/src/socket/handlers/groupHandlers.js`

Core frontend orchestration files:

- `frontend/app/(app)/layout.jsx`
- `frontend/hooks/useSocket.js`
- `frontend/hooks/useMessages.js`
- `frontend/context/CallContext.jsx`
- `frontend/context/WalletContext.jsx`
- `frontend/lib/e2ee.js`
- `frontend/lib/socket.js`
- `frontend/lib/api.js`
- `frontend/lib/keyRegistry.js`
- `frontend/lib/communityContract.js`
- `frontend/lib/anchorContract.js`

Blockchain core files:

- `blockchain/contracts/CryptoChatKeyRegistry.sol`
- `blockchain/contracts/CryptoChatCommunity.sol`
- `blockchain/contracts/CryptoChatAnchor.sol`
- `blockchain/scripts/deploy.js`
- `blockchain/scripts/verify.js`
- `blockchain/test/KeyRegistry.test.js`
- `blockchain/test/Community.test.js`
- `blockchain/test/Anchor.test.js`

---

## 16. Appendix B - Glossary

- E2EE: End-to-end encryption
- KDF: Key derivation function
- PBKDF2: Password-based key derivation function 2
- AES-GCM: Symmetric authenticated encryption mode
- RSA-OAEP: Asymmetric encryption padding scheme used for key wrapping
- Merkle root: Single hash commitment representing an entire message set
- Wrapped key: Symmetric key encrypted with recipient public key
- Anchor: On-chain commitment entry storing Merkle root and metadata
- Tx verification: Backend-side verification that a user-submitted tx really matches requested action

---

## 17. Final Review Statement

The application architecture combines:

- Real-time messaging and calling
- Browser-side E2EE for direct text
- On-chain key ownership and paid community controls
- On-chain message integrity anchoring through Merkle commitments

The design intentionally separates confidentiality (E2EE) from integrity/auditability (blockchain anchoring), while keeping operational concerns (rate limit, logging, validation, lifecycle) in the backend service boundary.

This document can be used directly as the primary technical brief for deep architecture review sessions.
