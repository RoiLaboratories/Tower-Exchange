// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IDexRouter.sol";
import "../interfaces/IXyloNetRouter.sol";

/**
 * @title XyloNetAdapter
 * @dev Adapter to use XyloNet as a compatible router in TowerRouter
 * Converts path-based swaps to XyloNet's pool-based interface
 */
contract XyloNetAdapter is IDexRouter, Ownable {
    // XyloNet Router address
    IXyloNetRouter public xyloNetRouter;

    // Factory address (not used for XyloNet but required by IDexRouter)
    address public factoryAddress;

    // WUSDC token address (Arc uses USDC for gas, not ETH)
    address public wusdcAddress;

    // Pool registry: hash(tokenIn, tokenOut) => pool address
    mapping(bytes32 => address) public poolRegistry;

    // Arc testnet token addresses
    address public constant USDC = 0x3600000000000000000000000000000000000000;
    address public constant EURC = 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a;
    address public constant USYC = 0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C;

    // Arc testnet pool addresses
    address public constant USDC_EURC_POOL = 0x3DF3966F5138143dce7a9cFDdC2c0310ce083BB1;
    address public constant USDC_USYC_POOL = 0x8296cC7477A9CD12cF632042fDDc2aB89151bb61;

    // Events
    event PoolRegistered(address indexed tokenIn, address indexed tokenOut, address indexed pool);
    event PoolUpdated(address indexed tokenIn, address indexed tokenOut, address indexed newPool);

    /**
     * @dev Initialize adapter with XyloNet router and token addresses
     */
    constructor(
        address _xyloNetRouter,
        address _wusdcAddress,
        address _factoryAddress
    ) {
        require(_xyloNetRouter != address(0), "Invalid XyloNet router");
        require(_wusdcAddress != address(0), "Invalid WUSDC address");

        xyloNetRouter = IXyloNetRouter(_xyloNetRouter);
        wusdcAddress = _wusdcAddress;
        factoryAddress = _factoryAddress;

        // Register default Arc testnet pools
        _registerPool(USDC, EURC, USDC_EURC_POOL);
        _registerPool(EURC, USDC, USDC_EURC_POOL);
        _registerPool(USDC, USYC, USDC_USYC_POOL);
        _registerPool(USYC, USDC, USDC_USYC_POOL);
    }

    /**
     * @dev Register a pool for a token pair
     */
    function registerPool(
        address tokenIn,
        address tokenOut,
        address pool
    ) external onlyOwner {
        require(tokenIn != address(0), "Invalid tokenIn");
        require(tokenOut != address(0), "Invalid tokenOut");
        require(pool != address(0), "Invalid pool");
        require(tokenIn != tokenOut, "Same token pair");

        _registerPool(tokenIn, tokenOut, pool);
    }

    /**
     * @dev Internal pool registration
     */
    function _registerPool(
        address tokenIn,
        address tokenOut,
        address pool
    ) internal {
        bytes32 key = _getPoolKey(tokenIn, tokenOut);
        address existingPool = poolRegistry[key];

        if (existingPool != address(0)) {
            emit PoolUpdated(tokenIn, tokenOut, pool);
        } else {
            emit PoolRegistered(tokenIn, tokenOut, pool);
        }

        poolRegistry[key] = pool;
    }

    /**
     * @dev Execute a swap using XyloNet
     * Converts path-based interface to pool-based
     */
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        uint256 deadline
    ) external returns (uint256 amountOut) {
        require(tokenIn != address(0), "Invalid tokenIn");
        require(tokenOut != address(0), "Invalid tokenOut");
        require(amountIn > 0, "Invalid amountIn");
        require(recipient != address(0), "Invalid recipient");

        address pool = _getPool(tokenIn, tokenOut);
        require(pool != address(0), "No pool registered for pair");

        // Approve XyloNet router to spend tokens
        IERC20(tokenIn).approve(address(xyloNetRouter), amountIn);

        // Execute swap via XyloNet
        amountOut = xyloNetRouter.swap(
            pool,
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut,
            recipient,
            deadline
        );

        return amountOut;
    }

    /**
     * @dev Get quote for a swap
     */
    function getAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut) {
        require(tokenIn != address(0), "Invalid tokenIn");
        require(tokenOut != address(0), "Invalid tokenOut");
        require(amountIn > 0, "Invalid amountIn");

        address pool = _getPool(tokenIn, tokenOut);
        require(pool != address(0), "No pool registered for pair");

        amountOut = xyloNetRouter.getAmountOut(pool, tokenIn, tokenOut, amountIn);
        return amountOut;
    }

    /**
     * @dev Get factory address
     */
    function factory() external view returns (address) {
        return factoryAddress;
    }

    /**
     * @dev Get WETH address (returns WUSDC on Arc Network)
     */
    function WETH() external view returns (address) {
        return wusdcAddress;
    }

    /**
     * @dev Get pool for a token pair
     */
    function getPool(address tokenIn, address tokenOut)
        external
        view
        returns (address)
    {
        return _getPool(tokenIn, tokenOut);
    }

    /**
     * @dev Internal helper to get pool
     */
    function _getPool(address tokenIn, address tokenOut)
        internal
        view
        returns (address)
    {
        bytes32 key = _getPoolKey(tokenIn, tokenOut);
        return poolRegistry[key];
    }

    /**
     * @dev Generate pool registry key from token pair
     */
    function _getPoolKey(address tokenIn, address tokenOut)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(tokenIn, tokenOut));
    }

    /**
     * @dev Get supported tokens on Arc testnet
     */
    function getSupportedTokens() external pure returns (address[] memory) {
        address[] memory tokens = new address[](3);
        tokens[0] = USDC;
        tokens[1] = EURC;
        tokens[2] = USYC;
        return tokens;
    }

    /**
     * @dev Check if a pair is supported
     */
    function isPairSupported(address tokenIn, address tokenOut)
        external
        view
        returns (bool)
    {
        return _getPool(tokenIn, tokenOut) != address(0);
    }
}
