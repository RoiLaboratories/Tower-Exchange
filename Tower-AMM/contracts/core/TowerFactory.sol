// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./TowerPair.sol";

contract TowerFactory {
    address public feeTo;
    address public feeToSetter;

    mapping(address => bool) public supportedToken;
    mapping(address => mapping(address => bool)) public pairAllowed;
    bool public enforcePairAllowlist;

    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    event PairCreated(address indexed token0, address indexed token1, address pair, uint256 totalPairs);
    event SupportedTokenSet(address indexed token, bool allowed);
    event PairAllowedSet(address indexed token0, address indexed token1, bool allowed);
    event PairAllowlistEnforcementSet(bool enabled);
    event FeeToSet(address indexed feeTo);
    event FeeToSetterSet(address indexed feeToSetter);

    modifier onlyFeeToSetter() {
        require(msg.sender == feeToSetter, "Tower: FORBIDDEN");
        _;
    }

    constructor(address _feeToSetter) {
        require(_feeToSetter != address(0), "Tower: INVALID_FEE_TO_SETTER");
        feeToSetter = _feeToSetter;
    }

    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }

    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, "Tower: IDENTICAL_ADDRESSES");
        require(isPairCreationAllowed(tokenA, tokenB), "Tower: PAIR_NOT_ALLOWED");

        (address token0, address token1) = _sortTokens(tokenA, tokenB);
        require(getPair[token0][token1] == address(0), "Tower: PAIR_EXISTS");

        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        pair = address(new TowerPair{salt: salt}());
        TowerPair(pair).initialize(token0, token1);

        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;
        allPairs.push(pair);

        emit PairCreated(token0, token1, pair, allPairs.length);
    }

    function setFeeTo(address _feeTo) external onlyFeeToSetter {
        feeTo = _feeTo;
        emit FeeToSet(_feeTo);
    }

    function setFeeToSetter(address _feeToSetter) external onlyFeeToSetter {
        require(_feeToSetter != address(0), "Tower: INVALID_FEE_TO_SETTER");
        feeToSetter = _feeToSetter;
        emit FeeToSetterSet(_feeToSetter);
    }

    function setSupportedToken(address token, bool allowed) external onlyFeeToSetter {
        require(token != address(0), "Tower: ZERO_ADDRESS");
        supportedToken[token] = allowed;
        emit SupportedTokenSet(token, allowed);
    }

    function batchSetSupportedTokens(address[] calldata tokens, bool allowed) external onlyFeeToSetter {
        uint256 length = tokens.length;

        for (uint256 i = 0; i < length; i++) {
            address token = tokens[i];
            require(token != address(0), "Tower: ZERO_ADDRESS");
            supportedToken[token] = allowed;
            emit SupportedTokenSet(token, allowed);
        }
    }

    function setPairAllowed(address tokenA, address tokenB, bool allowed) external onlyFeeToSetter {
        (address token0, address token1) = _sortTokens(tokenA, tokenB);
        pairAllowed[token0][token1] = allowed;
        pairAllowed[token1][token0] = allowed;
        emit PairAllowedSet(token0, token1, allowed);
    }

    function batchSetPairAllowed(
        address[] calldata tokenAs,
        address[] calldata tokenBs,
        bool allowed
    ) external onlyFeeToSetter {
        uint256 length = tokenAs.length;
        require(length == tokenBs.length, "Tower: LENGTH_MISMATCH");

        for (uint256 i = 0; i < length; i++) {
            (address token0, address token1) = _sortTokens(tokenAs[i], tokenBs[i]);
            pairAllowed[token0][token1] = allowed;
            pairAllowed[token1][token0] = allowed;
            emit PairAllowedSet(token0, token1, allowed);
        }
    }

    function setEnforcePairAllowlist(bool enabled) external onlyFeeToSetter {
        enforcePairAllowlist = enabled;
        emit PairAllowlistEnforcementSet(enabled);
    }

    function isPairCreationAllowed(address tokenA, address tokenB) public view returns (bool) {
        if (tokenA == tokenB || tokenA == address(0) || tokenB == address(0)) {
            return false;
        }

        if (!supportedToken[tokenA] || !supportedToken[tokenB]) {
            return false;
        }

        if (!enforcePairAllowlist) {
            return true;
        }

        return pairAllowed[tokenA][tokenB];
    }

    function _sortTokens(address tokenA, address tokenB) private pure returns (address token0, address token1) {
        require(tokenA != tokenB, "Tower: IDENTICAL_ADDRESSES");
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "Tower: ZERO_ADDRESS");
    }
}
