import { Quote, RouteOptimizerConfig, ArcTestnetConfig } from '../types';
import { DexDiscoveryService } from './DexDiscoveryService';
/**
 * RouteOptimizer
 * Finds the best swap routes across multiple DEXes
 */
export declare class RouteOptimizer {
    private dexService;
    private config;
    private arcConfig;
    private synthraPoolService;
    private xyloNetPoolService;
    private performanceMetrics;
    constructor(dexService: DexDiscoveryService, config: RouteOptimizerConfig, arcConfig?: ArcTestnetConfig);
    /**
     * Get best quote for a token swap
     */
    getQuote(inputToken: string, outputToken: string, inputAmount: string): Promise<Quote | null>;
    /**
     * Get best single-hop route (direct swap on one DEX)
     */
    private _getBestSingleHopRoute;
    /**
     * Get best multi-hop route (swap through intermediate tokens)
     */
    private _getBestMultiHopRoute;
    /**
     * Get best split route (break into multiple swaps for better price)
     */
    private _getBestSplitRoute;
    /**
     * Estimate a single hop (internal helper)
     */
    private _estimateHop;
    /**
     * Compare two quotes and return the better one
     */
    compareQuotes(quote1: Quote, quote2: Quote): Quote;
    /**
     * Get performance metrics
     */
    getMetrics(): {
        avgCalcTimeMs: string;
        routesCalculated: number;
        avgCalculationTime: number;
    };
    /**
     * Reset route cache
     */
    resetMetrics(): void;
}
//# sourceMappingURL=RouteOptimizer.d.ts.map