"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRateLimiter = exports.validateJsonRequest = exports.errorHandler = exports.SwapRoutes = void 0;
const express_1 = require("express");
const ethers_1 = require("ethers");
const tokenRegistry_1 = require("../utils/tokenRegistry");
class SwapRoutes {
    constructor(routeOptimizer, txBuilder, feeCollectionService, dexService, config) {
        this.router = (0, express_1.Router)();
        this.routeOptimizer = routeOptimizer;
        this.txBuilder = txBuilder;
        this.feeCollectionService = feeCollectionService;
        this.dexService = dexService;
        this.config = config;
        this.initializeRoutes();
    }
    /**
     * Initialize all routes
     */
    initializeRoutes() {
        // POST /quote - Get swap quote
        this.router.post('/quote', this.handleQuote.bind(this));
        // POST /build-tx - Build transaction
        this.router.post('/build-tx', this.handleBuildTx.bind(this));
        // POST /approval - Build approval transaction
        this.router.post('/approval', this.handleApproval.bind(this));
        // POST /submit-fee - Submit platform fee for native USDC swaps
        this.router.post('/submit-fee', this.handleSubmitFee.bind(this));
        // GET /accumulated-fees - Get accumulated fees for a token
        this.router.get('/accumulated-fees/:token', this.handleGetAccumulatedFees.bind(this));
        // GET /dexes - Get available DEXes
        this.router.get('/dexes', this.handleGetDexes.bind(this));
        // GET /price - Get current price
        this.router.get('/price', this.handleGetPrice.bind(this));
        // GET /gas-price - Get current gas prices
        this.router.get('/gas-price', this.handleGetGasPrice.bind(this));
        // GET /metrics - Get optimizer metrics
        this.router.get('/metrics', this.handleGetMetrics.bind(this));
        // Health check
        this.router.get('/health', (_req, res) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        });
    }
    /**
     * POST /quote
     * Get best swap quote
     */
    async handleQuote(req, res, next) {
        try {
            const { inputToken, outputToken, inputAmount } = req.body;
            // Validate input
            if (!ethers_1.ethers.utils.isAddress(inputToken) || !ethers_1.ethers.utils.isAddress(outputToken)) {
                res.status(400).json({ error: 'Invalid token addresses' });
                return;
            }
            if (!inputAmount || ethers_1.ethers.BigNumber.from(inputAmount).isZero()) {
                res.status(400).json({ error: 'Invalid input amount' });
                return;
            }
            // Normalize inputAmount from native decimals to 18 decimals for internal processing
            const tokenInfo = (0, tokenRegistry_1.getTokenByAddress)(inputToken);
            const tokenDecimals = tokenInfo?.decimals || 18;
            const amountInBN = ethers_1.ethers.BigNumber.from(inputAmount);
            // Convert from native decimals to 18 decimals
            const decimalsMultiplier = 18 - tokenDecimals;
            const normalizedAmount = decimalsMultiplier > 0
                ? amountInBN.mul(ethers_1.ethers.BigNumber.from(10).pow(decimalsMultiplier)).toString()
                : amountInBN.div(ethers_1.ethers.BigNumber.from(10).pow(-decimalsMultiplier)).toString();
            console.log(`[SwapRoutes] Normalized input amount:`, {
                inputToken,
                nativeDecimals: tokenDecimals,
                originalAmount: inputAmount,
                normalizedAmount,
            });
            // Get quote with normalized amount
            const quote = await this.routeOptimizer.getQuote(inputToken, outputToken, normalizedAmount);
            if (!quote) {
                res.status(404).json({ error: 'No route found for this swap' });
                return;
            }
            res.json({
                success: true,
                data: quote,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /build-tx
     * Build signed transaction for swap
     */
    async handleBuildTx(req, res, next) {
        try {
            const { quote, userAddress } = req.body;
            // Validate input
            if (!quote || !userAddress) {
                res.status(400).json({ error: 'Missing required fields: quote, userAddress' });
                return;
            }
            if (!ethers_1.ethers.utils.isAddress(userAddress)) {
                res.status(400).json({ error: 'Invalid user address' });
                return;
            }
            // Build transaction (with auto-approval if needed)
            console.log('[SwapRoutes] Building transaction for quote:', {
                inputToken: quote.inputToken,
                outputToken: quote.outputToken,
                inputAmount: quote.inputAmount,
                outputAmount: quote.outputAmount,
                dex: quote.route?.hops?.[0]?.dexName,
            });
            const { approval, swap: swapTx } = await this.txBuilder.buildSwapTransactionWithApproval(quote, userAddress);
            console.log('[SwapRoutes] Built transactions:', {
                hasApproval: !!approval,
                swap: {
                    to: swapTx.to,
                    from: swapTx.from,
                    dataLength: swapTx.data?.length || 0,
                    value: swapTx.value,
                    gasLimit: swapTx.gasLimit,
                },
            });
            if (approval) {
                console.log('[SwapRoutes] Approval transaction required:', {
                    to: approval.to,
                    from: approval.from,
                    dataLength: approval.data?.length || 0,
                    gasLimit: approval.gasLimit,
                });
            }
            // Validate swap transaction
            const validation = this.txBuilder.validateTransaction(swapTx);
            if (!validation.valid) {
                console.error('[SwapRoutes] Transaction validation failed:', validation.errors);
                res.status(400).json({
                    error: 'Transaction validation failed',
                    details: validation.errors,
                });
                return;
            }
            // Return both approval and swap transactions
            res.json({
                success: true,
                data: {
                    approval: approval || null,
                    swap: swapTx,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error('[SwapRoutes] Error in handleBuildTx:', error);
            next(error);
        }
    }
    /**
     * POST /approval
     * Build approval transaction
     */
    async handleApproval(req, res, next) {
        try {
            const { tokenAddress, spenderAddress, amount, userAddress } = req.body;
            // Validate input
            if (!ethers_1.ethers.utils.isAddress(tokenAddress) || !ethers_1.ethers.utils.isAddress(spenderAddress)) {
                res.status(400).json({ error: 'Invalid token or spender address' });
                return;
            }
            if (!userAddress || !ethers_1.ethers.utils.isAddress(userAddress)) {
                res.status(400).json({ error: 'Invalid user address' });
                return;
            }
            // Build approval transaction
            const approval = this.txBuilder.buildApprovalTransaction(tokenAddress, spenderAddress, amount || ethers_1.ethers.constants.MaxUint256.toString(), userAddress);
            res.json({
                success: true,
                data: approval,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /dexes
     * Get list of available DEXes
     */
    async handleGetDexes(_req, res, next) {
        try {
            const dexes = this.dexService.getAllDexes();
            res.json({
                success: true,
                data: dexes,
                count: dexes.length,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /price
     * Get current price for token pair
     */
    async handleGetPrice(req, res, next) {
        try {
            const { token0, token1, dex } = req.query;
            if (!token0 || !token1) {
                res.status(400).json({ error: 'Missing token0 or token1 parameter' });
                return;
            }
            const token0Str = String(token0);
            const token1Str = String(token1);
            if (!ethers_1.ethers.utils.isAddress(token0Str) || !ethers_1.ethers.utils.isAddress(token1Str)) {
                res.status(400).json({ error: 'Invalid token addresses' });
                return;
            }
            let price = null;
            let dexId = dex ? String(dex) : 'best';
            if (dex) {
                price = await this.dexService.getPrice(String(dex), token0Str, token1Str);
            }
            else {
                const bestPrice = await this.dexService.getBestPrice(token0Str, token1Str);
                if (bestPrice) {
                    price = bestPrice.price;
                    dexId = bestPrice.dexId;
                }
            }
            if (price === null) {
                res.status(404).json({ error: 'Price not found for this pair' });
                return;
            }
            res.json({
                success: true,
                data: {
                    token0: token0Str,
                    token1: token1Str,
                    price,
                    dex: dexId,
                    chainId: this.config.chainId,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /gas-price
     * Get current gas prices
     */
    async handleGetGasPrice(_req, res, next) {
        try {
            const gasPrices = await this.txBuilder.getGasPrice();
            res.json({
                success: true,
                data: gasPrices,
                chainId: this.config.chainId,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /metrics
     * Get router optimizer metrics
     */
    async handleGetMetrics(_req, res, next) {
        try {
            const metrics = this.routeOptimizer.getMetrics();
            const cacheStats = this.dexService.getCacheStats();
            res.json({
                success: true,
                data: {
                    routeOptimizer: metrics,
                    cache: cacheStats,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /submit-fee
     * Submit platform fee with atomic distribution through FeeCollector
     * Routes swap output through FeeCollector for atomic fee deduction
     */
    async handleSubmitFee(req, res, next) {
        try {
            // Accept both new atomic format and legacy format for backward compatibility
            const { outputToken, totalAmount, userAddress, feeBps, feeAmount } = req.body;
            // Validate output token
            if (!outputToken) {
                res.status(400).json({ error: 'Missing required field: outputToken' });
                return;
            }
            if (!ethers_1.ethers.utils.isAddress(outputToken)) {
                res.status(400).json({ error: 'Invalid output token address' });
                return;
            }
            // Check fee collection service availability
            if (!this.feeCollectionService.isAvailable()) {
                res.status(503).json({
                    error: 'Fee collection service not available',
                    details: 'FeeCollector contract not configured or backend wallet not initialized',
                });
                return;
            }
            // Use new atomic format if provided, otherwise fall back to legacy
            if (totalAmount && userAddress) {
                // New atomic collectFeeAndDistribute format
                if (!ethers_1.ethers.utils.isAddress(userAddress)) {
                    res.status(400).json({ error: 'Invalid user address' });
                    return;
                }
                const feeBpsNum = feeBps || 25; // Default to 0.25%
                console.log('[SwapRoutes] Submitting fee with atomic distribution:', {
                    outputToken,
                    totalAmount,
                    userAddress,
                    feeBps: feeBpsNum,
                    backendAddress: this.feeCollectionService.getBackendAddress(),
                });
                const result = await this.feeCollectionService.submitFee(outputToken, totalAmount, feeBpsNum, userAddress);
                if (!result.success) {
                    res.status(500).json({
                        error: 'Failed to submit fee with atomic distribution',
                        details: result.error,
                    });
                    return;
                }
                console.log('[SwapRoutes] Atomic fee collection successful:', result);
                res.json({
                    success: true,
                    data: {
                        transactionHash: result.transactionHash,
                        outputToken: result.outputToken,
                        feeAmount: result.feeAmount,
                        blockNumber: result.blockNumber,
                    },
                    timestamp: new Date().toISOString(),
                });
            }
            else if (feeAmount) {
                // Legacy format for backward compatibility
                if (!feeAmount) {
                    res.status(400).json({ error: 'Missing required fields: either (totalAmount + userAddress) or feeAmount' });
                    return;
                }
                console.log('[SwapRoutes] Submitting platform fee (legacy mode):', {
                    outputToken,
                    feeAmount,
                    backendAddress: this.feeCollectionService.getBackendAddress(),
                });
                const result = await this.feeCollectionService.submitFee(outputToken, feeAmount);
                if (!result.success) {
                    res.status(500).json({
                        error: 'Failed to submit fee',
                        details: result.error,
                    });
                    return;
                }
                console.log('[SwapRoutes] Fee submitted successfully (legacy):', result);
                res.json({
                    success: true,
                    data: {
                        transactionHash: result.transactionHash,
                        outputToken: result.outputToken,
                        feeAmount: result.feeAmount,
                        blockNumber: result.blockNumber,
                    },
                    timestamp: new Date().toISOString(),
                });
            }
            else {
                res.status(400).json({
                    error: 'Missing required fields',
                    details: 'Provide either (totalAmount + userAddress + feeBps) for atomic distribution, or (feeAmount) for legacy collection'
                });
            }
        }
        catch (error) {
            console.error('[SwapRoutes] Error in handleSubmitFee:', error);
            next(error);
        }
    }
    /**
     * GET /accumulated-fees/:token
     * Get accumulated fees for a specific token from FeeCollector
     */
    async handleGetAccumulatedFees(req, res, next) {
        try {
            const { token } = req.params;
            // Validate token address
            if (!ethers_1.ethers.utils.isAddress(token)) {
                res.status(400).json({ error: 'Invalid token address' });
                return;
            }
            // Check if fee collection service is available
            if (!this.feeCollectionService.isAvailable()) {
                res.status(503).json({
                    error: 'Fee collection service not available',
                    details: 'FeeCollector contract not configured',
                });
                return;
            }
            console.log('[SwapRoutes] Fetching accumulated fees for token:', token);
            const accumulatedFees = await this.feeCollectionService.getAccumulatedFees(token);
            const tokenInfo = (0, tokenRegistry_1.getTokenByAddress)(token);
            const decimals = tokenInfo?.decimals || 18;
            const symbol = tokenInfo?.symbol || 'UNKNOWN';
            res.json({
                success: true,
                data: {
                    token,
                    symbol,
                    decimals,
                    accumulatedFees,
                    accumulatedFeesFormatted: ethers_1.ethers.utils.formatUnits(accumulatedFees, decimals),
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error('[SwapRoutes] Error in handleGetAccumulatedFees:', error);
            next(error);
        }
    }
    /**
     * Get router instance
     */
    getRouter() {
        return this.router;
    }
}
exports.SwapRoutes = SwapRoutes;
/**
 * Global error handler middleware
 */
const errorHandler = (
// eslint-disable-next-line @typescript-eslint/no-explicit-any
err, _req, res, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
_next) => {
    console.error('API Error:', err);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        error: err.message || 'Internal server error',
        timestamp: new Date().toISOString(),
    });
};
exports.errorHandler = errorHandler;
/**
 * Request validation middleware
 */
const validateJsonRequest = (req, res, next) => {
    if (req.method !== 'GET' && !req.is('application/json')) {
        res.status(400).json({
            error: 'Content-Type must be application/json',
        });
        return;
    }
    next();
};
exports.validateJsonRequest = validateJsonRequest;
/**
 * Rate limiting middleware (basic implementation)
 */
const createRateLimiter = (maxRequests = 100, windowMs = 60000) => {
    const clients = new Map();
    return (req, res, next) => {
        const clientIp = req.ip || 'unknown';
        const now = Date.now();
        if (!clients.has(clientIp)) {
            clients.set(clientIp, { count: 1, resetTime: now + windowMs });
            return next();
        }
        const client = clients.get(clientIp);
        if (now > client.resetTime) {
            client.count = 1;
            client.resetTime = now + windowMs;
            return next();
        }
        if (client.count >= maxRequests) {
            return res.status(429).json({
                error: 'Too many requests',
                retryAfter: Math.ceil((client.resetTime - now) / 1000),
            });
        }
        client.count++;
        next();
    };
};
exports.createRateLimiter = createRateLimiter;
//# sourceMappingURL=swapRoutes.js.map