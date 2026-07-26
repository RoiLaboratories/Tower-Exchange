// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface ITowerPair {
    function MINIMUM_LIQUIDITY() external pure returns (uint256);

    function totalSupply() external view returns (uint256);

    function token0() external view returns (address);

    function token1() external view returns (address);

    function getReserves() external view returns (uint112, uint112, uint32);

    function mint(address to) external returns (uint256 liquidity);

    function burn(address to) external returns (uint256 amount0, uint256 amount1);

    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata data) external;

    function skim(address to) external;

    function sync() external;

    function transferFrom(address from, address to, uint256 value) external returns (bool);
}
