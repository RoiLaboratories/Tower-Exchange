/**
 * XyloNet Pool Service
 * Fetches pool state and calculates swap outputs from XyloNet pools
 */

import { ethers } from 'ethers';

export interface SwapSimulation {
  amountIn: string;
  amountOut: string;
  priceImpact: number; // in basis points (e.g., 50 = 0.5%)
  executionPrice: number; // actual price of the swap
}

// XyloNet Addresses
const ADDR = {
  router: '0x73742278c31a76dBb0D2587d03ef92E6E2141023',
};

// XyloNet Router ABI - Actual implementation (not docs version)
const ROUTER_ABI = [
  'function getAmountOut(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256 amountOut)',
  'function quote(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256 amountOut, uint256 priceImpact)',
  'function swap(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address to, uint256 deadline) params) external returns (uint256 amountOut)',
];

export class XyloNetPoolService {
  private provider: ethers.providers.Provider;
  private router: ethers.Contract;

  constructor(rpcUrl: string) {
    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    this.router = new ethers.Contract(ADDR.router, ROUTER_ABI, this.provider);
  }

  /**
   * Simulate a swap using router.quote() which returns both amount and price impact
   * This is the correct XyloNet integration using actual router ABI
   * 
   * NOTE: XyloNet tokens (USDC, EURC, USYC) all use 6 decimals
   * Input amounts come in 18 decimals, so we convert to 6 and then back to 18
   */
  public async simulateSwap(
    inputToken: string,
    outputToken: string,
    inputAmount: string,
    _decimalsIn?: number,
    _decimalsOut?: number
  ): Promise<SwapSimulation | null> {
    try {
      console.log(`[XyloNet] Starting quote discovery for ${inputToken} → ${outputToken}`);

      // Verify tokens are supported
      const token0Lower = inputToken.toLowerCase();
      const token1Lower = outputToken.toLowerCase();
      
      const usdc = '0x3600000000000000000000000000000000000000'.toLowerCase();
      const eurc = '0x89b50855aa3be2f677cd6303cec089b5f319d72a'.toLowerCase();
      const usyc = '0xe9185f0c5f296ed1797aae4238d26ccabeadb86c'.toLowerCase();

      // Check if pair is supported
      const supportedTokens = [usdc, eurc, usyc];
      const isSupported = supportedTokens.includes(token0Lower) && supportedTokens.includes(token1Lower);

      if (!isSupported) {
        console.warn(
          `[XyloNet] Unsupported token pair: ${inputToken} -> ${outputToken}`
        );
        return null;
      }

      // XyloNet tokens always use 6 decimals, input comes in 18 decimals
      // Convert: 18 decimals -> 6 decimals by dividing by 10^12
      const amountInBN = ethers.BigNumber.from(inputAmount);
      const convertedAmountIn = amountInBN.div(ethers.BigNumber.from(10).pow(12));

      console.log(`[XyloNet Debug] Calling quote with:`, {
        tokenIn: inputToken,
        tokenOut: outputToken,
        amountInOriginal: inputAmount,
        amountInConverted: convertedAmountIn.toString(),
      });

      // Use quote() which returns both amountOut and priceImpact directly
      const result = await this.router.quote(
        inputToken,
        outputToken,
        convertedAmountIn
      );

      const amountOut = result[0]; // amountOut in 6 decimals
      const priceImpact = result[1]; // priceImpact (already in basis points)

      console.log(`[XyloNet Debug] Router.quote() returned:`, {
        amountOutRaw: amountOut.toString(),
        priceImpactRaw: priceImpact.toString(),
        amountOut6Decimals: amountOut.toString(),
      });

      if (!amountOut || amountOut.isZero()) {
        console.warn(`[XyloNet] Invalid amount out for ${inputToken} -> ${outputToken}`);
        return null;
      }

      // Convert amountOut back to 18 decimals by multiplying by 10^12
      // All outputs are normalized to 18 decimals for consistent comparison
      const DECIMALS_MULTIPLIER = ethers.BigNumber.from('1000000000000'); // 10^12
      const convertedAmountOut = amountOut.mul(DECIMALS_MULTIPLIER);

      const executionPrice = parseFloat(convertedAmountOut.toString()) / parseFloat(inputAmount);
      const priceImpactBps = parseInt(priceImpact.toString());

      console.log(`[XyloNet Quote] ${inputAmount} -> ${convertedAmountOut.toString()}`, {
        tokenIn: inputToken,
        tokenOut: outputToken,
        priceImpact: (priceImpactBps / 100).toFixed(2) + '%',
        executionPrice: executionPrice.toFixed(6),
      });

      return {
        amountIn: inputAmount,
        amountOut: convertedAmountOut.toString(),
        priceImpact: priceImpactBps,
        executionPrice,
      };
    } catch (error) {
      console.warn(`[XyloNet] Error simulating swap:`, error instanceof Error ? error.message : String(error));
      return null;
    }
  }
}
