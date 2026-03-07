// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SwapMath
 * @dev Library for swap calculations and validations
 */
library SwapMath {
    uint256 constant WAD = 1e18;
    uint256 constant MAX_FEE = 30; // 0.3% in basis points (1 = 0.01%)

    /**
     * @dev Calculate output amount with slippage protection
     * @param expectedAmount The expected output amount
     * @param slippage The maximum acceptable slippage in basis points (e.g., 50 = 0.5%)
     * @return minimumAmount The minimum acceptable amount (expectedAmount * (10000 - slippage) / 10000)
     */
    function calculateMinimumAmount(uint256 expectedAmount, uint256 slippage)
        internal
        pure
        returns (uint256 minimumAmount)
    {
        require(slippage <= 10000, "Invalid slippage percentage");

        if (expectedAmount == 0) return 0;
        
        minimumAmount = (expectedAmount * (10000 - slippage)) / 10000;
    }

    /**
     * @dev Calculate platform fee amount
     * @param amount The input or output amount
     * @param feePercentage Fee in basis points (e.g., 30 = 0.3%)
     * @return fee The fee amount
     */
    function calculateFee(uint256 amount, uint256 feePercentage)
        internal
        pure
        returns (uint256 fee)
    {
        require(feePercentage <= MAX_FEE, "Fee exceeds maximum");
        fee = (amount * feePercentage) / 10000;
    }

    /**
     * @dev Calculate amount after fee deduction
     * @param amount The original amount
     * @param feePercentage Fee in basis points
     * @return amountAfterFee The amount after fee
     */
    function subtractFee(uint256 amount, uint256 feePercentage)
        internal
        pure
        returns (uint256 amountAfterFee)
    {
        uint256 fee = calculateFee(amount, feePercentage);
        amountAfterFee = amount - fee;
    }

    /**
     * @dev Validate deadline
     * @param deadline The transaction deadline timestamp
     */
    function validateDeadline(uint256 deadline) internal view {
        require(deadline >= block.timestamp, "Transaction deadline expired");
    }

    /**
     * @dev Calculate price impact
     * @param inputAmount The input token amount
     * @param inputReserve The reserve of input token in pool
     * @param outputReserve The reserve of output token in pool
     * @param feePercentage The swap fee percentage
     * @return outputAmount The output amount
     * @return priceImpact The price impact in basis points
     */
    function calculateOutputAmount(
        uint256 inputAmount,
        uint256 inputReserve,
        uint256 outputReserve,
        uint256 feePercentage
    ) internal pure returns (uint256 outputAmount, uint256 priceImpact) {
        require(inputAmount > 0, "Input amount must be greater than 0");
        require(inputReserve > 0 && outputReserve > 0, "Invalid reserves");

        // Apply fee
        uint256 amountInWithFee = inputAmount * (10000 - feePercentage);

        // Calculate output using Uniswap V2 formula: (inputAmount * 997 / 1000) * outputReserve / (inputReserve + inputAmount * 997 / 1000)
        uint256 numerator = amountInWithFee * outputReserve;
        uint256 denominator = (inputReserve * 10000) + amountInWithFee;
        outputAmount = numerator / denominator;

        // Calculate price impact
        // spotPrice = outputReserve / inputReserve
        // executionPrice = outputAmount / inputAmount
        // priceImpact = 1 - (executionPrice / spotPrice) in basis points
        uint256 spotPrice = (outputReserve * WAD) / inputReserve;
        uint256 executionPrice = (outputAmount * WAD) / inputAmount;
        
        if (executionPrice >= spotPrice) {
            priceImpact = 0;
        } else {
            priceImpact = ((spotPrice - executionPrice) * 10000) / spotPrice;
        }
    }

    /**
     * @dev Sort tokens for consistent ordering
     * @param tokenA First token address
     * @param tokenB Second token address
     * @return token0 The smaller token address
     * @return token1 The larger token address
     */
    function sortTokens(address tokenA, address tokenB)
        internal
        pure
        returns (address token0, address token1)
    {
        require(tokenA != tokenB, "Identical tokens");
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "Zero address token");
    }
}
