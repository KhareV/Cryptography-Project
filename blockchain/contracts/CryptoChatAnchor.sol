// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title CryptoChatAnchor
/// @notice Tamper-evidence layer for message histories via Merkle root anchoring.
/// @dev Backend may store full messages off-chain, but root commitments are immutable on-chain.
///      Any silent deletion/modification breaks Merkle verification against recorded anchors.
contract CryptoChatAnchor is Ownable, AccessControl {
    /// @notice One immutable anchor checkpoint for a conversation batch.
    struct AnchorRecord {
        string merkleRoot;
        uint256 timestamp;
        address anchoredBy;
        uint256 messageCount;
        string conversationId;
    }

    mapping(string => AnchorRecord[]) private anchors;
    mapping(address => bool) private authorizedAnchors;

    event Anchored(
        string indexed conversationId,
        string merkleRoot,
        uint256 messageCount,
        address anchoredBy,
        uint256 timestamp
    );
    event AnchorerAdded(address indexed anchorer);
    event AnchorerRemoved(address indexed anchorer);

    constructor() Ownable(msg.sender) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        authorizedAnchors[msg.sender] = true;
        emit AnchorerAdded(msg.sender);
    }

    /// @notice Authorize a backend wallet to submit Merkle anchors.
    /// @dev Restricting anchor writes prevents spam while keeping owner-auditable control.
    /// @param anchorer Wallet address used by the backend anchoring service.
    function addAuthorizedAnchorer(address anchorer) external onlyOwner {
        require(anchorer != address(0), "invalid anchorer");
        if (!authorizedAnchors[anchorer]) {
            authorizedAnchors[anchorer] = true;
            emit AnchorerAdded(anchorer);
        }
    }

    /// @notice Remove anchoring permission from a backend wallet.
    /// @dev Useful for key rotation and incident containment.
    /// @param anchorer Wallet to de-authorize.
    function removeAuthorizedAnchorer(address anchorer) external onlyOwner {
        require(authorizedAnchors[anchorer], "anchorer not authorized");
        authorizedAnchors[anchorer] = false;
        emit AnchorerRemoved(anchorer);
    }

    /// @notice Store a new immutable Merkle root checkpoint for a conversation.
    /// @dev Once anchored, historical commitments cannot be altered, creating verifiable
    ///      evidence if the server later tampers with raw message data.
    /// @param conversationId Conversation identifier used by the app backend.
    /// @param merkleRoot Merkle root for the anchored batch.
    /// @param messageCount Number of messages represented by this root.
    function anchor(
        string calldata conversationId,
        string calldata merkleRoot,
        uint256 messageCount
    ) external {
        require(authorizedAnchors[msg.sender], "not authorized anchorer");
        require(bytes(conversationId).length > 0, "conversationId required");
        require(bytes(merkleRoot).length > 0, "merkleRoot required");

        anchors[conversationId].push(
            AnchorRecord({
                merkleRoot: merkleRoot,
                timestamp: block.timestamp,
                anchoredBy: msg.sender,
                messageCount: messageCount,
                conversationId: conversationId
            })
        );

        emit Anchored(
            conversationId,
            merkleRoot,
            messageCount,
            msg.sender,
            block.timestamp
        );
    }

    /// @notice Return the latest anchor for a conversation.
    /// @dev Clients can compare this checkpoint against newly computed Merkle roots.
    /// @param conversationId Conversation to inspect.
    /// @return merkleRoot Most recent root.
    /// @return timestamp Anchor timestamp.
    /// @return anchoredBy Wallet that submitted the anchor.
    /// @return messageCount Message count represented by the root.
    function getLatestAnchor(
        string calldata conversationId
    )
        external
        view
        returns (
            string memory merkleRoot,
            uint256 timestamp,
            address anchoredBy,
            uint256 messageCount
        )
    {
        uint256 len = anchors[conversationId].length;
        require(len > 0, "no anchors for conversation");

        AnchorRecord storage latest = anchors[conversationId][len - 1];
        return (
            latest.merkleRoot,
            latest.timestamp,
            latest.anchoredBy,
            latest.messageCount
        );
    }

    /// @notice Return full anchor history for a conversation.
    /// @dev Historical roots allow forensic verification across time windows.
    /// @param conversationId Conversation to inspect.
    /// @return history Ordered array of all anchors for this conversation.
    function getAnchorHistory(
        string calldata conversationId
    ) external view returns (AnchorRecord[] memory history) {
        return anchors[conversationId];
    }

    /// @notice Return number of anchors recorded for a conversation.
    /// @dev Handy for pagination, monitoring, and integrity dashboards.
    /// @param conversationId Conversation to inspect.
    /// @return count Number of anchors.
    function getAnchorCount(
        string calldata conversationId
    ) external view returns (uint256 count) {
        return anchors[conversationId].length;
    }

    /// @notice Check whether a wallet can currently submit anchors.
    /// @dev Exposes authorization status for operational transparency.
    /// @param anchorer Wallet to inspect.
    /// @return allowed True when wallet is authorized.
    function isAuthorizedAnchorer(
        address anchorer
    ) external view returns (bool allowed) {
        return authorizedAnchors[anchorer];
    }
}
