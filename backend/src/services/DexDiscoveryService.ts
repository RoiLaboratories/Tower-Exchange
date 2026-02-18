import { ethers } from 'ethers';
import { DexInfo, PoolData, ArcTestnetConfig } from '../types';
import { CacheUtils } from '../utils/helpers';
import { getTokenSymbol } from '../utils/tokenRegistry';
import { getSynthraPoolForPair, SYNTHRA_UNIVERSAL_ROUTER } from '../utils/SynthraPoolRegistry';

/**
 * DexDiscoveryService
 * Manages known DEXs and their pool configurations on Arc testnet
 */
export class DexDiscoveryService {
  private dexes: Map<string, DexInfo> = new Map();
  private poolCache: Map<string, PoolData> = new Map();


  // Known DEXs on Arc testnet
  private arcTestnetDexes: DexInfo[] = [
    {
      id: 'synthra',
      name: 'Synthra',
      routerAddress: '0xbf4479c07dc6fdc6daa764a0cca06969e894275f',
      factoryAddress: '0x0fB6EEDA6e90E90797083861A75D15752a27f59c',
      type: 'v3',
      chainId: 5042002,
      enabled: true,
      // Support USDC (native), WUSDC (Synthra), EURC, SYN, USDT token pairs
      supportedTokens: [
        '0x3600000000000000000000000000000000000000', // USDC (native)
        '0x911b4000D3422F482F4062a913885f7b035382Df', // WUSDC (Synthra contract)
        '0x89b50855aa3be2f677cd6303cec089b5f319d72a', // EURC
        '0xc5124c846c6e6307986988dfb7e743327aa05f19', // SYN
        '0x175cdb1d338945f0d851a741ccf787d343e57952', // USDT
      ],
    },
    {
      id: 'swaparc',
      name: 'Swaparc (StableSwapPool)',
      routerAddress: '0x2F4490e7c6F3DaC23ffEe6e71bFcb5d1CCd7d4eC',
      factoryAddress: '0x2F4490e7c6F3DaC23ffEe6e71bFcb5d1CCd7d4eC', // Same as router (single pool)
      type: 'stable',
      chainId: 5042002,
      enabled: true,
      // Support stablecoin swaps: USDC, USDT, EURC, SWPRC
      supportedTokens: [
        '0x3600000000000000000000000000000000000000', // USDC
        '0x175cdb1d338945f0d851a741ccf787d343e57952', // USDT
        '0x89b50855aa3be2f677cd6303cec089b5f319d72a', // EURC
        '0xbe7477bf91526fc9988c8f33e91b6db687119d45', // SWPRC
      ],
    },
    {
      id: 'quantum-exchange',
      name: 'Quantum Exchange',
      routerAddress: '0x9d52b6c810d6F95e3d44ca64af3B55F7F66448FF',
      factoryAddress: '0xD330Ae5713AF6507f43420e85C941a68BfbaD9D0',
      type: 'v2',
      chainId: 5042002,
      enabled: true,
      // Support USDC, WUSDC, QTM
      supportedTokens: [
        '0x3600000000000000000000000000000000000000', // USDC
        '0xd40fcaa5d2ce963c5dabc2bf59e268489ad7bce4', // WUSDC
        '0xcd304d2a421bfed31d45f0054af8e8a6a4cf3eae', // QTM
      ],
    },
  ];

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_provider: ethers.providers.Provider, _config: ArcTestnetConfig) {
    this.initializeDexes();
  }

  /**
   * Initialize known DEXes
   */
  private initializeDexes(): void {
    this.arcTestnetDexes.forEach((dex) => {
      this.dexes.set(dex.id, dex);
    });
  }

  /**
   * Register a custom DEX
   */
  registerDex(dex: DexInfo): void {
    this.dexes.set(dex.id, dex);
  }

  /**
   * Get all available DEXes
   */
  getAllDexes(): DexInfo[] {
    return Array.from(this.dexes.values()).filter((d) => d.enabled);
  }

  /**
   * Get DEX by ID
   */
  getDexById(dexId: string): DexInfo | undefined {
    return this.dexes.get(dexId);
  }

  /**
   * Get DEXes that support specific token pair
   */
  getDexesSupportingPair(token0: string, token1: string): DexInfo[] {
    // Normalize addresses to lowercase for comparison
    const normalizedToken0 = token0.toLowerCase();
    const normalizedToken1 = token1.toLowerCase();

    return this.getAllDexes().filter((dex) => {
      if (dex.supportedTokens.length === 0) return true; // Support all if not restricted
      const supportedLower = dex.supportedTokens.map((t) => t.toLowerCase());
      return (
        supportedLower.includes(normalizedToken0) && supportedLower.includes(normalizedToken1)
      );
    });
  }

  /**
   * Get token symbol by address (for logging/debugging)
   */
  getTokenSymbol(tokenAddress: string): string {
    const symbol = getTokenSymbol(tokenAddress);
    return symbol || `${tokenAddress.substring(0, 6)}...${tokenAddress.substring(-4)}`;
  }

  /**
   * Get Synthra pool address for a token pair
   */
  getSynthraPoolAddress(token0: string, token1: string): string | null {
    const poolInfo = getSynthraPoolForPair(token0, token1);
    if (!poolInfo) return null;
    return poolInfo.poolAddress;
  }

  /**
   * Get Synthra UniversalRouter address
   */
  getSynthraUniversalRouter(): string {
    return SYNTHRA_UNIVERSAL_ROUTER;
  }

  /**
   * Fetch live pool reserves for a token pair from a DEX
   * Returns formatted pool data with reserves
   */
  async getPoolReserves(
    dexId: string,
    token0: string,
    token1: string
  ): Promise<PoolData | null> {
    const cacheKey = `pool:${dexId}:${token0}:${token1}`;

    // Check cache first
    const cached = CacheUtils.get(cacheKey);
    if (cached) return cached;

    try {
      const dex = this.getDexById(dexId);
      if (!dex) {
        console.error(`DEX ${dexId} not found`);
        return null;
      }

      // For production, implement actual pool fetching logic
      // This would call the DEX factory to get pair address and reserves
      const poolData: PoolData = {
        id: `${dexId}:${token0}:${token1}`,
        dexId,
        token0,
        token1,
        reserve0: '0',
        reserve1: '0',
        lastUpdated: Date.now(),
      };

      // Cache for 30 seconds
      CacheUtils.set(cacheKey, poolData, 30 * 1000);
      this.poolCache.set(poolData.id, poolData);

      return poolData;
    } catch (error) {
      console.error(`Error fetching pool reserves for ${dexId}:`, error);
      return null;
    }
  }

  /**
   * Fetch price from a specific DEX pool
   */
  async getPrice(
    dexId: string,
    token0: string,
    token1: string
  ): Promise<number | null> {
    const pool = await this.getPoolReserves(dexId, token0, token1);
    if (!pool || pool.reserve0 === '0' || pool.reserve1 === '0') {
      return null;
    }

    try {
      const reserve0 = ethers.BigNumber.from(pool.reserve0);
      const reserve1 = ethers.BigNumber.from(pool.reserve1);
      const price = reserve1.mul(1e18).div(reserve0).toNumber() / 1e18;
      return price;
    } catch (error) {
      console.error('Error calculating price:', error);
      return null;
    }
  }

  /**
   * Get best price across all DEXes for a token pair
   */
  async getBestPrice(token0: string, token1: string): Promise<{ dexId: string; price: number } | null> {
    const supportedDexes = this.getDexesSupportingPair(token0, token1);

    let bestPrice: number | null = null;
    let bestDexId: string | null = null;

    for (const dex of supportedDexes) {
      const price = await this.getPrice(dex.id, token0, token1);
      if (price && (bestPrice === null || price > bestPrice)) {
        bestPrice = price;
        bestDexId = dex.id;
      }
    }

    return bestPrice && bestDexId ? { dexId: bestDexId, price: bestPrice } : null;
  }

  /**
   * Get all pools for a specific token
   */
  async getPoolsForToken(token: string): Promise<PoolData[]> {
    const pools: PoolData[] = [];

    for (const pool of this.poolCache.values()) {
      if (pool.token0 === token || pool.token1 === token) {
        pools.push(pool);
      }
    }

    return pools;
  }

  /**
   * Verify token pair exists on a DEX
   */
  async pairExists(dexId: string, token0: string, token1: string): Promise<boolean> {
    try {
      const pool = await this.getPoolReserves(dexId, token0, token1);
      return pool !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get liquidity depth for a token pair
   */
  async getLiquidityDepth(
    dexId: string,
    token0: string,
    token1: string,
    amountIn: string
  ): Promise<{ available: boolean; depth: number } | null> {
    try {
      const pool = await this.getPoolReserves(dexId, token0, token1);
      if (!pool) return null;

      const reserve0 = ethers.BigNumber.from(pool.reserve0);
      const amountInBn = ethers.BigNumber.from(amountIn);

      // Calculate what percentage of liquidity we're using
      const depth = amountInBn.mul(100).div(reserve0).toNumber();

      return {
        available: depth < 30, // Warn if > 30% of pool
        depth,
      };
    } catch (error) {
      console.error('Error calculating liquidity depth:', error);
      return null;
    }
  }

  /**
   * Clear pool cache (useful for forced refresh)
   */
  clearCache(): void {
    this.poolCache.clear();
    CacheUtils.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { pools: number; cacheSize: number } {
    return {
      pools: this.poolCache.size,
      cacheSize: this.poolCache.size,
    };
  }
}
