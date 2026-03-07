// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IXyloNetRouter
 * @dev Interface for XyloNet stable swap router
 */
interface IXyloNetRouter {
    /**
     * @dev Get the expected output amount for a swap
     * @param pool Address of the stable swap pool
     * @param tokenIn Address of input token
     * @param tokenOut Address of output token
     * @param amountIn Amount of input token (with decimals)
     * @return amountOut Expected output amount
     */
    function getAmountOut(
        address pool,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut);

    /**
     * @dev Execute a stable swap
     * @param pool Address of the stable swap pool
     * @param tokenIn Address of input token
     * @param tokenOut Address of output token
     * @param amountIn Amount of input token
     * @param minAmountOut Minimum acceptable output amount
     * @param to Recipient of output tokens
     * @param deadline Transaction deadline
     * @return amountOut Actual output amount
     */
    function swap(
        address pool,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address to,
        uint256 deadline
    ) external returns (uint256 amountOut);
}
