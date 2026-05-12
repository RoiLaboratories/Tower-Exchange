// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IFeeCollector
 * @dev Interface for FeeCollector contract
 * 
 * Collects platform fees from native USDC swaps
 * Fees are collected in the output token (not the input token)
 */
interface IFeeCollector {
    /**
     * @dev Collect platform fee in output token
     * @param token Address of the output token
     * @param amount Fee amount in native token decimals
     */
    function collectFee(address token, uint256 amount) external;

    /**
     * @dev Collect fee and distribute remaining output to user.
     */
    function collectFeeAndDistribute(address token, uint256 totalAmount, uint256 feeBps, address recipient) external;

    /**
     * @dev Split tokens already held by the collector.
     */
    function splitFeesInPlace(address token, uint256 totalAmount, uint256 feeBps, address recipient) external;

    /**
     * @dev Get accumulated fees for a specific token
     */
    function getAccumulatedFees(address token) external view returns (uint256);

    /**
     * @dev Get all tokens with accumulated fees
     */
    function getFeeTokens() external view returns (address[] memory);

    /**
     * @dev Withdraw accumulated fees to treasury
     */
    function withdrawToTreasury(address token) external;

    /**
     * @dev Withdraw accumulated fees for multiple tokens
     */
    function withdrawMultipleToTreasury(address[] calldata tokens) external;

    /**
     * @dev Withdraw all accumulated fees across all tokens
     */
    function withdrawAllToTreasury() external;

    /**
     * @dev Update treasury address
     */
    function setTreasury(address _treasury) external;

    /**
     * @dev Authorize or revoke fee collection rights
     */
    function setCollectorAuthorization(address collector, bool authorized) external;

    /**
     * @dev Check if an address is authorized to collect fees
     */
    function isAuthorized(address collector) external view returns (bool);

    // Events
    event FeeCollected(address indexed token, uint256 amount, address indexed collector);
    event FeeWithdrawn(address indexed token, uint256 amount, address indexed recipient);
    event TreasuryUpdated(address indexed newTreasury);
    event CollectorAuthorizationUpdated(address indexed collector, bool status);
}
