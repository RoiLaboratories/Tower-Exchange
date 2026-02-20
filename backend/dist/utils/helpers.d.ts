import { BigNumber } from 'ethers';
export declare class TokenUtils {
    /**
     * Convert human-readable amount to wei
     */
    static toWei(amount: string | number, decimals: number): string;
    /**
     * Convert wei to human-readable amount
     */
    static fromWei(weiAmount: string | BigNumber, decimals: number): string;
    /**
     * Format token amount with decimals
     */
    static formatAmount(amount: string, decimals: number, displayDecimals?: number): string;
    /**
     * Parse token amount string (supports both wei and human format)
     */
    static parseAmount(amount: string, decimals: number): string;
}
export declare class SwapMathUtils {
    /**
     * Calculate minimum output amount with slippage
     */
    static calculateMinimumOutputAmount(expectedAmount: string, slippageBasisPoints: number): string;
    /**
     * Calculate price impact in basis points
     */
    static calculatePriceImpact(inputAmount: string, outputAmount: string, spotPrice: string): number;
    /**
     * Calculate output amount for Uniswap V2 style AMM
     */
    static calculateAmountOut(amountIn: string, reserveIn: string, reserveOut: string, feeBasisPoints?: number): string;
    /**
     * Calculate input amount needed for desired output (reverse calculation)
     */
    static calculateAmountIn(amountOut: string, reserveIn: string, reserveOut: string, feeBasisPoints?: number): string;
    /**
     * Calculate fee amount
     */
    static calculateFee(amount: string, feeBasisPoints: number): string;
    /**
     * Calculate amount after fee deduction
     */
    static subtractFee(amount: string, feeBasisPoints: number): string;
}
/**
 * Encode Uniswap V2 style function calls
 */
export declare class EncodingUtils {
    /**
     * Encode swapExactTokensForTokens call
     */
    static encodeSwapExactTokensForTokens(amountIn: string, minAmountOut: string, path: string[], to: string, deadline: number): string;
    /**
     * Encode approve call
     */
    static encodeApprove(spender: string, amount: string): string;
    /**
     * Encode TowerRouter swap call
     */
    static encodeTowerRouterSwap(amountIn: string, minAmountOut: string, path: string[], to: string, deadline: number, router: string): string;
    /**
     * Encode IDexRouter swap call (for direct DEX router calls like XyloNet)
     * Used when DEX router is called directly instead of through TowerRouter
     */
    static encodeIDexRouterSwap(tokenIn: string, tokenOut: string, amountIn: string, minAmountOut: string, recipient: string, deadline: number): string;
    /**
     * Encode XyloRouter swap call with tuple params
     * XyloRouter.swap expects: tuple(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address to, uint256 deadline)
     */
    static encodeXyloRouterSwap(tokenIn: string, tokenOut: string, amountIn: string, minAmountOut: string, recipient: string, deadline: number): string;
    /**
     * Encode StableSwapPool swap call
     * @param i Token index to send (input token index in the pool)
     * @param j Token index to receive (output token index in the pool)
     * @param dx Amount to send (in smallest units of input token)
     */
    static encodeStableSwapPoolSwap(i: number, j: number, dx: string): string;
}
/**
 * Utility for working with addresses and checksums
 */
export declare class AddressUtils {
    static isValidAddress(address: string): boolean;
    static toChecksum(address: string): string;
    static areEqual(addr1: string, addr2: string): boolean;
    static sortTokens(token0: string, token1: string): [string, string];
}
/**
 * Cache management utilities
 */
export declare class CacheUtils {
    private static cache;
    private static ttl;
    static set(key: string, value: any, ttlMs?: number): void;
    static get(key: string): any;
    static has(key: string): boolean;
    static delete(key: string): void;
    static clear(): void;
    static setTTL(ttlMs: number): void;
}
//# sourceMappingURL=helpers.d.ts.map