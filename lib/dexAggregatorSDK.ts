/**
 * Tower Finance DEX Aggregator SDK
 * Frontend integration layer for swap functionality
 */

import { Quote, SwapTransaction, ApprovalTransaction, GasEstimate } from './dexAggregatorTypes';

export interface DexAggregatorConfig {
  apiUrl: string;
  chainId: number;
  timeout?: number;
  retryAttempts?: number;
}

export interface SwapExecutionResult {
  success: boolean;
  txHash?: string;
  error?: string;
  estimatedGas?: string;
}

/**
 * DexAggregatorSDK
 * Main SDK class for interacting with the DEX aggregator backend
 */
export class DexAggregatorSDK {
  private apiUrl: string;
  private chainId: number;
  private timeout: number;
  private retryAttempts: number;

  constructor(config: DexAggregatorConfig) {
    this.apiUrl = config.apiUrl;
    this.chainId = config.chainId;
    this.timeout = config.timeout || 30000;
    this.retryAttempts = config.retryAttempts || 3;

    if (!this.apiUrl) {
      throw new Error('API URL is required');
    }
  }

  /**
   * Get optimized swap quote
   * @param inputToken Input token address
   * @param outputToken Output token address
   * @param inputAmount Input amount in wei
   * @returns Quote object with route details
   */
  async getQuote(
    inputToken: string,
    outputToken: string,
    inputAmount: string
  ): Promise<Quote> {
    return this._request<Quote>('/quote', {
      method: 'POST',
      body: JSON.stringify({
        inputToken,
        outputToken,
        inputAmount,
      }),
    });
  }

  /**
   * Build executable swap transaction
   * @param quote Quote object from getQuote
   * @param userAddress User's wallet address
   * @param referrer Optional referrer address for rewards
   * @returns Transaction data ready for signing
   */
  async buildSwapTransaction(
    quote: Quote,
    userAddress: string,
    referrer?: string
  ): Promise<SwapTransaction> {
    return this._request<SwapTransaction>('/build-tx', {
      method: 'POST',
      body: JSON.stringify({
        quote,
        userAddress,
        referrer: referrer || address(0),
      }),
    });
  }

  /**
   * Build approval transaction for token
   * @param tokenAddress Token to approve
   * @param spenderAddress Router contract address
   * @param amount Amount to approve (use MaxUint256 for unlimited)
   * @param userAddress User's wallet address
   * @returns Approval transaction data
   */
  async buildApprovalTransaction(
    tokenAddress: string,
    spenderAddress: string,
    amount: string,
    userAddress: string
  ): Promise<ApprovalTransaction> {
    return this._request<ApprovalTransaction>('/approval', {
      method: 'POST',
      body: JSON.stringify({
        tokenAddress,
        spenderAddress,
        amount,
        userAddress,
      }),
    });
  }

  /**
   * Get list of available DEXes on Arc testnet
   */
  async getDexes() {
    return this._request<any>('/dexes', { method: 'GET' });
  }

  /**
   * Get current price for token pair
   * @param token0 First token address
   * @param token1 Second token address
   * @param dex Optional specific DEX ID (uses best price if not specified)
   */
  async getPrice(token0: string, token1: string, dex?: string) {
    const params = new URLSearchParams({
      token0,
      token1,
      ...(dex && { dex }),
    });

    return this._request<any>(`/price?${params}`, { method: 'GET' });
  }

  /**
   * Get current gas prices on Arc testnet
   */
  async getGasPrice(): Promise<GasEstimate> {
    return this._request<GasEstimate>('/gas-price', { method: 'GET' });
  }

  /**
   * Get route optimizer metrics (for debugging)
   */
  async getMetrics() {
    return this._request<any>('/metrics', { method: 'GET' });
  }

  /**
   * Check API health
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Internal helper for making API requests with retry logic
   */
  private async _request<T>(
    endpoint: string,
    options: RequestInit
  ): Promise<T> {
    const url = `${this.apiUrl}/api/swap${endpoint}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        const response = await Promise.race([
          fetch(url, {
            headers: {
              'Content-Type': 'application/json',
              ...((options.headers as Record<string, string>) || {}),
            },
            ...options,
          }),
          new Promise<Response>((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), this.timeout)
          ),
        ]);

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'Unknown error');
        }

        return data.data as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.retryAttempts - 1) {
          // Exponential backoff: wait 1s, 2s, 4s, etc.
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }

    throw lastError || new Error('Failed to fetch from API');
  }
}

/**
 * Helper function to execute a swap with all necessary steps
 */
export async function executeSwap(
  sdk: DexAggregatorSDK,
  config: {
    inputToken: string;
    outputToken: string;
    inputAmount: string;
    userAddress: string;
    signer: any; // ethers Signer
    referrer?: string;
  }
): Promise<SwapExecutionResult> {
  try {
    console.log('Getting quote...');
    const quote = await sdk.getQuote(
      config.inputToken,
      config.outputToken,
      config.inputAmount
    );

    console.log('Quote received:', {
      inputAmount: quote.inputAmount,
      outputAmount: quote.outputAmount,
      priceImpact: quote.priceImpact,
    });

    console.log('Building swap transaction...');
    const swapTx = await sdk.buildSwapTransaction(
      quote,
      config.userAddress,
      config.referrer
    );

    console.log('Signing transaction...');
    const signedTx = await config.signer.sendTransaction(swapTx);

    console.log('Transaction sent:', signedTx.hash);

    return {
      success: true,
      txHash: signedTx.hash,
      estimatedGas: swapTx.gasLimit,
    };
  } catch (error) {
    console.error('Swap execution failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Helper to check if approval is needed and execute if necessary
 */
export async function executeApprovalIfNeeded(
  sdk: DexAggregatorSDK,
  config: {
    tokenAddress: string;
    spenderAddress: string;
    amount: string;
    userAddress: string;
    signer: any; // ethers Signer
  }
): Promise<{ approved: boolean; txHash?: string }> {
  try {
    // Build approval transaction
    const approveTx = await sdk.buildApprovalTransaction(
      config.tokenAddress,
      config.spenderAddress,
      config.amount,
      config.userAddress
    );

    console.log('Signing approval transaction...');
    const signedTx = await config.signer.sendTransaction(approveTx);

    console.log('Approval transaction sent:', signedTx.hash);

    return {
      approved: true,
      txHash: signedTx.hash,
    };
  } catch (error) {
    console.error('Approval failed:', error);
    return {
      approved: false,
    };
  }
}

/**
 * PriceFormatter utility
 */
export class PriceFormatter {
  static formatPrice(price: number, decimals: number = 2): string {
    return price.toFixed(decimals);
  }

  static formatPriceImpact(basisPoints: number): string {
    return (basisPoints / 100).toFixed(2) + '%';
  }

  static formatSlippage(basisPoints: number): string {
    return (basisPoints / 100).toFixed(2) + '%';
  }

  static formatGasPrice(wei: string, decimals: number = 2): string {
    const bn = require('ethers').BigNumber.from(wei);
    const gwei = parseFloat(require('ethers').utils.formatUnits(bn, 'gwei'));
    return gwei.toFixed(decimals);
  }
}

/**
 * Export SDK versions and utils
 */
export const SDK_VERSION = '1.0.0';

// Helper function
function address(value: number): string {
  return '0x' + value.toString().padStart(40, '0');
}
