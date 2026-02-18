/**
 * Synthra V3 Pool Registry for Arc Testnet
 * Maps token pairs to their specific V3 pool addresses
 * All swaps route through UniversalRouter: 0xbf4479c07dc6fdc6daa764a0cca06969e894275f
 */

export interface SynthraPoolInfo {
  poolAddress: string;
  token0: string;
  token1: string;
  symbol: string;
  fee?: number; // Fee tier if available
}

// Synthra UniversalRouter address (all swaps route through this)
export const SYNTHRA_UNIVERSAL_ROUTER = '0xbf4479c07dc6fdc6daa764a0cca06969e894275f';

// Token addresses (normalized to lowercase for consistent lookups)
const TOKEN_ADDRESSES = {
  USDC: '0x3600000000000000000000000000000000000000', // Native USDC
  WUSDC: '0x911b4000D3422F482F4062a913885f7b035382Df', // Wrapped USDC (Synthra contract)
  EURC: '0x89b50855aa3be2f677cd6303cec089b5f319d72a',
  USDT: '0x175cdb1d338945f0d851a741ccf787d343e57952',
  SYN: '0xc5124c846c6e6307986988dfb7e743327aa05f19',
};

// Token mapping for substitution (e.g., USDC -> WUSDC if no direct pool)
const TOKEN_SUBSTITUTION_MAP: Record<string, string> = {
  // USDC native token can be swapped using WUSDC pools
  [TOKEN_ADDRESSES.USDC.toLowerCase()]: TOKEN_ADDRESSES.WUSDC.toLowerCase(),
};

// Synthra V3 Pool Registry
// Maps pool identifiers to pool information
export const synthraV3Pools: Record<string, SynthraPoolInfo> = {
  // WUSDC/EURC pool
  'WUSDC-EURC': {
    poolAddress: '0xE8629e0d6e7aE6D68f50e1a1DBC35af3c3ce4CDA',
    token0: TOKEN_ADDRESSES.WUSDC,
    token1: TOKEN_ADDRESSES.EURC,
    symbol: 'WUSDC/EURC',
  },
  // WUSDC/USDT pool
  'WUSDC-USDT': {
    poolAddress: '0x11DAf9C0b69Ad392635951C2fc7bD1d5F84fE752',
    token0: TOKEN_ADDRESSES.WUSDC,
    token1: TOKEN_ADDRESSES.USDT,
    symbol: 'WUSDC/USDT',
  },
  // WUSDC/SYN pool
  'WUSDC-SYN': {
    poolAddress: '0xE753901d8bbD6162011b473deAf7361efc44BDb4',
    token0: TOKEN_ADDRESSES.WUSDC,
    token1: TOKEN_ADDRESSES.SYN,
    symbol: 'WUSDC/SYN',
  },
  // USDT/SYN pool
  'USDT-SYN': {
    poolAddress: '0xC502558241c1A1d88c39dE2047df454798A5e5B3',
    token0: TOKEN_ADDRESSES.USDT,
    token1: TOKEN_ADDRESSES.SYN,
    symbol: 'USDT/SYN',
  },
  // USDT/EURC pool
  'USDT-EURC': {
    poolAddress: '0x66A038f2f6000cf42D34C3cCD6C97Ccfa16443bd',
    token0: TOKEN_ADDRESSES.USDT,
    token1: TOKEN_ADDRESSES.EURC,
    symbol: 'USDT/EURC',
  },
  // SYN/EURC pool
  'SYN-EURC': {
    poolAddress: '0x4F329e848d51cE1716c7080a26272Df483bFB88A',
    token0: TOKEN_ADDRESSES.SYN,
    token1: TOKEN_ADDRESSES.EURC,
    symbol: 'SYN/EURC',
  },
};

/**
 * Get pool address for a token pair
 * Automatically determines correct order and returns pool address
 * Supports token substitution (e.g., USDC -> WUSDC) when direct pool not available
 */
export function getSynthraPoolForPair(token0: string, token1: string): SynthraPoolInfo | null {
  const normalized0 = token0.toLowerCase();
  const normalized1 = token1.toLowerCase();

  // Try direct lookup first
  for (const [, pool] of Object.entries(synthraV3Pools)) {
    const poolToken0 = pool.token0.toLowerCase();
    const poolToken1 = pool.token1.toLowerCase();

    // Check both directions
    if (
      (normalized0 === poolToken0 && normalized1 === poolToken1) ||
      (normalized0 === poolToken1 && normalized1 === poolToken0)
    ) {
      return pool;
    }
  }

  // If no direct pool found, try token substitution
  // Handle case where USDC needs to use WUSDC pool
  let substituted0 = normalized0;
  let substituted1 = normalized1;

  if (TOKEN_SUBSTITUTION_MAP[normalized0]) {
    substituted0 = TOKEN_SUBSTITUTION_MAP[normalized0];
  }
  if (TOKEN_SUBSTITUTION_MAP[normalized1]) {
    substituted1 = TOKEN_SUBSTITUTION_MAP[normalized1];
  }

  // If substitution occurred, try the lookup again
  if (substituted0 !== normalized0 || substituted1 !== normalized1) {
    for (const [, pool] of Object.entries(synthraV3Pools)) {
      const poolToken0 = pool.token0.toLowerCase();
      const poolToken1 = pool.token1.toLowerCase();

      // Check both directions with substituted tokens
      if (
        (substituted0 === poolToken0 && substituted1 === poolToken1) ||
        (substituted0 === poolToken1 && substituted1 === poolToken0)
      ) {
        return pool;
      }
    }
  }

  return null;
}

/**
 * Get all pool addresses for Synthra
 */
export function getAllSynthraPoolAddresses(): string[] {
  return Object.values(synthraV3Pools).map((pool) => pool.poolAddress);
}

/**
 * Check if Synthra has a pool for the token pair
 */
export function hasSynthraPool(token0: string, token1: string): boolean {
  return getSynthraPoolForPair(token0, token1) !== null;
}

/**
 * Get supported token address
 */
export function getTokenAddress(symbol: string): string | undefined {
  return TOKEN_ADDRESSES[symbol as keyof typeof TOKEN_ADDRESSES];
}

/**
 * Get all supported Synthra tokens
 */
export function getSynthraTokens(): string[] {
  return Object.values(TOKEN_ADDRESSES);
}
