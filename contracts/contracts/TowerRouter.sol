// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./interfaces/IDexRouter.sol";
import "./libraries/SwapMath.sol";

/**
 * @title TowerRouter
 * @dev DEX aggregator router supporting single-hop, multi-hop, and split swaps
 */
contract TowerRouter is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;
    using SwapMath for uint256;

    // Constants
    address public constant NATIVE_TOKEN = address(0);
    address public constant NATIVE_USDC = 0x3600000000000000000000000000000000000000;
    uint256 public constant MAX_HOPS = 5;
    uint256 public constant BASIS_POINTS = 10000;

    // State variables
    address public wethToken;
    uint256 public platformFee = 25; // 0.25% default

    // Accumulated fees by token
    mapping(address => uint256) public accumulatedFees;

    // Registered DEX routers
    mapping(address => bool) public registeredRouters;
    mapping(address => bool) public usesIDexRouterInterface; // Track if router uses IDexRouter interface
    address[] public routers;

    // Events
    event Swap(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 feeAmount,
        address[] path,
        uint256 timestamp
    );

    event RouterRegistered(address indexed router);
    event RouterUnregistered(address indexed router);
    event PlatformFeeUpdated(uint256 newFee);
    event FeeCollected(address indexed token, uint256 feeAmount);
    event FeeWithdrawn(address indexed token, address indexed recipient, uint256 amount);
    event NativeSwap(address indexed user, uint256 amountIn, uint256 amountOut);

    /**
     * @dev Initialize router with WETH and owner
     */
    constructor(address _wethToken, address _owner) {
        require(_wethToken != address(0), "Invalid WETH address");
        wethToken = _wethToken;
        transferOwnership(_owner);
    }

    /**
     * @dev Register a new DEX router
     * @param router Address of the router to register
     * @param usesIDexInterface Whether the router implements IDexRouter interface (true for XyloNetAdapter, false for Uniswap V2)
     */
    function registerRouter(address router, bool usesIDexInterface) external onlyOwner {
        require(router != address(0), "Invalid router address");
        require(!registeredRouters[router], "Router already registered");

        registeredRouters[router] = true;
        usesIDexRouterInterface[router] = usesIDexInterface;
        routers.push(router);

        emit RouterRegistered(router);
    }

    /**
     * @dev Unregister a DEX router
     */
    function unregisterRouter(address router) external onlyOwner {
        require(registeredRouters[router], "Router not registered");

        registeredRouters[router] = false;

        // Remove from array
        for (uint256 i = 0; i < routers.length; i++) {
            if (routers[i] == router) {
                routers[i] = routers[routers.length - 1];
                routers.pop();
                break;
            }
        }

        emit RouterUnregistered(router);
    }

    /**
     * @dev Set platform fee (max 0.3%)
     */
    function setPlatformFee(uint256 newFee) external onlyOwner {
        require(newFee <= 30, "Fee exceeds maximum 0.3%");
        platformFee = newFee;
        emit PlatformFeeUpdated(newFee);
    }

    /**
     * @dev Withdraw accumulated fees for a token to a recipient
     */
    function withdrawFees(address token, address recipient) external onlyOwner nonReentrant {
        require(recipient != address(0), "Invalid recipient");
        uint256 feeAmount = accumulatedFees[token];
        require(feeAmount > 0, "No accumulated fees for this token");

        accumulatedFees[token] = 0;
        IERC20(token).safeTransfer(recipient, feeAmount);

        emit FeeWithdrawn(token, recipient, feeAmount);
    }

    /**
     * @dev Get accumulated fees for a token
     */
    function getAccumulatedFees(address token) external view returns (uint256) {
        return accumulatedFees[token];
    }

    /**
     * @dev Single-hop swap: tokenIn -> tokenOut
     * Special handling for native USDC which doesn't support standard ERC20 transferFrom
     * 
     * For native USDC (0x3600...):
     * - User must approve the DEX router directly (not TowerRouter)
     * - TowerRouter passes the swap to the router without intermediating the transfer
     * - No platform fees are collected for native USDC swaps
     */
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 minAmountOut,
        address[] calldata path,
        address to,
        uint256 deadline,
        address router
    ) external nonReentrant whenNotPaused returns (uint256 amountOut) {
        require(path.length >= 2 && path.length <= MAX_HOPS, "Invalid path length");
        require(amountIn > 0, "Invalid input amount");
        require(to != address(0), "Invalid recipient");
        require(registeredRouters[router], "Router not registered");

        SwapMath.validateDeadline(deadline);

        address tokenIn = path[0];
        address tokenOut = path[path.length - 1];

        uint256 feeAmount = 0;
        uint256 swapAmount = amountIn;

        // Special handling for native USDC - cannot use standard transferFrom flow
        // Native USDC requires special handling (may require ETH or alternative transfer method)
        // For now, we pass it directly to the registered router
        if (tokenIn == NATIVE_USDC) {
            // Native USDC bypasses fee collection due to transfer limitations
            // Router is responsible for handling the token transfer from user
            // User must approve router (not TowerRouter) for this to work
            
            // Call router directly without transfer through TowerRouter
            amountOut = _executeMultiHopSwap(
                router,
                amountIn,
                minAmountOut,
                path,
                to,
                deadline
            );
        } else {
            // Normal flow for other tokens - transfer to TowerRouter first
            IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

            // Calculate and deduct platform fee
            feeAmount = amountIn.calculateFee(platformFee);
            swapAmount = amountIn - feeAmount;

            // Approve router
            IERC20(tokenIn).safeApprove(router, swapAmount);

            // Execute swap
            amountOut = _executeMultiHopSwap(
                router,
                swapAmount,
                minAmountOut,
                path,
                to,
                deadline
            );

            // Handle fees
            if (feeAmount > 0) {
                _handleFees(tokenIn, feeAmount);
            }
        }

        require(amountOut >= minAmountOut, "Insufficient output amount");

        // Handle fees
        if (feeAmount > 0) {
            _handleFees(tokenIn, feeAmount);
        }

        emit Swap(msg.sender, tokenIn, tokenOut, amountIn, amountOut, feeAmount, path, block.timestamp);
    }

    /**
     * @dev Multi-hop swap across multiple DEXs
     */
    function swapWithSplit(
        SplitSwapParams[] calldata splits,
        address tokenOut,
        uint256 minAmountOut,
        address to,
        uint256 deadline
    ) external nonReentrant whenNotPaused returns (uint256 totalAmountOut) {
        require(splits.length > 0 && splits.length <= 3, "Invalid split count");
        require(minAmountOut > 0, "Invalid minimum output");
        require(to != address(0), "Invalid recipient");

        SwapMath.validateDeadline(deadline);

        address tokenIn = splits[0].path[0];
        uint256 totalFeeAmount = 0;

        // Execute splits
        (totalAmountOut, totalFeeAmount) = _executeSplitSwaps(splits, tokenIn, tokenOut, deadline);

        require(totalAmountOut >= minAmountOut, "Insufficient split output");

        // Transfer total output
        IERC20(tokenOut).safeTransfer(to, totalAmountOut);

        // Handle fees
        if (totalFeeAmount > 0) {
            _handleFees(tokenIn, totalFeeAmount);
        }

        emit Swap(
            msg.sender,
            tokenIn,
            tokenOut,
            _getTotalSplitAmount(splits),
            totalAmountOut,
            totalFeeAmount,
            new address[](0),
            block.timestamp
        );
    }

    /**
     * @dev Internal helper to execute split swaps
     */
    function _executeSplitSwaps(
        SplitSwapParams[] calldata splits,
        address tokenIn,
        address tokenOut,
        uint256 deadline
    ) internal returns (uint256 totalAmountOut, uint256 totalFeeAmount) {
        for (uint256 i = 0; i < splits.length; i++) {
            (uint256 amountOut, uint256 feeAmount) = _executeSingleSplit(
                splits[i],
                tokenIn,
                tokenOut,
                deadline
            );
            totalAmountOut += amountOut;
            totalFeeAmount += feeAmount;
        }
    }

    /**
     * @dev Internal helper to execute a single split
     */
    function _executeSingleSplit(
        SplitSwapParams calldata split,
        address tokenIn,
        address tokenOut,
        uint256 deadline
    ) internal returns (uint256 amountOut, uint256 feeAmount) {
        require(registeredRouters[split.router], "Router not registered");
        require(split.path[split.path.length - 1] == tokenOut, "Invalid output token");

        // Transfer portion from user
        IERC20(tokenIn).safeTransferFrom(
            msg.sender,
            address(this),
            split.amountIn
        );

        // Calculate fee
        feeAmount = split.amountIn.calculateFee(platformFee);
        uint256 swapAmount = split.amountIn - feeAmount;

        // Approve router
        IERC20(tokenIn).safeApprove(split.router, swapAmount);

        // Execute swap
        amountOut = _executeMultiHopSwap(
            split.router,
            swapAmount,
            split.minAmountOut,
            split.path,
            address(this),
            deadline
        );
    }

    /**
     * @dev Receive native token (ETH/ARC)
     */
    receive() external payable {
        emit NativeSwap(msg.sender, msg.value, 0);
    }

    /**
     * @dev Internal function to execute multi-hop swap
     * Supports both IDexRouter interface (e.g., XyloNetAdapter) and Uniswap V2 style routers
     */
    function _executeMultiHopSwap(
        address router,
        uint256 amountIn,
        uint256 minAmountOut,
        address[] calldata path,
        address recipient,
        uint256 deadline
    ) internal returns (uint256 amountOut) {
        require(path.length >= 2, "Invalid path");

        if (usesIDexRouterInterface[router]) {
            // Use IDexRouter interface for adapters like XyloNetAdapter
            require(path.length == 2, "IDexRouter only supports 2-hop swaps");
            
            amountOut = IDexRouter(router).swap(
                path[0],
                path[1],
                amountIn,
                minAmountOut,
                recipient,
                deadline
            );
        } else {
            // Use Uniswap V2 interface for traditional routers
            uint256[] memory amounts = IUniswapV2Router(router).swapExactTokensForTokens(
                amountIn,
                minAmountOut,
                path,
                recipient,
                deadline
            );

            amountOut = amounts[amounts.length - 1];
        }
    }

    /**
     * @dev Handle platform fees - accumulate in contract
     */
    function _handleFees(address token, uint256 feeAmount) internal {
        accumulatedFees[token] += feeAmount;
        emit FeeCollected(token, feeAmount);
    }

    /**
     * @dev Get total amount from split params
     */
    function _getTotalSplitAmount(SplitSwapParams[] calldata splits)
        internal
        pure
        returns (uint256)
    {
        uint256 total = 0;
        for (uint256 i = 0; i < splits.length; i++) {
            total += splits[i].amountIn;
        }
        return total;
    }

    /**
     * @dev Get registered routers
     */
    function getRouters() external view returns (address[] memory) {
        return routers;
    }

    /**
     * @dev Emergency function to recover ERC20 tokens
     */
    function recoverToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    /**
     * @dev Pause/unpause contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // Structs

    struct SplitSwapParams {
        address[] path;
        uint256 amountIn;
        uint256 minAmountOut;
        address router;
    }
}
