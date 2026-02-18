// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title FeeController
 * @dev DEPRECATED: Fees are now accumulated directly in TowerRouter
 * This contract is kept for reference and may be used in the future for:
 * - Referral programs
 * - Complex fee splitting strategies
 * - Treasury management
 * 
 * To re-enable, uncomment the code below and deploy separately.
 */

/*
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FeeController is Ownable {
    using SafeERC20 for IERC20;

    address public treasury;
    mapping(address => uint256) public referralRewards;
    mapping(address => bool) public whitelisted;

    uint256 public constant BASIS_POINTS = 10000;
    uint256 public referralPercentage = 2000; // 20% of fees go to referrer

    event FeeDistributed(
        address indexed token,
        uint256 platformFee,
        uint256 referralFee,
        address indexed referrer
    );
    event ReferralRewardClaimed(address indexed referrer, address indexed token, uint256 amount);
    event TreasuryUpdated(address indexed newTreasury);
    event ReferralPercentageUpdated(uint256 newPercentage);
    event WhitelistUpdated(address indexed account, bool status);

    constructor(address _treasury, address _owner) {
        require(_treasury != address(0), "Invalid treasury address");
        treasury = _treasury;
        transferOwnership(_owner);
    }

    /// @dev Distribute fees to treasury and referrer
    function distributeFees(
        address token,
        uint256 feeAmount,
        address referrer
    ) external onlyOwner {
        require(feeAmount > 0, "Invalid fee amount");
        require(token != address(0), "Invalid token");

        uint256 referralFee = 0;

        // Calculate and distribute referral fee
        if (referrer != address(0) && !whitelisted[referrer]) {
            referralFee = (feeAmount * referralPercentage) / BASIS_POINTS;
            referralRewards[referrer] += referralFee;
        }

        // Send remaining fee to treasury
        uint256 treasuryFee = feeAmount - referralFee;
        IERC20(token).safeTransferFrom(msg.sender, treasury, treasuryFee);

        emit FeeDistributed(token, treasuryFee, referralFee, referrer);
    }

    /// @dev Claim referral rewards
    function claimReferralReward(address token) external {
        uint256 reward = referralRewards[msg.sender];
        require(reward > 0, "No rewards to claim");

        referralRewards[msg.sender] = 0;
        IERC20(token).safeTransfer(msg.sender, reward);

        emit ReferralRewardClaimed(msg.sender, token, reward);
    }

    /// @dev Update treasury address
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury address");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    /// @dev Update referral percentage
    function setReferralPercentage(uint256 newPercentage) external onlyOwner {
        require(newPercentage <= BASIS_POINTS, "Percentage exceeds 100%");
        referralPercentage = newPercentage;
        emit ReferralPercentageUpdated(newPercentage);
    }

    /// @dev Whitelist address to exempt from referral fees
    function setWhitelisted(address account, bool status) external onlyOwner {
        whitelisted[account] = status;
        emit WhitelistUpdated(account, status);
    }

    /// @dev Get pending referral reward for address
    function getPendingReward(address referrer) external view returns (uint256) {
        return referralRewards[referrer];
    }
}
*/
