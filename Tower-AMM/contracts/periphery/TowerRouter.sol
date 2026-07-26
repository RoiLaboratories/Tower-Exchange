// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/ITowerFactory.sol";
import "../interfaces/ITowerPair.sol";
import "../libraries/Math.sol";
import "../libraries/TowerLibrary.sol";
import "../libraries/TransferHelper.sol";

contract TowerRouter {
    uint256 private constant MINIMUM_LIQUIDITY = 1000;

    address public immutable factory;

    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, "Tower: EXPIRED");
        _;
    }

    constructor(address _factory) {
        require(_factory != address(0), "Tower: INVALID_FACTORY");
        factory = _factory;
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        (amountA, amountB) =
            _addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin);

        address pair = TowerLibrary.pairFor(factory, tokenA, tokenB);
        TransferHelper.safeTransferFrom(tokenA, msg.sender, pair, amountA);
        TransferHelper.safeTransferFrom(tokenB, msg.sender, pair, amountB);
        liquidity = ITowerPair(pair).mint(to);
    }

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) public ensure(deadline) returns (uint256 amountA, uint256 amountB) {
        address pair = TowerLibrary.pairFor(factory, tokenA, tokenB);
        require(ITowerPair(pair).transferFrom(msg.sender, pair, liquidity), "Tower: LP_TRANSFER_FAILED");

        (uint256 amount0, uint256 amount1) = ITowerPair(pair).burn(to);
        (address token0, ) = TowerLibrary.sortTokens(tokenA, tokenB);
        (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);

        require(amountA >= amountAMin, "Tower: INSUFFICIENT_A_AMOUNT");
        require(amountB >= amountBMin, "Tower: INSUFFICIENT_B_AMOUNT");
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        amounts = TowerLibrary.getAmountsOut(factory, amountIn, path);
        require(
            amounts[amounts.length - 1] >= amountOutMin,
            "Tower: INSUFFICIENT_OUTPUT_AMOUNT"
        );

        TransferHelper.safeTransferFrom(
            path[0],
            msg.sender,
            TowerLibrary.pairFor(factory, path[0], path[1]),
            amounts[0]
        );
        _swap(amounts, path, to);
    }

    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        amounts = TowerLibrary.getAmountsIn(factory, amountOut, path);
        require(amounts[0] <= amountInMax, "Tower: EXCESSIVE_INPUT_AMOUNT");

        TransferHelper.safeTransferFrom(
            path[0],
            msg.sender,
            TowerLibrary.pairFor(factory, path[0], path[1]),
            amounts[0]
        );
        _swap(amounts, path, to);
    }

    function quoteAddLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired
    ) external view returns (uint256 amountA, uint256 amountB, uint256 expectedLiquidity) {
        address pair = ITowerFactory(factory).getPair(tokenA, tokenB);

        if (pair == address(0)) {
            require(ITowerFactory(factory).isPairCreationAllowed(tokenA, tokenB), "Tower: PAIR_NOT_ALLOWED");
            amountA = amountADesired;
            amountB = amountBDesired;
            expectedLiquidity = _quoteInitialLiquidity(amountA, amountB);
            return (amountA, amountB, expectedLiquidity);
        }

        (uint256 reserveA, uint256 reserveB) = TowerLibrary.getReserves(factory, tokenA, tokenB);

        if (reserveA == 0 && reserveB == 0) {
            amountA = amountADesired;
            amountB = amountBDesired;
        } else {
            uint256 amountBOptimal = TowerLibrary.quote(amountADesired, reserveA, reserveB);

            if (amountBOptimal <= amountBDesired) {
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint256 amountAOptimal = TowerLibrary.quote(amountBDesired, reserveB, reserveA);
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }

        expectedLiquidity = _quoteLiquidity(pair, amountA, amountB, reserveA, reserveB);
    }

    function quoteRemoveLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity
    ) external view returns (uint256 amountA, uint256 amountB) {
        address pair = TowerLibrary.pairFor(factory, tokenA, tokenB);
        uint256 totalSupply = ITowerPair(pair).totalSupply();
        require(totalSupply > 0, "Tower: INSUFFICIENT_LIQUIDITY");

        (uint256 reserveA, uint256 reserveB) = TowerLibrary.getReserves(factory, tokenA, tokenB);
        amountA = (liquidity * reserveA) / totalSupply;
        amountB = (liquidity * reserveB) / totalSupply;
    }

    function getAmountsOut(uint256 amountIn, address[] memory path)
        public
        view
        returns (uint256[] memory amounts)
    {
        return TowerLibrary.getAmountsOut(factory, amountIn, path);
    }

    function getAmountsIn(uint256 amountOut, address[] memory path)
        public
        view
        returns (uint256[] memory amounts)
    {
        return TowerLibrary.getAmountsIn(factory, amountOut, path);
    }

    function quote(uint256 amountA, uint256 reserveA, uint256 reserveB) external pure returns (uint256) {
        return TowerLibrary.quote(amountA, reserveA, reserveB);
    }

    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin
    ) internal returns (uint256 amountA, uint256 amountB) {
        if (ITowerFactory(factory).getPair(tokenA, tokenB) == address(0)) {
            require(ITowerFactory(factory).isPairCreationAllowed(tokenA, tokenB), "Tower: PAIR_NOT_ALLOWED");
            ITowerFactory(factory).createPair(tokenA, tokenB);
        }

        (uint256 reserveA, uint256 reserveB) = TowerLibrary.getReserves(factory, tokenA, tokenB);

        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint256 amountBOptimal = TowerLibrary.quote(amountADesired, reserveA, reserveB);

            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, "Tower: INSUFFICIENT_B_AMOUNT");
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint256 amountAOptimal = TowerLibrary.quote(amountBDesired, reserveB, reserveA);
                require(amountAOptimal >= amountAMin, "Tower: INSUFFICIENT_A_AMOUNT");
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
    }

    function _quoteInitialLiquidity(uint256 amountA, uint256 amountB) internal pure returns (uint256 liquidity) {
        if (amountA == 0 || amountB == 0) {
            return 0;
        }

        uint256 rootK = Math.sqrt(amountA * amountB);
        if (rootK <= MINIMUM_LIQUIDITY) {
            return 0;
        }

        liquidity = rootK - MINIMUM_LIQUIDITY;
    }

    function _quoteLiquidity(
        address pair,
        uint256 amountA,
        uint256 amountB,
        uint256 reserveA,
        uint256 reserveB
    ) internal view returns (uint256 liquidity) {
        uint256 totalSupply = ITowerPair(pair).totalSupply();

        if (totalSupply == 0 || reserveA == 0 || reserveB == 0) {
            return _quoteInitialLiquidity(amountA, amountB);
        }

        liquidity = Math.min(
            (amountA * totalSupply) / reserveA,
            (amountB * totalSupply) / reserveB
        );
    }

    function _swap(uint256[] memory amounts, address[] memory path, address to) internal {
        for (uint256 i = 0; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0, ) = TowerLibrary.sortTokens(input, output);
            uint256 amountOut = amounts[i + 1];
            (uint256 amount0Out, uint256 amount1Out) =
                input == token0 ? (uint256(0), amountOut) : (amountOut, uint256(0));
            address nextTo = i < path.length - 2
                ? TowerLibrary.pairFor(factory, output, path[i + 2])
                : to;

            ITowerPair(TowerLibrary.pairFor(factory, input, output)).swap(
                amount0Out,
                amount1Out,
                nextTo,
                new bytes(0)
            );
        }
    }
}
