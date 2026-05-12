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

    address public constant NATIVE_USDC = 0x3600000000000000000000000000000000000000;
    uint256 public constant NATIVE_USDC_DECIMAL_SCALE = 1e12;

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

    receive() external payable {}

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
     * @dev Collect fee and distribute to user in one atomic transaction
     * Called as swap recipient: receives full output, splits fee, sends remainder to user
     * 
     * @param token Address of the output token
     * @param totalAmount Total output amount from swap (includes fee)
     * @param feeBps Fee in basis points (e.g., 25 = 0.25%)
     * @param recipient User address to receive (totalAmount - fee)
     */
    function collectFeeAndDistribute(
        address token,
        uint256 totalAmount,
        uint256 feeBps,
        address recipient
    ) external nonReentrant {
        require(authorizedCollectors[msg.sender], "Not authorized to collect fees");
        require(token != address(0), "Invalid token address");
        require(recipient != address(0), "Invalid recipient address");
        require(totalAmount > 0, "Invalid amount");
        require(feeBps <= 10000, "Invalid fee basis points"); // Max 100%

        // Calculate fee and user amount
        uint256 feeAmount = (totalAmount * feeBps) / 10000;
        uint256 userAmount = totalAmount - feeAmount;

        // Track if this is a new fee token
        if (!isTrackedToken[token]) {
            isTrackedToken[token] = true;
            feeTokens.push(token);
        }

        // Accumulate fee
        accumulatedFees[token] += feeAmount;

        // Transfer full amount from sender (DEX output)
        IERC20(token).safeTransferFrom(msg.sender, address(this), totalAmount);

        // Send user portion to recipient
        IERC20(token).safeTransfer(recipient, userAmount);

        emit FeeCollected(token, feeAmount, msg.sender);
    }

    /**
     * @dev Split fees from tokens already in this contract
     * Used when swap output was routed directly to FeeCollector
     * (no transferFrom needed - tokens already here from swap)
     * 
     * @param token Address of the token to split
     * @param totalAmount The exact amount of tokens swapped (to correctly calculate fee)
     * @param feeBps Fee in basis points (e.g., 25 = 0.25%)
     * @param recipient User address to receive (totalAmount - fee)
     */
    function splitFeesInPlace(
        address token,
        uint256 totalAmount,
        uint256 feeBps,
        address recipient
    ) external nonReentrant {
        require(authorizedCollectors[msg.sender], "Not authorized to collect fees");
        require(token != address(0), "Invalid token address");
        require(totalAmount > 0, "Invalid amount");
        require(recipient != address(0), "Invalid recipient address");
        require(feeBps <= 10000, "Invalid fee basis points"); // Max 100%

        // Verify contract has at least the expected amount
        IERC20 tokenContract = IERC20(token);
        uint256 contractBalance = tokenContract.balanceOf(address(this));
        require(contractBalance >= totalAmount, "Insufficient tokens in contract");

        // Calculate fee and user amount from the swap output amount
        uint256 feeAmount = (totalAmount * feeBps) / 10000;
        uint256 userAmount = totalAmount - feeAmount;

        // Track if this is a new fee token
        if (!isTrackedToken[token]) {
            isTrackedToken[token] = true;
            feeTokens.push(token);
        }

        // Accumulate fee
        accumulatedFees[token] += feeAmount;

        // Send user portion to recipient
        tokenContract.safeTransfer(recipient, userAmount);

        emit FeeCollected(token, feeAmount, msg.sender);
    }

    /**
     * @dev Split native USDC already in this contract.
     * Used by router unwrap flows that deliver Arc native USDC with a payable call.
     */
    function splitNativeFeesInPlace(
        uint256 totalAmount,
        uint256 feeBps,
        address recipient
    ) external nonReentrant {
        _splitNativeFeesInPlace(totalAmount, feeBps, recipient);
    }

    /**
     * @dev Split native USDC using the 6-decimal units returned by NATIVE_USDC.balanceOf().
     * Arc native value transfers use 18 decimals, while the 0x3600... token interface reports
     * 6-decimal balances. This helper prevents manual callers from sending dust by mistake.
     */
    function splitNativeTokenFeesInPlace(
        uint256 totalAmountTokenUnits,
        uint256 feeBps,
        address recipient
    ) external nonReentrant {
        _splitNativeFeesInPlace(totalAmountTokenUnits * NATIVE_USDC_DECIMAL_SCALE, feeBps, recipient);
    }

    /**
     * @dev Split all unallocated native USDC currently held by this contract.
     * Excludes already-accounted accumulated fees so recovery calls do not re-split treasury fees.
     */
    function splitAvailableNativeFeesInPlace(
        uint256 feeBps,
        address recipient
    ) external nonReentrant {
        uint256 accountedFees = accumulatedFees[NATIVE_USDC];
        require(address(this).balance > accountedFees, "No unallocated native balance");
        _splitNativeFeesInPlace(address(this).balance - accountedFees, feeBps, recipient);
    }

    function _splitNativeFeesInPlace(
        uint256 totalAmount,
        uint256 feeBps,
        address recipient
    ) internal {
        require(authorizedCollectors[msg.sender], "Not authorized to collect fees");
        require(totalAmount > 0, "Invalid amount");
        require(recipient != address(0), "Invalid recipient address");
        require(feeBps <= 10000, "Invalid fee basis points");
        require(address(this).balance >= totalAmount, "Insufficient native balance");

        uint256 feeAmount = (totalAmount * feeBps) / 10000;
        uint256 userAmount = totalAmount - feeAmount;

        if (!isTrackedToken[NATIVE_USDC]) {
            isTrackedToken[NATIVE_USDC] = true;
            feeTokens.push(NATIVE_USDC);
        }

        accumulatedFees[NATIVE_USDC] += feeAmount;

        (bool sent, ) = recipient.call{value: userAmount}("");
        require(sent, "Native transfer failed");

        emit FeeCollected(NATIVE_USDC, feeAmount, msg.sender);
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
        if (token == NATIVE_USDC && address(this).balance >= amount) {
            (bool sent, ) = treasury.call{value: amount}("");
            require(sent, "Native transfer failed");
        } else {
            IERC20(token).safeTransfer(treasury, amount);
        }

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
                if (token == NATIVE_USDC && address(this).balance >= amount) {
                    (bool sent, ) = treasury.call{value: amount}("");
                    require(sent, "Native transfer failed");
                } else {
                    IERC20(token).safeTransfer(treasury, amount);
                }
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
                if (token == NATIVE_USDC && address(this).balance >= amount) {
                    (bool sent, ) = treasury.call{value: amount}("");
                    require(sent, "Native transfer failed");
                } else {
                    IERC20(token).safeTransfer(treasury, amount);
                }
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
