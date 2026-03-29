// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title CryptoChatCommunity
/// @notice Trustless membership and fee escrow for paid chat communities.
/// @dev Join fees are handled by immutable contract logic. No centralized payment processor,
///      no chargeback authority, and no platform-controlled custody that can be abused.
contract CryptoChatCommunity is Ownable, ReentrancyGuard, Pausable {
    /// @notice Canonical on-chain metadata for one Mongo-backed group.
    /// @dev `pendingWithdrawal` is the amount currently withdrawable by admin.
    struct Community {
        string mongoGroupId;
        address admin;
        uint256 joinFeeWei;
        uint256 memberCount;
        uint256 totalFeesCollected;
        uint256 pendingWithdrawal;
        bool exists;
        uint256 createdAt;
    }

    /// @notice Per-wallet membership proof.
    /// @dev `paidAmountWei` is the fee amount attributed to this wallet at join time.
    struct Membership {
        bool isMember;
        uint256 joinedAt;
        uint256 paidAmountWei;
    }

    mapping(string => Community) private communities;
    mapping(string => mapping(address => Membership)) private memberships;
    mapping(address => string[]) private walletCommunities;
    mapping(address => mapping(string => bool)) private walletHasCommunity;

    event CommunityCreated(
        string indexed mongoGroupId,
        address indexed admin,
        uint256 joinFeeWei,
        uint256 timestamp
    );
    event MemberJoined(
        string indexed mongoGroupId,
        address indexed wallet,
        uint256 paidAmountWei,
        uint256 timestamp
    );
    event MemberRemoved(string indexed mongoGroupId, address indexed wallet);
    event FeesWithdrawn(
        string indexed mongoGroupId,
        address indexed admin,
        uint256 amount,
        uint256 timestamp
    );
    event FeeUpdated(
        string indexed mongoGroupId,
        uint256 oldFee,
        uint256 newFee
    );
    event AdminTransferred(
        string indexed mongoGroupId,
        address indexed oldAdmin,
        address indexed newAdmin
    );

    constructor() Ownable(msg.sender) {}

    /// @notice Emergency pause for mutation functions.
    /// @dev Allows incident containment without losing on-chain audit data.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resume normal community operations.
    /// @dev Re-enables community create/join/admin updates after an incident.
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Create a new on-chain community record linked to Mongo group id.
    /// @dev Makes fee policy and admin ownership publicly auditable and tamper-resistant.
    ///      Creator is auto-added as a member at zero cost.
    /// @param mongoGroupId Group id from backend database.
    /// @param joinFeeWei Fee in wei required for new members.
    function createCommunity(
        string calldata mongoGroupId,
        uint256 joinFeeWei
    ) external whenNotPaused {
        require(bytes(mongoGroupId).length > 0, "group id required");
        require(!communities[mongoGroupId].exists, "community already exists");

        communities[mongoGroupId] = Community({
            mongoGroupId: mongoGroupId,
            admin: msg.sender,
            joinFeeWei: joinFeeWei,
            memberCount: 1,
            totalFeesCollected: 0,
            pendingWithdrawal: 0,
            exists: true,
            createdAt: block.timestamp
        });

        memberships[mongoGroupId][msg.sender] = Membership({
            isMember: true,
            joinedAt: block.timestamp,
            paidAmountWei: 0
        });

        if (!walletHasCommunity[msg.sender][mongoGroupId]) {
            walletCommunities[msg.sender].push(mongoGroupId);
            walletHasCommunity[msg.sender][mongoGroupId] = true;
        }

        emit CommunityCreated(
            mongoGroupId,
            msg.sender,
            joinFeeWei,
            block.timestamp
        );
    }

    /// @notice Join an existing community with optional fee payment.
    /// @dev Fee settlement is enforced by the EVM. The backend cannot fake payment success,
    ///      and excess ETH is automatically refunded.
    /// @param mongoGroupId Group id to join.
    function joinCommunity(
        string calldata mongoGroupId
    ) external payable whenNotPaused nonReentrant {
        Community storage community = communities[mongoGroupId];
        require(community.exists, "community not found");
        require(
            !memberships[mongoGroupId][msg.sender].isMember,
            "already joined"
        );

        uint256 fee = community.joinFeeWei;
        require(msg.value >= fee, "insufficient join fee");

        memberships[mongoGroupId][msg.sender] = Membership({
            isMember: true,
            joinedAt: block.timestamp,
            paidAmountWei: fee
        });

        community.memberCount += 1;
        community.totalFeesCollected += fee;
        community.pendingWithdrawal += fee;

        if (!walletHasCommunity[msg.sender][mongoGroupId]) {
            walletCommunities[msg.sender].push(mongoGroupId);
            walletHasCommunity[msg.sender][mongoGroupId] = true;
        }

        uint256 excess = msg.value - fee;
        if (excess > 0) {
            (bool refunded, ) = payable(msg.sender).call{value: excess}("");
            require(refunded, "refund failed");
        }

        emit MemberJoined(mongoGroupId, msg.sender, fee, block.timestamp);
    }

    /// @notice Withdraw accumulated community fees as the community admin.
    /// @dev Uses checks-effects-interactions and nonReentrant to defend against reentrancy.
    /// @param mongoGroupId Group whose fees should be withdrawn.
    function withdrawFees(
        string calldata mongoGroupId
    ) external nonReentrant {
        Community storage community = communities[mongoGroupId];
        require(community.exists, "community not found");
        require(msg.sender == community.admin, "only community admin");

        uint256 amount = community.pendingWithdrawal;
        require(amount > 0, "no fees to withdraw");

        community.pendingWithdrawal = 0;

        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "withdraw transfer failed");

        emit FeesWithdrawn(mongoGroupId, msg.sender, amount, block.timestamp);
    }

    /// @notice Update the fee applied to future joins.
    /// @dev Existing members keep their current status and historical paid amounts.
    /// @param mongoGroupId Target community id.
    /// @param newFeeWei New join fee in wei.
    function updateFee(
        string calldata mongoGroupId,
        uint256 newFeeWei
    ) external whenNotPaused {
        Community storage community = communities[mongoGroupId];
        require(community.exists, "community not found");
        require(msg.sender == community.admin, "only community admin");

        uint256 oldFee = community.joinFeeWei;
        community.joinFeeWei = newFeeWei;

        emit FeeUpdated(mongoGroupId, oldFee, newFeeWei);
    }

    /// @notice Remove a member as community admin.
    /// @dev No refund is issued by design: membership moderation is independent from fee policy.
    ///      This must be clear to users before joining.
    /// @param mongoGroupId Target community id.
    /// @param member Wallet to remove.
    function removeMember(
        string calldata mongoGroupId,
        address member
    ) external whenNotPaused {
        Community storage community = communities[mongoGroupId];
        require(community.exists, "community not found");
        require(msg.sender == community.admin, "only community admin");
        require(member != community.admin, "cannot remove admin");

        Membership storage membership = memberships[mongoGroupId][member];
        require(membership.isMember, "member not active");

        membership.isMember = false;
        if (community.memberCount > 0) {
            community.memberCount -= 1;
        }

        emit MemberRemoved(mongoGroupId, member);
    }

    /// @notice Transfer community admin rights to another existing member.
    /// @dev Prevents orphaned communities and keeps governance in-member.
    /// @param mongoGroupId Target community id.
    /// @param newAdmin Member wallet that should receive admin rights.
    function transferAdmin(
        string calldata mongoGroupId,
        address newAdmin
    ) external {
        Community storage community = communities[mongoGroupId];
        require(community.exists, "community not found");
        require(msg.sender == community.admin, "only community admin");
        require(newAdmin != address(0), "invalid admin");
        require(
            memberships[mongoGroupId][newAdmin].isMember,
            "new admin must be member"
        );

        address oldAdmin = community.admin;
        community.admin = newAdmin;

        emit AdminTransferred(mongoGroupId, oldAdmin, newAdmin);
    }

    /// @notice Verify on-chain membership status for a wallet.
    /// @dev This proof can be checked by any client without trusting backend responses.
    /// @param mongoGroupId Target community id.
    /// @param wallet Wallet to inspect.
    /// @return memberStatus True if wallet currently has active membership.
    function isMember(
        string calldata mongoGroupId,
        address wallet
    ) external view returns (bool memberStatus) {
        return memberships[mongoGroupId][wallet].isMember;
    }

    /// @notice Read publicly auditable community financial/admin state.
    /// @dev Enables users to verify fee model and escrow balances independently.
    /// @param mongoGroupId Target community id.
    /// @return joinFeeWei Current join fee in wei.
    /// @return memberCount Active member count.
    /// @return admin Current admin wallet.
    /// @return pendingWithdrawal Withdrawable amount for admin.
    /// @return totalFeesCollected Lifetime fee total collected by this community.
    function getCommunity(
        string calldata mongoGroupId
    )
        external
        view
        returns (
            uint256 joinFeeWei,
            uint256 memberCount,
            address admin,
            uint256 pendingWithdrawal,
            uint256 totalFeesCollected
        )
    {
        Community storage community = communities[mongoGroupId];
        return (
            community.joinFeeWei,
            community.memberCount,
            community.admin,
            community.pendingWithdrawal,
            community.totalFeesCollected
        );
    }

    /// @notice Read wallet-level membership proof details for a specific community.
    /// @dev Allows clients to prove join time and fee contribution from immutable state.
    /// @param mongoGroupId Target community id.
    /// @param wallet Wallet to inspect.
    /// @return memberStatus Active membership status.
    /// @return joinedAt Unix timestamp when the wallet joined.
    /// @return paidAmountWei Fee amount attributed to this wallet at join.
    function getMembership(
        string calldata mongoGroupId,
        address wallet
    )
        external
        view
        returns (bool memberStatus, uint256 joinedAt, uint256 paidAmountWei)
    {
        Membership storage membership = memberships[mongoGroupId][wallet];
        return (
            membership.isMember,
            membership.joinedAt,
            membership.paidAmountWei
        );
    }

    /// @notice List all communities this wallet has ever joined/created.
    /// @dev Acts as an immutable on-chain index for user community participation.
    /// @param wallet Wallet to inspect.
    /// @return joinedCommunities Array of Mongo group ids seen for this wallet.
    function getWalletCommunities(
        address wallet
    ) external view returns (string[] memory joinedCommunities) {
        return walletCommunities[wallet];
    }
}
