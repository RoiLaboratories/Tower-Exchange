// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IDexRouter.sol";

/**
 * @title TowerDexAdapter
 * @dev Executor-friendly adapter for the Tower AMM Uniswap V2 router.
 *
 * TowerSwapExecutor approves this adapter, and the adapter then:
 * - pulls the ERC20 input from the executor,
 * - approves the raw Tower AMM router,
 * - performs a standard Uniswap V2 style swap,
 * - routes output back to the executor recipient.
 *
 * This avoids double-fee collection from the TowerRouter aggregator contract
 * while preserving the existing executor-based platform fee flow.
 */
contract TowerDexAdapter is IDexRouter, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IUniswapV2Router public immutable towerDexRouter;
    address public immutable factoryAddress;
    // Tower AMM is token-to-token only on Arc, so no wrapped native token is exposed.
    address public immutable wrappedNativeToken;

    constructor(address _towerDexRouter) {
        require(_towerDexRouter != address(0), "Invalid Tower router");

        towerDexRouter = IUniswapV2Router(_towerDexRouter);
        factoryAddress = towerDexRouter.factory();
        wrappedNativeToken = address(0);
    }

    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        uint256 deadline
    ) external nonReentrant returns (uint256 amountOut) {
        require(tokenIn != address(0), "Invalid tokenIn");
        require(tokenOut != address(0), "Invalid tokenOut");
        require(tokenIn != tokenOut, "Same token pair");
        require(amountIn > 0, "Invalid amountIn");
        require(recipient != address(0), "Invalid recipient");

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).safeApprove(address(towerDexRouter), 0);
        IERC20(tokenIn).safeApprove(address(towerDexRouter), amountIn);

        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        uint256[] memory amounts = towerDexRouter.swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            recipient,
            deadline
        );

        IERC20(tokenIn).safeApprove(address(towerDexRouter), 0);

        amountOut = amounts[amounts.length - 1];
        require(amountOut >= minAmountOut, "Insufficient output amount");
    }

    function getAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut) {
        require(tokenIn != address(0), "Invalid tokenIn");
        require(tokenOut != address(0), "Invalid tokenOut");
        require(tokenIn != tokenOut, "Same token pair");
        require(amountIn > 0, "Invalid amountIn");

        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        uint256[] memory amounts = towerDexRouter.getAmountsOut(amountIn, path);
        amountOut = amounts[amounts.length - 1];
    }

    function factory() external view returns (address) {
        return factoryAddress;
    }

    function WETH() external view returns (address) {
        return wrappedNativeToken;
    }

    function recoverToken(address token, address recipient, uint256 amount) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        IERC20(token).safeTransfer(recipient, amount);
    }
}
