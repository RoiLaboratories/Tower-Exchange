import { useState, useCallback } from 'react';

export interface SwapQuote {
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  swapInputAmount?: string; // Net amount after Tower platform fee, normalized to 18 decimals
  outputAmount: string;
  minOut: string;
  priceImpact: string | number;
  gasEstimate?: string;
  slippage?: number; // in basis points
  exec_price?: number;
  feeBps?: number;
  feeMode?: 'tower-swap-executor' | 'none';
  platformFeeAmount?: string; // Platform fee in input token, normalized to 18 decimals
  route: {
    type: 'single' | 'multi' | 'split';
    rawPath?: string;
    totalFee?: number; // in basis points
    estimatedOutput?: string;
    hops: Array<{
      dexId: string; // DEX identifier from backend
      dex?: string;
      dexName?: string; // Router name (e.g., "XyloNet Adapter", "Synthra")
      dexRouter?: string; // Router contract address
      path: string[];
      feeTier?: number;
      feeTiers?: number[];
      amountIn: string;
      amountOut: string;
      priceImpact: string | number;
      liquidity?: string; // Liquidity available in the hop
    }>;
  };
  routeOptions?: SwapRouteOption[];
}

export interface SwapRouteOption {
  dexId: string;
  dexName: string;
  outputAmount: string;
  routeType: 'single' | 'multi' | 'split';
  gasEstimate?: string;
  quote: SwapQuote;
  isFallback?: boolean;
}

export interface SwapTransaction {
  to: string;
  data: string;
  value: string;
  from: string;
  gasLimit: string;
  chainId: number;
  platformFeeAmount?: string; // Platform fee in input token native decimals
  expectedUserOutput?: string; // Expected output after fee deduction
  expectedFeeCollectorOutput?: string; // Deprecated: legacy FeeCollector flow only
  feeRecipient?: string;
  feeBps?: number;
  feeMode?: 'tower-swap-executor' | 'none';
  feeToken?: string;
  executorAddress?: string;
}

export interface ApprovalTransaction {
  to: string;
  data: string;
  from: string;
  gasLimit: string;
  value?: string;
  label?: string;
}

interface UseTowerSwapOptions {
  backendUrl?: string;
}

const DEFAULT_BACKEND_URL = '';
const QUOTE_REQUEST_TIMEOUT_MS = 30_000;

/**
 * Custom hook for interacting with Tower Exchange DEX Aggregator backend
 * Handles quote fetching, transaction building, and approvals
 */
export function useTowerSwap(options: UseTowerSwapOptions = {}) {
  const backendUrl = options.backendUrl || DEFAULT_BACKEND_URL;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch swap quote from backend
   */
  const getQuote = useCallback(
    async (
      inputToken: string,
      outputToken: string,
      inputAmount: string,
      slippageTolerance: number = 50, // 0.5% default
      dexId?: string
    ): Promise<SwapQuote | null> => {
      setIsLoading(true);
      setError(null);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), QUOTE_REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(`${backendUrl}/api/swap/quote`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputToken,
            outputToken,
            inputAmount,
            slippageTolerance,
            dexId,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          let errorMessage = `Failed to get quote: ${response.statusText}`;

          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            const errorText = await response.text().catch(() => '');
            if (errorText) {
              errorMessage = errorText;
            }
          }

          throw new Error(errorMessage);
        }

        const responseData = await response.json();
        // Backend wraps response in {success, data, timestamp}
        const quote: SwapQuote = responseData.data || responseData;
        return quote;
      } catch (err) {
        const errorMessage =
          err instanceof Error && err.name === 'AbortError'
            ? 'Quote request timed out. Please try again.'
            : err instanceof Error
              ? err.message
              : 'Failed to fetch quote';
        setError(errorMessage);
        console.error('Quote fetch error:', err);
        return null;
      } finally {
        clearTimeout(timeoutId);
        setIsLoading(false);
      }
    },
    [backendUrl]
  );

  /**
   * Build swap transaction from quote (returns both approval + swap if needed)
   */
  const buildSwapTransaction = useCallback(
    async (
      quote: SwapQuote,
      userAddress: string,
      referrer?: string,
      walletBalance?: string
    ): Promise<{ approval?: ApprovalTransaction | ApprovalTransaction[] | null; swap: SwapTransaction } | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${backendUrl}/api/swap/build-tx`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            quote,
            userAddress,
            referrer,
            walletBalance,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || `Failed to build transaction: ${response.statusText}`
          );
        }

        const responseData = await response.json();
        // Backend returns { success, data: { approval?, swap }, timestamp }
        const transactions = responseData.data || { approval: null, swap: responseData };
        return {
          approval: transactions.approval || null,
          swap: transactions.swap,
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to build transaction';
        setError(errorMessage);
        console.error('Build transaction error:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [backendUrl]
  );

  /**
   * Build approval transaction for a token
   */
  const buildApprovalTransaction = useCallback(
    async (
      tokenAddress: string,
      spenderAddress: string,
      amount: string,
      userAddress: string
    ): Promise<ApprovalTransaction | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${backendUrl}/api/swap/approval`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tokenAddress,
            spenderAddress,
            amount,
            userAddress,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || `Failed to build approval: ${response.statusText}`
          );
        }

        const tx: ApprovalTransaction = await response.json();
        return tx;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to build approval';
        setError(errorMessage);
        console.error('Build approval error:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [backendUrl]
  );

  /**
   * Get available DEXes
   */
  const getAvailableDexes = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${backendUrl}/api/swap/dexes`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch DEXes: ${response.statusText}`);
      }

      const dexes = await response.json();
      return dexes;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch DEXes';
      setError(errorMessage);
      console.error('Fetch DEXes error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl]);

  /**
   * Get gas prices from backend
   */
  const getGasPrices = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${backendUrl}/api/swap/gas-price`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch gas prices: ${response.statusText}`);
      }

      const gasPrices = await response.json();
      return gasPrices;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch gas prices';
      setError(errorMessage);
      console.error('Fetch gas prices error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl]);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // Methods
    getQuote,
    buildSwapTransaction,
    buildApprovalTransaction,
    getAvailableDexes,
    getGasPrices,
    clearError,

    // State
    isLoading,
    error,
  };
}

export default useTowerSwap;

