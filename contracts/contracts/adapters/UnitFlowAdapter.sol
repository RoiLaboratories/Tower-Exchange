// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IUnitFlowFactory {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
}

interface IUnitFlowV3Pool {
    function token0() external view returns (address);
    function token1() external view returns (address);

    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96,
        bytes calldata data
    ) external returns (int256 amount0, int256 amount1);
}

interface IWUSDC is IERC20 {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
}

/**
 * @title UnitFlowAdapter
 * @dev Direct UnitFlow V3 pool adapter for TowerSwapExecutor.
 *
 * TowerSwapExecutor approves this adapter for the input token and calls
 * swapExactInput(). The adapter avoids UnitFlow UniversalRouter/Permit2 by:
 * - pulling the input from TowerSwapExecutor,
 * - wrapping native Arc USDC into UnitFlow WUSDC when needed,
 * - calling the UnitFlow V3 pool directly,
 * - paying the pool from the callback,
 * - routing output back to TowerSwapExecutor.
 */
contract UnitFlowAdapter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint160 private constant MIN_SQRT_RATIO = 4295128739;
    uint160 private constant MAX_SQRT_RATIO =
        1461446703485210103287273052203988822378723970342;
    uint256 private constant NATIVE_USDC_SCALE = 1e12;

    address public immutable factory;
    address public immutable nativeUsdc;
    address public immutable wusdc;

    struct SwapCallbackData {
        address tokenIn;
        address tokenOut;
        uint24 fee;
    }

    event SwapExecuted(
        address indexed caller,
        address indexed recipient,
        address indexed tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint256 amountOut
    );

    constructor(address _factory, address _nativeUsdc, address _wusdc) {
        require(_factory != address(0), "Invalid factory");
        require(_nativeUsdc != address(0), "Invalid native USDC");
        require(_wusdc != address(0), "Invalid WUSDC");

        factory = _factory;
        nativeUsdc = _nativeUsdc;
        wusdc = _wusdc;
    }

    receive() external payable {}

    function swapExactInput(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        uint256 deadline
    ) external nonReentrant returns (uint256 amountOut) {
        require(block.timestamp <= deadline, "Transaction expired");
        require(tokenIn != address(0), "Invalid tokenIn");
        require(tokenOut != address(0), "Invalid tokenOut");
        require(tokenIn != tokenOut, "Same token pair");
        require(amountIn > 0, "Invalid amountIn");
        require(recipient != address(0), "Invalid recipient");

        if (tokenIn == nativeUsdc) {
            amountOut = _swapNativeUsdcToToken(
                tokenOut,
                fee,
                amountIn,
                minAmountOut,
                recipient
            );
        } else if (tokenOut == nativeUsdc) {
            amountOut = _swapTokenToNativeUsdc(
                tokenIn,
                fee,
                amountIn,
                minAmountOut,
                recipient
            );
        } else {
            IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
            amountOut = _swapPoolExactInput(
                tokenIn,
                tokenOut,
                fee,
                amountIn,
                minAmountOut,
                recipient
            );
        }

        emit SwapExecuted(
            msg.sender,
            recipient,
            tokenIn,
            tokenOut,
            fee,
            amountIn,
            amountOut
        );
    }

    function unitFlowV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external {
        _handleSwapCallback(amount0Delta, amount1Delta, data);
    }

    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external {
        _handleSwapCallback(amount0Delta, amount1Delta, data);
    }

    function recoverToken(address token, address recipient, uint256 amount) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        IERC20(token).safeTransfer(recipient, amount);
    }

    function recoverNative(address payable recipient, uint256 amount) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Native recovery failed");
    }

    function _swapNativeUsdcToToken(
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) private returns (uint256 amountOut) {
        uint256 nativeBefore = address(this).balance;
        IERC20(nativeUsdc).safeTransferFrom(msg.sender, address(this), amountIn);
        uint256 nativeReceived = address(this).balance - nativeBefore;
        require(nativeReceived > 0, "No native USDC received");

        uint256 expectedNative = amountIn * NATIVE_USDC_SCALE;
        require(nativeReceived >= expectedNative, "Invalid native USDC scale");

        IWUSDC(wusdc).deposit{value: nativeReceived}();

        amountOut = _swapPoolExactInput(
            wusdc,
            tokenOut,
            fee,
            nativeReceived,
            minAmountOut,
            recipient
        );
    }

    function _swapTokenToNativeUsdc(
        address tokenIn,
        uint24 fee,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) private returns (uint256 amountOut) {
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        uint256 minWusdcOut = minAmountOut * NATIVE_USDC_SCALE;
        uint256 wusdcOut = _swapPoolExactInput(
            tokenIn,
            wusdc,
            fee,
            amountIn,
            minWusdcOut,
            address(this)
        );

        IWUSDC(wusdc).withdraw(wusdcOut);

        amountOut = wusdcOut / NATIVE_USDC_SCALE;
        require(amountOut >= minAmountOut, "Insufficient output amount");
        IERC20(nativeUsdc).safeTransfer(recipient, amountOut);
    }

    function _swapPoolExactInput(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) private returns (uint256 amountOut) {
        address pool = IUnitFlowFactory(factory).getPool(tokenIn, tokenOut, fee);
        require(pool != address(0), "UnitFlow pool not found");

        address token0 = IUnitFlowV3Pool(pool).token0();
        address token1 = IUnitFlowV3Pool(pool).token1();
        require(
            (tokenIn == token0 && tokenOut == token1) ||
                (tokenIn == token1 && tokenOut == token0),
            "Pool token mismatch"
        );

        bool zeroForOne = tokenIn == token0;
        (int256 amount0Delta, int256 amount1Delta) = IUnitFlowV3Pool(pool).swap(
            recipient,
            zeroForOne,
            int256(amountIn),
            zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1,
            abi.encode(SwapCallbackData({tokenIn: tokenIn, tokenOut: tokenOut, fee: fee}))
        );

        int256 outputDelta = zeroForOne ? amount1Delta : amount0Delta;
        require(outputDelta < 0, "Invalid output delta");
        amountOut = uint256(-outputDelta);
        require(amountOut >= minAmountOut, "Insufficient output amount");
    }

    function _handleSwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) private {
        require(amount0Delta > 0 || amount1Delta > 0, "No payment required");

        SwapCallbackData memory decoded = abi.decode(data, (SwapCallbackData));
        address expectedPool = IUnitFlowFactory(factory).getPool(
            decoded.tokenIn,
            decoded.tokenOut,
            decoded.fee
        );
        require(msg.sender == expectedPool, "Invalid callback sender");

        address token0 = IUnitFlowV3Pool(msg.sender).token0();
        address token1 = IUnitFlowV3Pool(msg.sender).token1();
        address tokenToPay = amount0Delta > 0 ? token0 : token1;
        uint256 amountToPay = amount0Delta > 0
            ? uint256(amount0Delta)
            : uint256(amount1Delta);

        require(tokenToPay == decoded.tokenIn, "Invalid callback token");
        IERC20(tokenToPay).safeTransfer(msg.sender, amountToPay);
    }
}
