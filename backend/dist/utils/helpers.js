"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheUtils = exports.AddressUtils = exports.EncodingUtils = exports.SwapMathUtils = exports.TokenUtils = void 0;
const ethers_1 = require("ethers");
class TokenUtils {
    /**
     * Convert human-readable amount to wei
     */
    static toWei(amount, decimals) {
        return ethers_1.ethers.utils.parseUnits(String(amount), decimals).toString();
    }
    /**
     * Convert wei to human-readable amount
     */
    static fromWei(weiAmount, decimals) {
        const bn = typeof weiAmount === 'string' ? ethers_1.BigNumber.from(weiAmount) : weiAmount;
        return ethers_1.ethers.utils.formatUnits(bn, decimals);
    }
    /**
     * Format token amount with decimals
     */
    static formatAmount(amount, decimals, displayDecimals = 4) {
        const formatted = this.fromWei(amount, decimals);
        const asNumber = parseFloat(formatted);
        return asNumber.toFixed(displayDecimals);
    }
    /**
     * Parse token amount string (supports both wei and human format)
     */
    static parseAmount(amount, decimals) {
        const bn = ethers_1.ethers.utils.parseUnits(amount, decimals);
        return bn.toString();
    }
}
exports.TokenUtils = TokenUtils;
class SwapMathUtils {
    /**
     * Calculate minimum output amount with slippage
     */
    static calculateMinimumOutputAmount(expectedAmount, slippageBasisPoints) {
        const expected = ethers_1.BigNumber.from(expectedAmount);
        const slippageFactor = ethers_1.BigNumber.from(10000 - slippageBasisPoints);
        const minAmount = expected.mul(slippageFactor).div(10000);
        return minAmount.toString();
    }
    /**
     * Calculate price impact in basis points
     */
    static calculatePriceImpact(inputAmount, outputAmount, spotPrice // output per input
    ) {
        const input = ethers_1.BigNumber.from(inputAmount);
        const output = ethers_1.BigNumber.from(outputAmount);
        const spot = ethers_1.BigNumber.from(spotPrice);
        if (input.isZero())
            return 0;
        // executionPrice = output / input
        // priceImpact = (spotPrice - executionPrice) / spotPrice
        const executionPriceNumerator = output.mul(1000000); // Scale for precision
        const executionPrice = executionPriceNumerator.div(input);
        const spotPriceScaled = spot.mul(1000000);
        if (spotPriceScaled.isZero())
            return 0;
        const impactBps = spotPriceScaled
            .sub(executionPrice)
            .mul(10000)
            .div(spotPriceScaled);
        return impactBps.toNumber();
    }
    /**
     * Calculate output amount for Uniswap V2 style AMM
     */
    static calculateAmountOut(amountIn, reserveIn, reserveOut, feeBasisPoints = 25 // 0.25% default
    ) {
        const input = ethers_1.BigNumber.from(amountIn);
        const inReserve = ethers_1.BigNumber.from(reserveIn);
        const outReserve = ethers_1.BigNumber.from(reserveOut);
        // Apply fee: amountInWithFee = amountIn * (10000 - fee)
        const amountInWithFee = input.mul(10000 - feeBasisPoints);
        // Formula: output = (input * 997/1000) * reserve_out / (reserve_in + input * 997/1000)
        const numerator = amountInWithFee.mul(outReserve);
        const denominator = inReserve.mul(10000).add(amountInWithFee);
        const output = numerator.div(denominator);
        return output.toString();
    }
    /**
     * Calculate input amount needed for desired output (reverse calculation)
     */
    static calculateAmountIn(amountOut, reserveIn, reserveOut, feeBasisPoints = 25) {
        const out = ethers_1.BigNumber.from(amountOut);
        const inReserve = ethers_1.BigNumber.from(reserveIn);
        const outReserve = ethers_1.BigNumber.from(reserveOut);
        // Reverse Uniswap formula
        const numerator = inReserve.mul(out).mul(10000);
        const denominator = outReserve.sub(out).mul(10000 - feeBasisPoints);
        const input = numerator.div(denominator).add(1);
        return input.toString();
    }
    /**
     * Calculate fee amount
     */
    static calculateFee(amount, feeBasisPoints) {
        const fee = ethers_1.BigNumber.from(amount).mul(feeBasisPoints).div(10000);
        return fee.toString();
    }
    /**
     * Calculate amount after fee deduction
     */
    static subtractFee(amount, feeBasisPoints) {
        const fee = this.calculateFee(amount, feeBasisPoints);
        return ethers_1.BigNumber.from(amount).sub(fee).toString();
    }
}
exports.SwapMathUtils = SwapMathUtils;
/**
 * Encode Uniswap V2 style function calls
 */
class EncodingUtils {
    /**
     * Encode swapExactTokensForTokens call
     */
    static encodeSwapExactTokensForTokens(amountIn, minAmountOut, path, to, deadline) {
        const iface = new ethers_1.ethers.utils.Interface([
            'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)',
        ]);
        return iface.encodeFunctionData('swapExactTokensForTokens', [
            amountIn,
            minAmountOut,
            path,
            to,
            deadline,
        ]);
    }
    /**
     * Encode approve call
     */
    static encodeApprove(spender, amount) {
        const iface = new ethers_1.ethers.utils.Interface([
            'function approve(address spender, uint256 amount) returns (bool)',
        ]);
        return iface.encodeFunctionData('approve', [spender, amount]);
    }
    /**
     * Encode TowerRouter swap call
     */
    static encodeTowerRouterSwap(amountIn, minAmountOut, path, to, deadline, router) {
        const iface = new ethers_1.ethers.utils.Interface([
            'function swapExactTokensForTokens(uint256 amountIn, uint256 minAmountOut, address[] path, address to, uint256 deadline, address router) returns (uint256)',
        ]);
        return iface.encodeFunctionData('swapExactTokensForTokens', [
            amountIn,
            minAmountOut,
            path,
            to,
            deadline,
            router,
        ]);
    }
    /**
     * Encode IDexRouter swap call (for direct DEX router calls like XyloNet)
     * Used when DEX router is called directly instead of through TowerRouter
     */
    static encodeIDexRouterSwap(tokenIn, tokenOut, amountIn, minAmountOut, recipient, deadline) {
        const iface = new ethers_1.ethers.utils.Interface([
            'function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address recipient, uint256 deadline) returns (uint256)',
        ]);
        return iface.encodeFunctionData('swap', [
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut,
            recipient,
            deadline,
        ]);
    }
    /**
     * Encode XyloRouter swap call with tuple params
     * XyloRouter.swap expects: tuple(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address to, uint256 deadline)
     */
    static encodeXyloRouterSwap(tokenIn, tokenOut, amountIn, minAmountOut, recipient, deadline) {
        const iface = new ethers_1.ethers.utils.Interface([
            'function swap(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address to, uint256 deadline) params) external returns (uint256)',
        ]);
        return iface.encodeFunctionData('swap', [
            {
                tokenIn,
                tokenOut,
                amountIn,
                minAmountOut,
                to: recipient,
                deadline,
            },
        ]);
    }
    /**
     * Encode StableSwapPool swap call
     * @param i Token index to send (input token index in the pool)
     * @param j Token index to receive (output token index in the pool)
     * @param dx Amount to send (in smallest units of input token)
     */
    static encodeStableSwapPoolSwap(i, j, dx) {
        const iface = new ethers_1.ethers.utils.Interface([
            'function swap(uint256 i, uint256 j, uint256 dx) returns (uint256)',
        ]);
        return iface.encodeFunctionData('swap', [i, j, dx]);
    }
}
exports.EncodingUtils = EncodingUtils;
/**
 * Utility for working with addresses and checksums
 */
class AddressUtils {
    static isValidAddress(address) {
        return ethers_1.ethers.utils.isAddress(address);
    }
    static toChecksum(address) {
        return ethers_1.ethers.utils.getAddress(address);
    }
    static areEqual(addr1, addr2) {
        try {
            return ethers_1.ethers.utils.getAddress(addr1) === ethers_1.ethers.utils.getAddress(addr2);
        }
        catch {
            return false;
        }
    }
    static sortTokens(token0, token1) {
        const t0 = ethers_1.ethers.utils.getAddress(token0);
        const t1 = ethers_1.ethers.utils.getAddress(token1);
        return t0.toLowerCase() < t1.toLowerCase() ? [t0, t1] : [t1, t0];
    }
}
exports.AddressUtils = AddressUtils;
/**
 * Cache management utilities
 */
class CacheUtils {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static set(key, value, ttlMs = CacheUtils.ttl) {
        CacheUtils.cache.set(key, {
            value,
            timestamp: Date.now() + ttlMs,
        });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static get(key) {
        const item = CacheUtils.cache.get(key);
        if (!item)
            return null;
        if (Date.now() > item.timestamp) {
            CacheUtils.cache.delete(key);
            return null;
        }
        return item.value;
    }
    static has(key) {
        return CacheUtils.get(key) !== null;
    }
    static delete(key) {
        CacheUtils.cache.delete(key);
    }
    static clear() {
        CacheUtils.cache.clear();
    }
    static setTTL(ttlMs) {
        CacheUtils.ttl = ttlMs;
    }
}
exports.CacheUtils = CacheUtils;
CacheUtils.cache = new Map();
CacheUtils.ttl = 60 * 1000; // 60 second default TTL
//# sourceMappingURL=helpers.js.map