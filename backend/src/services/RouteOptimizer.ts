import { BigNumber } from 'ethers';
import {
  Quote,
  RouteHop,
  SplitRoute,
  RouteOptimizerConfig,
  ArcTestnetConfig,
} from '../types';
import { DexDiscoveryService } from './DexDiscoveryService';
import { SynthraV3PoolService } from './SynthraV3PoolService';
import { SwapMathUtils } from '../utils/helpers';
import { getSynthraPoolForPair } from '../utils/SynthraPoolRegistry';
import { getTokenByAddress } from '../utils/tokenRegistry';

/**
 * RouteOptimizer
 * Finds the best swap routes across multiple DEXes
 */
export class RouteOptimizer {
  private dexService: DexDiscoveryService;
  private config: RouteOptimizerConfig;
  private arcConfig: ArcTestnetConfig;
  private synthraPoolService: SynthraV3PoolService;
  private performanceMetrics = {
    routesCalculated: 0,
    avgCalculationTime: 0,
  };

  constructor(
    dexService: DexDiscoveryService,
    config: RouteOptimizerConfig,
    arcConfig?: ArcTestnetConfig
  ) {
    this.dexService = dexService;
    this.config = config;
    this.arcConfig = arcConfig || {
      chainId: 5042002,
      rpcUrl: 'https://rpc.testnet.arc.network',
      towerRouterAddress: '0x0ee3d301A9a2636f67C8705224fbc3319b4df949',
      explorerUrl: 'https://testnet.arcscan.app',
      blockTime: 12,
    };
    this.synthraPoolService = new SynthraV3PoolService(this.arcConfig.rpcUrl);
  }

  /**
   * Get best quote for a token swap
   */
  async getQuote(
    inputToken: string,
    outputToken: string,
    inputAmount: string
  ): Promise<Quote | null> {
    const startTime = Date.now();

    try {
      // Check cache first - reserved for future implementation
      // const cacheKey = `quote:${inputToken}:${outputToken}:${inputAmount}`;

      // Try single-hop routes first (more efficient)
      const singleHopQuote = await this._getBestSingleHopRoute(
        inputToken,
        outputToken,
        inputAmount
      );

      if (singleHopQuote) {
        this.performanceMetrics.routesCalculated++;
        this.performanceMetrics.avgCalculationTime = 
          (this.performanceMetrics.avgCalculationTime * (this.performanceMetrics.routesCalculated - 1) +
            (Date.now() - startTime)) /
          this.performanceMetrics.routesCalculated;

        return singleHopQuote;
      }

      // Try multi-hop routes
      const multiHopQuote = await this._getBestMultiHopRoute(
        inputToken,
        outputToken,
        inputAmount
      );

      if (multiHopQuote) {
        return multiHopQuote;
      }

      // Try split routes (last resort, more complex)
      const splitQuote = await this._getBestSplitRoute(
        inputToken,
        outputToken,
        inputAmount
      );

      if (splitQuote) {
        return splitQuote;
      }

      const token0Symbol = this.dexService.getTokenSymbol(inputToken);
      const token1Symbol = this.dexService.getTokenSymbol(outputToken);
      console.warn(`No route found for ${token0Symbol} (${inputToken}) -> ${token1Symbol} (${outputToken})`);
      return null;
    } catch (error) {
      console.error('Error getting quote:', error);
      return null;
    }
  }

  /**
   * Get best single-hop route (direct swap on one DEX)
   */
  private async _getBestSingleHopRoute(
    inputToken: string,
    outputToken: string,
    inputAmount: string
  ): Promise<Quote | null> {
    try {
      const supportedDexes = this.dexService.getDexesSupportingPair(inputToken, outputToken);

      let bestQuote: Quote | null = null;
      let bestOutputAmount = BigNumber.from(0);

      for (const dex of supportedDexes) {
        let amountOut: string;
        let priceImpact = 50; // Default 0.5%

        // Fetch real pool data for Synthra
        if (dex.id === 'synthra') {
          const poolInfo = getSynthraPoolForPair(inputToken, outputToken);
          if (!poolInfo) {
            console.warn(`No Synthra pool found for ${inputToken} -> ${outputToken}`);
            continue;
          }

          console.log(`[Synthra] Fetching quote for ${inputToken} -> ${outputToken}...`);
          
          // Set the output token before calling simulateSwap
          this.synthraPoolService.setTokenOut(outputToken);
          
          const simulation = await this.synthraPoolService.simulateSwap(
            inputToken,
            inputAmount,
            getTokenByAddress(inputToken)?.decimals || 18,
            getTokenByAddress(outputToken)?.decimals || 18
          );

          if (!simulation) {
            console.warn(`Failed to simulate swap on Synthra for ${inputToken} -> ${outputToken}`);
            continue;
          }

          amountOut = simulation.amountOut;
          priceImpact = simulation.priceImpact;

          console.log(`[Synthra Quote] ${inputAmount} -> ${amountOut}`, {
            pool: poolInfo.symbol,
            priceImpact: (priceImpact / 100).toFixed(2) + '%',
            executionPrice: simulation.executionPrice.toFixed(6),
          });
        } else {
          // Mock data for other DEXes (Swaparc, QuantumExchange)
          const mockOutput = BigNumber.from(inputAmount).mul(95).div(100); // Assume 5% slippage
          amountOut = mockOutput.toString();
          console.log(`[${dex.name} - Mock] Using mock quote for ${inputAmount} -> ${amountOut}`);
        }

        const outputBn = BigNumber.from(amountOut);
        if (outputBn.gt(bestOutputAmount)) {
          bestOutputAmount = outputBn;

          const hop: RouteHop = {
            dexId: dex.id,
            dexName: dex.name,
            dexRouter: dex.routerAddress,
            path: [inputToken, outputToken],
            amountIn: inputAmount,
            amountOut,
            priceImpact,
            liquidity: outputBn.mul(10).toString(),
          };

          const minOut = SwapMathUtils.calculateMinimumOutputAmount(
            amountOut,
            this.config.slippagePercentage
          );

          bestQuote = {
            inputToken,
            outputToken,
            inputAmount,
            outputAmount: amountOut,
            minOut,
            route: {
              type: 'single',
              hops: [hop],
              totalFee: dex.id === 'synthra' ? 25 : 25, // 0.25% for all DEXes
              estimatedOutput: amountOut,
            },
            priceImpact,
            gasEstimate: '200000',
            slippage: this.config.slippagePercentage,
            exec_price: parseFloat(outputBn.toString()) / parseFloat(inputAmount),
          };
        }
      }

      if (bestQuote) {
        const inputTokenSymbol = this.dexService.getTokenSymbol(inputToken);
        const outputTokenSymbol = this.dexService.getTokenSymbol(outputToken);
        console.log(`[RouteOptimizer] Best quote selected for ${inputTokenSymbol} -> ${outputTokenSymbol}`, {
          dex: bestQuote.route.hops[0].dexName,
          outputAmount_wei: bestQuote.outputAmount,
          minOut_wei: bestQuote.minOut,
          exec_price: bestQuote.exec_price.toFixed(6),
        });
      }

      return bestQuote;
    } catch (error) {
      console.error('Error in single-hop route:', error);
      return null;
    }
  }

  /**
   * Get best multi-hop route (swap through intermediate tokens)
   */
  private async _getBestMultiHopRoute(
    inputToken: string,
    outputToken: string,
    inputAmount: string
  ): Promise<Quote | null> {
    try {
      // Common intermediaries
      const intermediaries = ['0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48']; // USDC on mainnet

      let bestQuote: Quote | null = null;
      let bestOutputAmount = BigNumber.from(0);

      for (const intermediate of intermediaries) {
        if (intermediate === inputToken || intermediate === outputToken) continue;

        // Try route: inputToken -> intermediate -> outputToken
        const hop1 = await this._estimateHop(inputToken, intermediate, inputAmount);
        if (!hop1) continue;

        const hop2 = await this._estimateHop(intermediate, outputToken, hop1.amountOut);
        if (!hop2) continue;

        const totalOutput = BigNumber.from(hop2.amountOut);

        if (totalOutput.gt(bestOutputAmount)) {
          bestOutputAmount = totalOutput;

          const minOut = SwapMathUtils.calculateMinimumOutputAmount(
            totalOutput.toString(),
            this.config.slippagePercentage
          );

          bestQuote = {
            inputToken,
            outputToken,
            inputAmount,
            outputAmount: totalOutput.toString(),
            minOut,
            route: {
              type: 'multi',
              hops: [hop1, hop2],
              totalFee: 50, // 0.5% (0.25% * 2 hops)
              estimatedOutput: totalOutput.toString(),
            },
            priceImpact: 100,
            gasEstimate: '300000',
            slippage: 50,
            exec_price: parseFloat(totalOutput.toString()) / parseFloat(inputAmount),
          };
        }
      }

      return bestQuote;
    } catch (error) {
      console.error('Error in multi-hop route:', error);
      return null;
    }
  }

  /**
   * Get best split route (break into multiple swaps for better price)
   */
  private async _getBestSplitRoute(
    inputToken: string,
    outputToken: string,
    inputAmount: string
  ): Promise<Quote | null> {
    try {
      const supportedDexes = this.dexService.getDexesSupportingPair(inputToken, outputToken);

      if (supportedDexes.length < 2) return null; // Need at least 2 DEXes for split

      const numSplits = Math.min(supportedDexes.length, this.config.maxSplits);
      const amountPerSplit = BigNumber.from(inputAmount).div(numSplits);

      const splits: SplitRoute[] = [];
      let totalOutput = BigNumber.from(0);

      for (let i = 0; i < numSplits; i++) {
        const dex = supportedDexes[i];

        // Mock output calculation
        const mockOutput = amountPerSplit.mul(95).div(100);
        totalOutput = totalOutput.add(mockOutput);

        splits.push({
          dexId: dex.id,
          dexName: dex.name,
          dexRouter: dex.routerAddress,
          path: [inputToken, outputToken],
          percentage: (100 / numSplits),
          amountIn: amountPerSplit.toString(),
          amountOut: mockOutput.toString(),
          priceImpact: 50,
        });
      }

      const minOut = SwapMathUtils.calculateMinimumOutputAmount(
        totalOutput.toString(),
        this.config.slippagePercentage
      );

      return {
        inputToken,
        outputToken,
        inputAmount,
        outputAmount: totalOutput.toString(),
        minOut,
        route: {
          type: 'split',
          hops: splits.map((s) => ({
            dexId: s.dexId,
            dexName: s.dexName,
            dexRouter: s.dexRouter,
            path: s.path,
            amountIn: s.amountIn,
            amountOut: s.amountOut,
            priceImpact: s.priceImpact,
            liquidity: s.amountOut,
          })),
          totalFee: 25,
          estimatedOutput: totalOutput.toString(),
        },
        priceImpact: 50,
        gasEstimate: '400000',
        slippage: 50,
        exec_price: parseFloat(totalOutput.toString()) / parseFloat(inputAmount),
      };
    } catch (error) {
      console.error('Error in split route:', error);
      return null;
    }
  }

  /**
   * Estimate a single hop (internal helper)
   */
  private async _estimateHop(
    inputToken: string,
    outputToken: string,
    inputAmount: string
  ): Promise<RouteHop | null> {
    try {
      const dex = this.dexService.getDexesSupportingPair(inputToken, outputToken)[0];
      if (!dex) return null;

      const mockOutput = BigNumber.from(inputAmount).mul(95).div(100);

      return {
        dexId: dex.id,
        dexName: dex.name,
        dexRouter: dex.routerAddress,
        path: [inputToken, outputToken],
        amountIn: inputAmount,
        amountOut: mockOutput.toString(),
        priceImpact: 50,
        liquidity: mockOutput.mul(10).toString(),
      };
    } catch (
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _error
    ) {
      return null;
    }
  }

  /**
   * Compare two quotes and return the better one
   */
  compareQuotes(quote1: Quote, quote2: Quote): Quote {
    return BigNumber.from(quote1.outputAmount).gt(BigNumber.from(quote2.outputAmount))
      ? quote1
      : quote2;
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.performanceMetrics,
      avgCalcTimeMs: this.performanceMetrics.avgCalculationTime.toFixed(2),
    };
  }

  /**
   * Reset route cache
   */
  resetMetrics(): void {
    this.performanceMetrics = {
      routesCalculated: 0,
      avgCalculationTime: 0,
    };
  }
}
