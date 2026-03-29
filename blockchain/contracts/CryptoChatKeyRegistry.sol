// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title CryptoChatKeyRegistry
/// @notice Immutable public key registry for CryptoChat identities.
/// @dev The server can suggest keys, but the chain is the source of truth for key fingerprints.
///      This prevents silent server-side key substitution (MITM) because anyone can verify the
///      userId -> fingerprint mapping directly from a tamper-resistant ledger.
contract CryptoChatKeyRegistry is Ownable, Pausable {
    /// @notice A wallet-attested key record for a CryptoChat userId.
    /// @dev `publicKey` is expected to be a base64 export from the client, and `fingerprint`
    ///      should be a SHA-256 digest derived by the client.
    struct KeyRecord {
        string publicKey;
        string fingerprint;
        uint256 registeredAt;
        uint256 updatedAt;
        bool revoked;
        address registeredBy;
    }

    mapping(string => KeyRecord) private keys;
    mapping(string => address) private keyOwners;
    mapping(address => string[]) private walletKeys;
    mapping(address => mapping(string => bool)) private walletHasUserId;

    event KeyRegistered(
        string indexed userId,
        string fingerprint,
        address indexed wallet,
        uint256 timestamp
    );
    event KeyRevoked(
        string indexed userId,
        address indexed wallet,
        uint256 timestamp
    );

    constructor() Ownable(msg.sender) {}

    /// @notice Emergency pause for key writes.
    /// @dev Use this only for incident response. Read methods stay available.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resume key writes after incident handling.
    /// @dev Restores normal registration/update flow.
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Register or update an on-chain public key binding for a userId.
    /// @dev First registration claims ownership of a userId to the caller wallet.
    ///      Subsequent updates are restricted to that original wallet owner, so a compromised
    ///      backend cannot replace someone else's key mapping.
    /// @param userId App-level identity id (e.g., Mongo user id).
    /// @param publicKey Base64-encoded public key.
    /// @param fingerprint SHA-256 fingerprint for quick integrity checks.
    function registerKey(
        string calldata userId,
        string calldata publicKey,
        string calldata fingerprint
    ) external whenNotPaused {
        require(bytes(userId).length > 0, "userId required");
        require(bytes(publicKey).length > 0, "publicKey required");
        require(bytes(fingerprint).length > 0, "fingerprint required");

        KeyRecord storage existing = keys[userId];

        if (existing.registeredAt != 0) {
            require(
                msg.sender == keyOwners[userId],
                "only key owner can update"
            );
        } else {
            keyOwners[userId] = msg.sender;
        }

        uint256 firstRegistrationAt = existing.registeredAt == 0
            ? block.timestamp
            : existing.registeredAt;

        keys[userId] = KeyRecord({
            publicKey: publicKey,
            fingerprint: fingerprint,
            registeredAt: firstRegistrationAt,
            updatedAt: block.timestamp,
            revoked: false,
            registeredBy: msg.sender
        });

        if (!walletHasUserId[msg.sender][userId]) {
            walletKeys[msg.sender].push(userId);
            walletHasUserId[msg.sender][userId] = true;
        }

        emit KeyRegistered(userId, fingerprint, msg.sender, block.timestamp);
    }

    /// @notice Revoke a key so clients can refuse it without trusting backend state.
    /// @dev Revocation is owner-controlled per userId. This gives explicit, auditable key
    ///      invalidation that cannot be hidden by server-side data edits.
    /// @param userId Identity whose key should no longer be considered valid.
    function revokeKey(string calldata userId) external {
        KeyRecord storage record = keys[userId];
        require(record.registeredAt != 0, "key not found");
        require(msg.sender == keyOwners[userId], "only key owner");

        record.revoked = true;
        record.updatedAt = block.timestamp;

        emit KeyRevoked(userId, msg.sender, block.timestamp);
    }

    /// @notice Read full on-chain key proof data for a userId.
    /// @dev This enables direct client verification and removes backend trust assumptions.
    /// @param userId Identity to query.
    /// @return publicKey Base64 public key.
    /// @return fingerprint Fingerprint committed on-chain.
    /// @return revoked Revocation status.
    /// @return registeredAt Original registration time.
    /// @return registeredBy Wallet that controls this identity mapping.
    function getKey(
        string calldata userId
    )
        external
        view
        returns (
            string memory publicKey,
            string memory fingerprint,
            bool revoked,
            uint256 registeredAt,
            address registeredBy
        )
    {
        KeyRecord storage record = keys[userId];
        return (
            record.publicKey,
            record.fingerprint,
            record.revoked,
            record.registeredAt,
            record.registeredBy
        );
    }

    /// @notice List all CryptoChat userIds this wallet has registered.
    /// @dev Useful for wallet-level key management dashboards and audits.
    /// @param wallet Wallet to inspect.
    /// @return userIds Array of claimed userIds.
    function getKeysByWallet(
        address wallet
    ) external view returns (string[] memory userIds) {
        return walletKeys[wallet];
    }

    /// @notice Check whether a userId currently has an active key.
    /// @dev A key is active only when it exists and is not revoked.
    /// @param userId Identity to verify.
    /// @return registered True when the record exists and is not revoked.
    function isRegistered(
        string calldata userId
    ) external view returns (bool registered) {
        KeyRecord storage record = keys[userId];
        return record.registeredAt != 0 && !record.revoked;
    }
}
