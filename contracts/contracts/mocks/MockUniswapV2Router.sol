// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockUniswapV2Router {
    using SafeERC20 for IERC20;

    address public immutable factory;
    address public immutable WETH;

    constructor(address _factory, address _weth) {
        factory = _factory;
        WETH = _weth;
    }

    function getAmountsOut(
        uint256 amountIn,
        address[] calldata path
    ) external pure returns (uint256[] memory amounts) {
        require(path.length >= 2, "INVALID_PATH");

        amounts = new uint256[](path.length);
        amounts[0] = amountIn;

        for (uint256 i = 1; i < path.length; i++) {
            amounts[i] = amountIn * (i + 1);
        }
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require(block.timestamp <= deadline, "EXPIRED");
        require(path.length >= 2, "INVALID_PATH");
        require(to != address(0), "INVALID_TO");

        IERC20(path[0]).safeTransferFrom(msg.sender, address(this), amountIn);

        uint256 amountOut = amountOutMin == 0 ? amountIn : amountOutMin;
        IERC20(path[path.length - 1]).safeTransfer(to, amountOut);

        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        amounts[path.length - 1] = amountOut;
    }
}
