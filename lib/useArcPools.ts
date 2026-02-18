import { useState, useCallback } from "react";
import {
  getPoolBalances,
  prepareSwapTransaction,
  listAvailablePools,
  calculatePriceImpact,
  ARC_POOLS,
} from "./arcNetwork";

export interface PoolState {
  balance0: string | null;
  balance1: string | null;
  loading: boolean;
  error: string | null;
}

export interface SwapQuoteState {
  amountOut: string | null;
  priceImpact: number;
  loading: boolean;
  error: string | null;
}

/**
 * Hook for interacting with Arc pools
 */
export function useArcPools() {
  const [poolState, setPoolState] = useState<PoolState>({
    balance0: null,
    balance1: null,
    loading: false,
    error: null,
  });

  const [swapQuote, setSwapQuote] = useState<SwapQuoteState>({
    amountOut: null,
    priceImpact: 0,
    loading: false,
    error: null,
  });

  /**
   * Fetch balances for a specific pool
   */
  const fetchPoolBalances = useCallback(async (poolAddress: string) => {
    setPoolState({ balance0: null, balance1: null, loading: true, error: null });
    try {
      const [bal0, bal1] = await getPoolBalances(poolAddress);
      setPoolState({
        balance0: bal0,
        balance1: bal1,
        loading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch pool balances";
      setPoolState({
        balance0: null,
        balance1: null,
        loading: false,
        error: errorMessage,
      });
    }
  }, []);

  /**
   * Get a swap quote
   */
  const getQuote = useCallback(
    async (
      poolAddress: string
      // Note: Pool-based API is deprecated. Use getSwapQuote with token addresses instead
    ) => {
      setSwapQuote({
        amountOut: null,
        priceImpact: 0,
        loading: true,
        error: null,
      });

      try {
        // Note: For the new token address-based API, this function signature
        // needs to be updated. For now, keeping the pool-based version for backwards compatibility
        const amountOut = BigInt(0).toString(); // Placeholder

        // Fetch pool balances for price impact calculation
        let priceImpact = 0;
        try {
          const [balance0, balance1] = await getPoolBalances(poolAddress);
          priceImpact = calculatePriceImpact(amountOut, balance0, balance1);
        } catch {
          // Price impact calculation is optional
        }

        setSwapQuote({
          amountOut,
          priceImpact,
          loading: false,
          error: null,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to get quote";
        setSwapQuote({
          amountOut: null,
          priceImpact: 0,
          loading: false,
          error: errorMessage,
        });
      }
    },
    []
  );

  /**
   * Prepare a swap transaction for signing
   */
  const prepareSwap = useCallback(
    (
      poolAddress: string,
      tokenInIndex: number,
      tokenOutIndex: number,
      amountIn: string,
    ) => {
      return prepareSwapTransaction(
        tokenInIndex,
        tokenOutIndex,
        amountIn
      );
    },
    []
  );

  return {
    // Pool state
    poolState,
    fetchPoolBalances,

    // Swap state
    swapQuote,
    getQuote,

    // Utilities
    prepareSwap,
    listPools: listAvailablePools,
    routerAddress: ARC_POOLS.router,
  };
}
