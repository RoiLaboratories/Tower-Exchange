import { Router, Request, Response, NextFunction } from 'express';
import { RouteOptimizer } from '../services/RouteOptimizer';
import { TransactionBuilder } from '../services/TransactionBuilder';
import { FeeCollectionService } from '../services/FeeCollectionService';
import { DexDiscoveryService } from '../services/DexDiscoveryService';
import { ArcTestnetConfig } from '../types';
export declare class SwapRoutes {
    private router;
    private routeOptimizer;
    private txBuilder;
    private feeCollectionService;
    private dexService;
    private config;
    constructor(routeOptimizer: RouteOptimizer, txBuilder: TransactionBuilder, feeCollectionService: FeeCollectionService, dexService: DexDiscoveryService, config: ArcTestnetConfig);
    /**
     * Initialize all routes
     */
    private initializeRoutes;
    /**
     * POST /quote
     * Get best swap quote
     */
    private handleQuote;
    /**
     * POST /build-tx
     * Build signed transaction for swap
     */
    private handleBuildTx;
    /**
     * POST /approval
     * Build approval transaction
     */
    private handleApproval;
    /**
     * GET /dexes
     * Get list of available DEXes
     */
    private handleGetDexes;
    /**
     * GET /price
     * Get current price for token pair
     */
    private handleGetPrice;
    /**
     * GET /gas-price
     * Get current gas prices
     */
    private handleGetGasPrice;
    /**
     * GET /metrics
     * Get router optimizer metrics
     */
    private handleGetMetrics;
    /**
     * POST /submit-fee
     * Submit platform fee with atomic distribution through FeeCollector
     * Routes swap output through FeeCollector for atomic fee deduction
     */
    private handleSubmitFee;
    /**
     * GET /accumulated-fees/:token
     * Get accumulated fees for a specific token from FeeCollector
     */
    private handleGetAccumulatedFees;
    /**
     * Get router instance
     */
    getRouter(): Router;
}
/**
 * Global error handler middleware
 */
export declare const errorHandler: (err: any, _req: Request, res: Response, _next: NextFunction) => void;
/**
 * Request validation middleware
 */
export declare const validateJsonRequest: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Rate limiting middleware (basic implementation)
 */
export declare const createRateLimiter: (maxRequests?: number, windowMs?: number) => (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
//# sourceMappingURL=swapRoutes.d.ts.map