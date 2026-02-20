// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IFeeCollector.sol";

/**
 * @title FeeCollector
 * @dev Collects platform fees from native USDC swaps
 * 
 * When native USDC is used as input token:
 * - User swaps USDC → OutputToken
 * - Platform fee (0.25%) is taken in OutputToken (not USDC)
 * - Backend submits collectFee(outputToken, feeAmount) to this contract
 * - Contract accumulates fees by token
 * - Treasury withdraws accumulated fees
 */
contract FeeCollector is Ownable, ReentrancyGuard, IFeeCollector {
    using SafeERC20 for IERC20;

    address public treasury;
    
    // Track accumulated fees by token address
    mapping(address => uint256) public accumulatedFees;
    
    // Tokens that have fees collected
    address[] public feeTokens;
    mapping(address => bool) public isTrackedToken;

    // Fee collector authorization
    mapping(address => bool) public authorizedCollectors;

    /**
     * @dev Initialize with treasury address
     */
    constructor(address _treasury, address _owner) {
        require(_treasury != address(0), "Invalid treasury address");
        require(_owner != address(0), "Invalid owner address");
        
        treasury = _treasury;
        transferOwnership(_owner);
        
        // Authorize owner as initial fee collector
        authorizedCollectors[_owner] = true;
    }

    /**
     * @dev Collect platform fee in output token
     * Can be called by authorized backend addresses
     * 
     * @param token Address of the output token (where fee is collected in)
     * @param amount Fee amount in native token decimals
     */
    function collectFee(
        address token,
        uint256 amount
    ) external nonReentrant {
        require(authorizedCollectors[msg.sender], "Not authorized to collect fees");
        require(token != address(0), "Invalid token address");
        require(amount > 0, "Invalid fee amount");

        // Track if this is a new fee token
        if (!isTrackedToken[token]) {
            isTrackedToken[token] = true;
            feeTokens.push(token);
        }

        // Accumulate fee
        accumulatedFees[token] += amount;

        // Transfer fee tokens from collector to this contract
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit FeeCollected(token, amount, msg.sender);
    }

    /**
     * @dev Get accumulated fees for a specific token
     */
    function getAccumulatedFees(address token) external view returns (uint256) {
        return accumulatedFees[token];
    }

    /**
     * @dev Get all tokens with accumulated fees
     */
    function getFeeTokens() external view returns (address[] memory) {
        return feeTokens;
    }

    /**
     * @dev Withdraw accumulated fees to treasury
     * Only callable by owner
     */
    function withdrawToTreasury(address token) external onlyOwner nonReentrant {
        require(token != address(0), "Invalid token address");
        
        uint256 amount = accumulatedFees[token];
        require(amount > 0, "No accumulated fees for this token");

        accumulatedFees[token] = 0;
        IERC20(token).safeTransfer(treasury, amount);

        emit FeeWithdrawn(token, amount, treasury);
    }

    /**
     * @dev Withdraw accumulated fees for multiple tokens
     * Only callable by owner
     */
    function withdrawMultipleToTreasury(address[] calldata tokens) external onlyOwner nonReentrant {
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            uint256 amount = accumulatedFees[token];
            
            if (amount > 0) {
                accumulatedFees[token] = 0;
                IERC20(token).safeTransfer(treasury, amount);
                emit FeeWithdrawn(token, amount, treasury);
            }
        }
    }

    /**
     * @dev Withdraw all accumulated fees across all tokens
     * Only callable by owner
     */
    function withdrawAllToTreasury() external onlyOwner nonReentrant {
        for (uint256 i = 0; i < feeTokens.length; i++) {
            address token = feeTokens[i];
            uint256 amount = accumulatedFees[token];
            
            if (amount > 0) {
                accumulatedFees[token] = 0;
                IERC20(token).safeTransfer(treasury, amount);
                emit FeeWithdrawn(token, amount, treasury);
            }
        }
    }

    /**
     * @dev Update treasury address
     */
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury address");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    /**
     * @dev Authorize or revoke fee collection rights
     * Used to allow backend addresses to submit fees
     */
    function setCollectorAuthorization(address collector, bool authorized) external onlyOwner {
        require(collector != address(0), "Invalid collector address");
        authorizedCollectors[collector] = authorized;
        emit CollectorAuthorizationUpdated(collector, authorized);
    }

    /**
     * @dev Check if an address is authorized to collect fees
     */
    function isAuthorized(address collector) external view returns (bool) {
        return authorizedCollectors[collector];
    }
}
