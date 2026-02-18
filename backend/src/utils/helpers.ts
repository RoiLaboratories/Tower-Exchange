import { BigNumber, ethers } from 'ethers';

export class TokenUtils {
  /**
   * Convert human-readable amount to wei
   */
  static toWei(amount: string | number, decimals: number): string {
    return ethers.utils.parseUnits(String(amount), decimals).toString();
  }

  /**
   * Convert wei to human-readable amount
   */
  static fromWei(weiAmount: string | BigNumber, decimals: number): string {
    const bn = typeof weiAmount === 'string' ? BigNumber.from(weiAmount) : weiAmount;
    return ethers.utils.formatUnits(bn, decimals);
  }

  /**
   * Format token amount with decimals
   */
  static formatAmount(amount: string, decimals: number, displayDecimals: number = 4): string {
    const formatted = this.fromWei(amount, decimals);
    const asNumber = parseFloat(formatted);
    return asNumber.toFixed(displayDecimals);
  }

  /**
   * Parse token amount string (supports both wei and human format)
   */
  static parseAmount(amount: string, decimals: number): string {
    const bn = ethers.utils.parseUnits(amount, decimals);
    return bn.toString();
  }
}

export class SwapMathUtils {
  /**
   * Calculate minimum output amount with slippage
   */
  static calculateMinimumOutputAmount(
    expectedAmount: string,
    slippageBasisPoints: number
  ): string {
    const expected = BigNumber.from(expectedAmount);
    const slippageFactor = BigNumber.from(10000 - slippageBasisPoints);
    const minAmount = expected.mul(slippageFactor).div(10000);
    return minAmount.toString();
  }

  /**
   * Calculate price impact in basis points
   */
  static calculatePriceImpact(
    inputAmount: string,
    outputAmount: string,
    spotPrice: string // output per input
  ): number {
    const input = BigNumber.from(inputAmount);
    const output = BigNumber.from(outputAmount);
    const spot = BigNumber.from(spotPrice);

    if (input.isZero()) return 0;

    // executionPrice = output / input
    // priceImpact = (spotPrice - executionPrice) / spotPrice
    const executionPriceNumerator = output.mul(1000000); // Scale for precision
    const executionPrice = executionPriceNumerator.div(input);
    const spotPriceScaled = spot.mul(1000000);

    if (spotPriceScaled.isZero()) return 0;

    const impactBps = spotPriceScaled
      .sub(executionPrice)
      .mul(10000)
      .div(spotPriceScaled);

    return impactBps.toNumber();
  }

  /**
   * Calculate output amount for Uniswap V2 style AMM
   */
  static calculateAmountOut(
    amountIn: string,
    reserveIn: string,
    reserveOut: string,
    feeBasisPoints: number = 25 // 0.25% default
  ): string {
    const input = BigNumber.from(amountIn);
    const inReserve = BigNumber.from(reserveIn);
    const outReserve = BigNumber.from(reserveOut);

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
  static calculateAmountIn(
    amountOut: string,
    reserveIn: string,
    reserveOut: string,
    feeBasisPoints: number = 25
  ): string {
    const out = BigNumber.from(amountOut);
    const inReserve = BigNumber.from(reserveIn);
    const outReserve = BigNumber.from(reserveOut);

    // Reverse Uniswap formula
    const numerator = inReserve.mul(out).mul(10000);
    const denominator = outReserve.sub(out).mul(10000 - feeBasisPoints);
    const input = numerator.div(denominator).add(1);

    return input.toString();
  }

  /**
   * Calculate fee amount
   */
  static calculateFee(amount: string, feeBasisPoints: number): string {
    const fee = BigNumber.from(amount).mul(feeBasisPoints).div(10000);
    return fee.toString();
  }

  /**
   * Calculate amount after fee deduction
   */
  static subtractFee(amount: string, feeBasisPoints: number): string {
    const fee = this.calculateFee(amount, feeBasisPoints);
    return BigNumber.from(amount).sub(fee).toString();
  }
}

/**
 * Encode Uniswap V2 style function calls
 */
export class EncodingUtils {
  /**
   * Encode swapExactTokensForTokens call
   */
  static encodeSwapExactTokensForTokens(
    amountIn: string,
    minAmountOut: string,
    path: string[],
    to: string,
    deadline: number
  ): string {
    const iface = new ethers.utils.Interface([
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
  static encodeApprove(spender: string, amount: string): string {
    const iface = new ethers.utils.Interface([
      'function approve(address spender, uint256 amount) returns (bool)',
    ]);

    return iface.encodeFunctionData('approve', [spender, amount]);
  }

  /**
   * Encode TowerRouter swap call
   */
  static encodeTowerRouterSwap(
    amountIn: string,
    minAmountOut: string,
    path: string[],
    to: string,
    deadline: number,
    router: string,
    referrer: string
  ): string {
    const iface = new ethers.utils.Interface([
      'function swapExactTokensForTokens(uint256 amountIn, uint256 minAmountOut, address[] path, address to, uint256 deadline, address router, address referrer) returns (uint256)',
    ]);

    return iface.encodeFunctionData('swapExactTokensForTokens', [
      amountIn,
      minAmountOut,
      path,
      to,
      deadline,
      router,
      referrer,
    ]);
  }

  /**
   * Encode StableSwapPool swap call
   * @param i Token index to send (input token index in the pool)
   * @param j Token index to receive (output token index in the pool)
   * @param dx Amount to send (in smallest units of input token)
   */
  static encodeStableSwapPoolSwap(i: number, j: number, dx: string): string {
    const iface = new ethers.utils.Interface([
      'function swap(uint256 i, uint256 j, uint256 dx) returns (uint256)',
    ]);

    return iface.encodeFunctionData('swap', [i, j, dx]);
  }
}

/**
 * Utility for working with addresses and checksums
 */
export class AddressUtils {
  static isValidAddress(address: string): boolean {
    return ethers.utils.isAddress(address);
  }

  static toChecksum(address: string): string {
    return ethers.utils.getAddress(address);
  }

  static areEqual(addr1: string, addr2: string): boolean {
    try {
      return ethers.utils.getAddress(addr1) === ethers.utils.getAddress(addr2);
    } catch {
      return false;
    }
  }

  static sortTokens(token0: string, token1: string): [string, string] {
    const t0 = ethers.utils.getAddress(token0);
    const t1 = ethers.utils.getAddress(token1);
    return t0.toLowerCase() < t1.toLowerCase() ? [t0, t1] : [t1, t0];
  }
}

/**
 * Cache management utilities
 */
export class CacheUtils {
  private static cache = new Map<string, { value: unknown; timestamp: number }>();
  private static ttl = 60 * 1000; // 60 second default TTL

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static set(key: string, value: any, ttlMs: number = CacheUtils.ttl): void {
    CacheUtils.cache.set(key, {
      value,
      timestamp: Date.now() + ttlMs,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static get(key: string): any {
    const item = CacheUtils.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.timestamp) {
      CacheUtils.cache.delete(key);
      return null;
    }

    return item.value;
  }

  static has(key: string): boolean {
    return CacheUtils.get(key) !== null;
  }

  static delete(key: string): void {
    CacheUtils.cache.delete(key);
  }

  static clear(): void {
    CacheUtils.cache.clear();
  }

  static setTTL(ttlMs: number): void {
    CacheUtils.ttl = ttlMs;
  }
}
