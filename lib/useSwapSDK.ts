/**
 * React hooks for DEX Aggregator SDK
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { DexAggregatorSDK } from './dexAggregatorSDK';
import {
  Quote,
  SwapTransaction,
  ApprovalTransaction,
  GasEstimate,
  SwapState,
  ExecutionState,
} from './dexAggregatorTypes';

/**
 * useSwapQuote
 * Hook for getting swap quotes from the aggregator
 */
export function useSwapQuote(sdkInstance?: DexAggregatorSDK) {
  const [state, setState] = useState<SwapState>({
    quote: null,
    isLoading: false,
    error: null,
    gasPrice: null,
  });

  const sdk = sdkInstance || createDefaultSDK();

  const getQuote = useCallback(
    async (
      inputToken: string,
      outputToken: string,
      inputAmount: string
    ) => {
      if (!inputAmount || inputAmount === '0') {
        setState((prev) => ({ ...prev, quote: null, error: null }));
        return;
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const quote = await sdk.getQuote(inputToken, outputToken, inputAmount);
        setState((prev) => ({
          ...prev,
          quote,
          isLoading: false,
          error: null,
        }));

        return quote;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to get quote';
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isLoading: false,
          quote: null,
        }));
      }
    },
    [sdk]
  );

  const getGasPrice = useCallback(async () => {
    try {
      const gasPrice = await sdk.getGasPrice();
      setState((prev) => ({ ...prev, gasPrice }));
      return gasPrice;
    } catch (error) {
      console.error('Failed to get gas price:', error);
    }
  }, [sdk]);

  return {
    ...state,
    getQuote,
    getGasPrice,
  };
}

/**
 * useSwapExecution
 * Hook for executing swaps
 */
export function useSwapExecution(sdkInstance?: DexAggregatorSDK) {
  const [state, setState] = useState<ExecutionState>({
    txHash: null,
    isExecuting: false,
    error: null,
    isApproved: false,
    approvalTxHash: null,
  });

  const sdk = sdkInstance || createDefaultSDK();

  const buildSwapTx = useCallback(
    async (quote: Quote, userAddress: string, referrer?: string) => {
      setState((prev) => ({ ...prev, isExecuting: true, error: null }));

      try {
        const tx = await sdk.buildSwapTransaction(quote, userAddress, referrer);
        return tx;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to build transaction';
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isExecuting: false,
        }));
        throw error;
      }
    },
    [sdk]
  );

  const buildApprovalTx = useCallback(
    async (
      tokenAddress: string,
      spenderAddress: string,
      amount: string,
      userAddress: string
    ) => {
      setState((prev) => ({ ...prev, isExecuting: true, error: null }));

      try {
        const tx = await sdk.buildApprovalTransaction(
          tokenAddress,
          spenderAddress,
          amount,
          userAddress
        );
        setState((prev) => ({ ...prev, isApproved: false }));
        return tx;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to build approval';
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isExecuting: false,
        }));
        throw error;
      }
    },
    [sdk]
  );

  const setTxHash = useCallback((txHash: string) => {
    setState((prev) => ({ ...prev, txHash, isExecuting: false }));
  }, []);

  const setApprovalTxHash = useCallback((txHash: string) => {
    setState((prev) => ({ ...prev, approvalTxHash: txHash, isApproved: true }));
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const reset = useCallback(() => {
    setState({
      txHash: null,
      isExecuting: false,
      error: null,
      isApproved: false,
      approvalTxHash: null,
    });
  }, []);

  return {
    ...state,
    buildSwapTx,
    buildApprovalTx,
    setTxHash,
    setApprovalTxHash,
    clearError,
    reset,
  };
}

/**
 * useDexInfo
 * Hook for fetching DEX information
 */
export function useDexInfo(sdkInstance?: DexAggregatorSDK) {
  const [dexes, setDexes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sdk = sdkInstance || createDefaultSDK();

  useEffect(() => {
    const fetchDexes = async () => {
      setIsLoading(true);
      try {
        const data = await sdk.getDexes();
        setDexes(data.data || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch DEXes');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDexes();
  }, [sdk]);

  return { dexes, isLoading, error };
}

/**
 * useTokenPrice
 * Hook for fetching current token prices
 */
export function useTokenPrice(
  token0: string,
  token1: string,
  dex?: string,
  sdkInstance?: DexAggregatorSDK
) {
  const [price, setPrice] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sdk = sdkInstance || createDefaultSDK();

  useEffect(() => {
    if (!token0 || !token1) return;

    const fetchPrice = async () => {
      setIsLoading(true);
      try {
        const data = await sdk.getPrice(token0, token1, dex);
        setPrice(data.data?.price || null);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch price');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrice();
  }, [token0, token1, dex, sdk]);

  return { price, isLoading, error };
}

/**
 * Helper to create default SDK instance
 */
function createDefaultSDK(): DexAggregatorSDK {
  return new DexAggregatorSDK({
    apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    chainId: 5042002, // Arc testnet
  });
}
