// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IDexRouter
 * @dev Interface for DEX routers (supports both UniswapV2 and V3 patterns)
 */
interface IDexRouter {
    /// @dev Execute a swap on this DEX
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        uint256 deadline
    ) external returns (uint256 amountOut);

    /// @dev Get the quote for swapping tokens
    function getAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut);

    /// @dev Get factory address
    function factory() external view returns (address);

    /// @dev Get WETH address
    function WETH() external view returns (address);
}

/**
 * @title IUniswapV2Router
 * @dev Uniswap V2 style router interface
 */
interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);

    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts);

    function factory() external view returns (address);
    function WETH() external view returns (address);
}

/**
 * @title IUniswapV3Router
 * @dev Uniswap V3 style router interface
 */
interface IUniswapV3Router {
    struct ExactInputSingleParams {
        bytes32 path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);

    function factory() external view returns (address);
    function WETH9() external view returns (address);
}
