// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockSwapRouter {
    using SafeERC20 for IERC20;

    function swapExactInput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address recipient
    ) external returns (uint256) {
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(recipient, amountOut);
        return amountOut;
    }

    function swapPartialInput(
        address tokenIn,
        address tokenOut,
        uint256 amountToSpend,
        uint256 amountOut,
        address recipient
    ) external returns (uint256) {
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountToSpend);
        IERC20(tokenOut).safeTransfer(recipient, amountOut);
        return amountOut;
    }

    function revertWithReason() external pure {
        revert("Mock route failed");
    }
}
