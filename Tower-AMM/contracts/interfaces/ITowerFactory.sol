// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface ITowerFactory {
    function feeTo() external view returns (address);

    function feeToSetter() external view returns (address);

    function supportedToken(address token) external view returns (bool);

    function pairAllowed(address tokenA, address tokenB) external view returns (bool);

    function enforcePairAllowlist() external view returns (bool);

    function getPair(address tokenA, address tokenB) external view returns (address);

    function createPair(address tokenA, address tokenB) external returns (address pair);

    function isPairCreationAllowed(address tokenA, address tokenB) external view returns (bool);
}
