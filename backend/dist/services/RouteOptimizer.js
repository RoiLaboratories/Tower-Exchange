"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouteOptimizer = void 0;
const ethers_1 = require("ethers");
const SynthraV3PoolService_1 = require("./SynthraV3PoolService");
const XyloNetPoolService_1 = require("./XyloNetPoolService");
const helpers_1 = require("../utils/helpers");
const SynthraPoolRegistry_1 = require("../utils/SynthraPoolRegistry");
const tokenRegistry_1 = require("../utils/tokenRegistry");
/**
 * RouteOptimizer
 * Finds the best swap routes across multiple DEXes
 */
class RouteOptimizer {
    constructor(dexService, config, arcConfig) {
        this.performanceMetrics = {
            routesCalculated: 0,
            avgCalculationTime: 0,
        };
        this.dexService = dexService;
        this.config = config;
        this.arcConfig = arcConfig || {
            chainId: 5042002,
            rpcUrl: 'https://rpc.testnet.arc.network',
            towerRouterAddress: '0x0ee3d301A9a2636f67C8705224fbc3319b4df949',
            explorerUrl: 'https://testnet.arcscan.app',
            blockTime: 12,
        };
        this.synthraPoolService = new SynthraV3PoolService_1.SynthraV3PoolService(this.arcConfig.rpcUrl);
        this.xyloNetPoolService = new XyloNetPoolService_1.XyloNetPoolService(this.arcConfig.rpcUrl);
    }
    /**
     * Get best quote for a token swap
     */
    async getQuote(inputToken, outputToken, inputAmount) {
        const startTime = Date.now();
        try {
            // Check cache first - reserved for future implementation
            // const cacheKey = `quote:${inputToken}:${outputToken}:${inputAmount}`;
            // Try single-hop routes first (more efficient)
            const singleHopQuote = await this._getBestSingleHopRoute(inputToken, outputToken, inputAmount);
            if (singleHopQuote) {
                this.performanceMetrics.routesCalculated++;
                this.performanceMetrics.avgCalculationTime =
                    (this.performanceMetrics.avgCalculationTime * (this.performanceMetrics.routesCalculated - 1) +
                        (Date.now() - startTime)) /
                        this.performanceMetrics.routesCalculated;
                return singleHopQuote;
            }
            // Try multi-hop routes
            const multiHopQuote = await this._getBestMultiHopRoute(inputToken, outputToken, inputAmount);
            if (multiHopQuote) {
                return multiHopQuote;
            }
            // Try split routes (last resort, more complex)
            const splitQuote = await this._getBestSplitRoute(inputToken, outputToken, inputAmount);
            if (splitQuote) {
                return splitQuote;
            }
            const token0Symbol = this.dexService.getTokenSymbol(inputToken);
            const token1Symbol = this.dexService.getTokenSymbol(outputToken);
            console.warn(`No route found for ${token0Symbol} (${inputToken}) -> ${token1Symbol} (${outputToken})`);
            return null;
        }
        catch (error) {
            console.error('Error getting quote:', error);
            return null;
        }
    }
    /**
     * Get best single-hop route (direct swap on one DEX)
     */
    async _getBestSingleHopRoute(inputToken, outputToken, inputAmount) {
        try {
            const supportedDexes = this.dexService.getDexesSupportingPair(inputToken, outputToken);
            // For EURC<->USDC and USDC<->USYC and EURC<->USYC swaps, use XyloNet exclusively (skip Synthra)
            const normalizedInput = inputToken.toLowerCase();
            const normalizedOutput = outputToken.toLowerCase();
            const eurc = '0x89b50855aa3be2f677cd6303cec089b5f319d72a'.toLowerCase();
            const usdc = '0x3600000000000000000000000000000000000000'.toLowerCase();
            const usyc = '0xe9185f0c5f296ed1797aae4238d26ccabeadb86c'.toLowerCase();
            const isEurcUsdcSwap = (normalizedInput === eurc && normalizedOutput === usdc) ||
                (normalizedInput === usdc && normalizedOutput === eurc);
            const isUsdcUsycSwap = (normalizedInput === usdc && normalizedOutput === usyc) ||
                (normalizedInput === usyc && normalizedOutput === usdc);
            const isEurcUsycSwap = (normalizedInput === eurc && normalizedOutput === usyc) ||
                (normalizedInput === usyc && normalizedOutput === eurc);
            // Filter DEXes: if XyloNet-specific pair, only use XyloNet
            const dexesToCheck = (isEurcUsdcSwap || isUsdcUsycSwap || isEurcUsycSwap)
                ? supportedDexes.filter(d => d.id === 'xylonet-adapter')
                : supportedDexes;
            let bestQuote = null;
            let bestOutputAmount = ethers_1.BigNumber.from(0);
            for (const dex of dexesToCheck) {
                let amountOut;
                let priceImpact = 50; // Default 0.5%
                let isRealQuote = false; // Track if this is a real quote or mock
                // Fetch real pool data for Synthra
                if (dex.id === 'synthra') {
                    const poolInfo = (0, SynthraPoolRegistry_1.getSynthraPoolForPair)(inputToken, outputToken);
                    if (!poolInfo) {
                        console.warn(`No Synthra pool found for ${inputToken} -> ${outputToken}`);
                        continue;
                    }
                    console.log(`[Synthra] Fetching quote for ${inputToken} -> ${outputToken}...`);
                    // Set the output token before calling simulateSwap
                    this.synthraPoolService.setTokenOut(outputToken);
                    const simulation = await this.synthraPoolService.simulateSwap(inputToken, inputAmount, (0, tokenRegistry_1.getTokenByAddress)(inputToken)?.decimals || 18, (0, tokenRegistry_1.getTokenByAddress)(outputToken)?.decimals || 18);
                    if (!simulation) {
                        console.warn(`Failed to simulate swap on Synthra for ${inputToken} -> ${outputToken}`);
                        continue;
                    }
                    amountOut = simulation.amountOut;
                    priceImpact = simulation.priceImpact;
                    isRealQuote = true;
                    console.log(`[Synthra Quote] ${inputAmount} -> ${amountOut}`, {
                        pool: poolInfo.symbol,
                        priceImpact: (priceImpact / 100).toFixed(2) + '%',
                        executionPrice: simulation.executionPrice.toFixed(6),
                    });
                }
                else if (dex.id === 'xylonet-adapter') {
                    // Fetch real quote from XyloNet, fallback to mock if pool doesn't exist
                    console.log(`[XyloNet] Fetching quote for ${inputToken} -> ${outputToken}...`);
                    const simulation = await this.xyloNetPoolService.simulateSwap(inputToken, outputToken, inputAmount, (0, tokenRegistry_1.getTokenByAddress)(inputToken)?.decimals || 18, (0, tokenRegistry_1.getTokenByAddress)(outputToken)?.decimals || 18);
                    if (simulation) {
                        // Real pool exists and quote succeeded
                        amountOut = simulation.amountOut;
                        priceImpact = simulation.priceImpact;
                        isRealQuote = true;
                    }
                    else {
                        // No real pool found, use mock quote as fallback
                        const mockOutput = ethers_1.BigNumber.from(inputAmount).mul(95).div(100);
                        amountOut = mockOutput.toString();
                        isRealQuote = false;
                        console.log(`[XyloNet - Fallback Mock] Using mock quote for ${inputAmount} -> ${amountOut}`);
                    }
                }
                else {
                    // Mock data for other DEXes (Swaparc, QuantumExchange)
                    const mockOutput = ethers_1.BigNumber.from(inputAmount).mul(95).div(100); // Assume 5% slippage
                    amountOut = mockOutput.toString();
                    isRealQuote = false;
                    console.log(`[${dex.name} - Mock] Using mock quote for ${inputAmount} -> ${amountOut}`);
                }
                const outputBn = ethers_1.BigNumber.from(amountOut);
                // Determine if current best quote is real
                const bestQuoteIsReal = bestQuote !== null && bestQuote.route.hops[0].dexId !== undefined
                    ? ['synthra', 'xylonet-adapter'].includes(bestQuote.route.hops[0].dexId)
                    : false;
                // Selection logic: prefer real quotes, then higher amounts
                const isXyloNet = dex.id === 'xylonet-adapter';
                const isBetter = outputBn.gt(bestOutputAmount);
                const isTieWithXyloNet = outputBn.eq(bestOutputAmount) && isXyloNet;
                // Prefer real over mock: if current is real and best wasn't, or if both real/mock and current is better
                const shouldSelect = !bestQuote ||
                    (isRealQuote && !bestQuoteIsReal) || // Real > Mock
                    (isRealQuote === bestQuoteIsReal && (isBetter || isTieWithXyloNet)); // Same type: better amount or tie with preference
                if (shouldSelect) {
                    bestOutputAmount = outputBn;
                    const hop = {
                        dexId: dex.id,
                        dexName: dex.name,
                        dexRouter: dex.routerAddress,
                        path: [inputToken, outputToken],
                        amountIn: inputAmount,
                        amountOut,
                        priceImpact,
                        liquidity: outputBn.mul(10).toString(),
                    };
                    const minOut = helpers_1.SwapMathUtils.calculateMinimumOutputAmount(amountOut, this.config.slippagePercentage);
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
        }
        catch (error) {
            console.error('Error in single-hop route:', error);
            return null;
        }
    }
    /**
     * Get best multi-hop route (swap through intermediate tokens)
     */
    async _getBestMultiHopRoute(inputToken, outputToken, inputAmount) {
        try {
            // Common intermediaries
            const intermediaries = ['0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48']; // USDC on mainnet
            let bestQuote = null;
            let bestOutputAmount = ethers_1.BigNumber.from(0);
            for (const intermediate of intermediaries) {
                if (intermediate === inputToken || intermediate === outputToken)
                    continue;
                // Try route: inputToken -> intermediate -> outputToken
                const hop1 = await this._estimateHop(inputToken, intermediate, inputAmount);
                if (!hop1)
                    continue;
                const hop2 = await this._estimateHop(intermediate, outputToken, hop1.amountOut);
                if (!hop2)
                    continue;
                const totalOutput = ethers_1.BigNumber.from(hop2.amountOut);
                if (totalOutput.gt(bestOutputAmount)) {
                    bestOutputAmount = totalOutput;
                    const minOut = helpers_1.SwapMathUtils.calculateMinimumOutputAmount(totalOutput.toString(), this.config.slippagePercentage);
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
        }
        catch (error) {
            console.error('Error in multi-hop route:', error);
            return null;
        }
    }
    /**
     * Get best split route (break into multiple swaps for better price)
     */
    async _getBestSplitRoute(inputToken, outputToken, inputAmount) {
        try {
            const supportedDexes = this.dexService.getDexesSupportingPair(inputToken, outputToken);
            if (supportedDexes.length < 2)
                return null; // Need at least 2 DEXes for split
            const numSplits = Math.min(supportedDexes.length, this.config.maxSplits);
            const amountPerSplit = ethers_1.BigNumber.from(inputAmount).div(numSplits);
            const splits = [];
            let totalOutput = ethers_1.BigNumber.from(0);
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
            const minOut = helpers_1.SwapMathUtils.calculateMinimumOutputAmount(totalOutput.toString(), this.config.slippagePercentage);
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
        }
        catch (error) {
            console.error('Error in split route:', error);
            return null;
        }
    }
    /**
     * Estimate a single hop (internal helper)
     */
    async _estimateHop(inputToken, outputToken, inputAmount) {
        try {
            const dex = this.dexService.getDexesSupportingPair(inputToken, outputToken)[0];
            if (!dex)
                return null;
            const mockOutput = ethers_1.BigNumber.from(inputAmount).mul(95).div(100);
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
        }
        catch (
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _error) {
            return null;
        }
    }
    /**
     * Compare two quotes and return the better one
     */
    compareQuotes(quote1, quote2) {
        return ethers_1.BigNumber.from(quote1.outputAmount).gt(ethers_1.BigNumber.from(quote2.outputAmount))
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
    resetMetrics() {
        this.performanceMetrics = {
            routesCalculated: 0,
            avgCalculationTime: 0,
        };
    }
}
exports.RouteOptimizer = RouteOptimizer;
//# sourceMappingURL=RouteOptimizer.js.map