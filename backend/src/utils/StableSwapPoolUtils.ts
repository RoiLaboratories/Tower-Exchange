import { ethers } from 'ethers';
import { STABLE_SWAP_POOL_ABI } from './StableSwapPoolABI';

/**
 * Utility class for interacting with Swaparc StableSwapPool
 */
export class StableSwapPoolUtils {
  private tokenIndexCache = new Map<string, Map<string, number>>();

  /**
   * Get token indices for a swap in the StableSwapPool
   * @param poolAddress The StableSwapPool contract address
   * @param provider The ethers provider
   * @param tokenIn Input token address
   * @param tokenOut Output token address
   * @returns Object with tokenInIndex and tokenOutIndex
   */
  async getTokenIndices(
    poolAddress: string,
    provider: ethers.providers.Provider,
    tokenIn: string,
    tokenOut: string
  ): Promise<{ tokenInIndex: number; tokenOutIndex: number }> {
    // Check cache first
    if (this.tokenIndexCache.has(poolAddress)) {
      const poolCache = this.tokenIndexCache.get(poolAddress)!;
      if (poolCache.has(tokenIn) && poolCache.has(tokenOut)) {
        return {
          tokenInIndex: poolCache.get(tokenIn)!,
          tokenOutIndex: poolCache.get(tokenOut)!,
        };
      }
    }

    // Create StableSwapPool contract instance
    const pool = new ethers.Contract(
      poolAddress,
      STABLE_SWAP_POOL_ABI,
      provider
    );

    // Get token count
    const tokenCount = await pool.getTokenCount();

    // Find token indices
    let tokenInIndex = -1;
    let tokenOutIndex = -1;

    for (let i = 0; i < tokenCount; i++) {
      const token = await pool.tokens(i);
      const normalizedToken = ethers.utils.getAddress(token);
      const normalizedTokenIn = ethers.utils.getAddress(tokenIn);
      const normalizedTokenOut = ethers.utils.getAddress(tokenOut);

      if (normalizedToken === normalizedTokenIn) {
        tokenInIndex = i;
      }
      if (normalizedToken === normalizedTokenOut) {
        tokenOutIndex = i;
      }

      // Cache for future lookups
      if (!this.tokenIndexCache.has(poolAddress)) {
        this.tokenIndexCache.set(poolAddress, new Map());
      }
      this.tokenIndexCache.get(poolAddress)!.set(normalizedToken, i);
    }

    if (tokenInIndex === -1 || tokenOutIndex === -1) {
      throw new Error(
        `Token not found in StableSwapPool. TokenIn index: ${tokenInIndex}, TokenOut index: ${tokenOutIndex}`
      );
    }

    return { tokenInIndex, tokenOutIndex };
  }

  /**
   * Calculate expected output for a swap
   */
  async getSwapOutput(
    poolAddress: string,
    provider: ethers.providers.Provider,
    tokenInIndex: number,
    tokenOutIndex: number,
    amountIn: string
  ): Promise<string> {
    const pool = new ethers.Contract(
      poolAddress,
      STABLE_SWAP_POOL_ABI,
      provider
    );

    const output = await pool.get_dy(tokenInIndex, tokenOutIndex, amountIn);
    return output.toString();
  }

  /**
   * Clear cache (useful for resets)
   */
  clearCache(): void {
    this.tokenIndexCache.clear();
  }
}
