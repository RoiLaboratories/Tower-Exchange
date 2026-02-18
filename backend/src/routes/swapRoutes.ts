import { Router, Request, Response, NextFunction } from 'express';
import { ethers } from 'ethers';
import { RouteOptimizer } from '../services/RouteOptimizer';
import { TransactionBuilder } from '../services/TransactionBuilder';
import { DexDiscoveryService } from '../services/DexDiscoveryService';
import { ArcTestnetConfig, Quote } from '../types';

export class SwapRoutes {
  private router: Router;
  private routeOptimizer: RouteOptimizer;
  private txBuilder: TransactionBuilder;
  private dexService: DexDiscoveryService;
  private config: ArcTestnetConfig;

  constructor(
    routeOptimizer: RouteOptimizer,
    txBuilder: TransactionBuilder,
    dexService: DexDiscoveryService,
    config: ArcTestnetConfig
  ) {
    this.router = Router();
    this.routeOptimizer = routeOptimizer;
    this.txBuilder = txBuilder;
    this.dexService = dexService;
    this.config = config;

    this.initializeRoutes();
  }

  /**
   * Initialize all routes
   */
  private initializeRoutes(): void {
    // POST /quote - Get swap quote
    this.router.post('/quote', this.handleQuote.bind(this));

    // POST /build-tx - Build transaction
    this.router.post('/build-tx', this.handleBuildTx.bind(this));

    // POST /approval - Build approval transaction
    this.router.post('/approval', this.handleApproval.bind(this));

    // GET /dexes - Get available DEXes
    this.router.get('/dexes', this.handleGetDexes.bind(this));

    // GET /price - Get current price
    this.router.get('/price', this.handleGetPrice.bind(this));

    // GET /gas-price - Get current gas prices
    this.router.get('/gas-price', this.handleGetGasPrice.bind(this));

    // GET /metrics - Get optimizer metrics
    this.router.get('/metrics', this.handleGetMetrics.bind(this));

    // Health check
    this.router.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
  }

  /**
   * POST /quote
   * Get best swap quote
   */
  private async handleQuote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { inputToken, outputToken, inputAmount } = req.body;

      // Validate input
      if (!ethers.utils.isAddress(inputToken) || !ethers.utils.isAddress(outputToken)) {
        res.status(400).json({ error: 'Invalid token addresses' });
        return;
      }

      if (!inputAmount || ethers.BigNumber.from(inputAmount).isZero()) {
        res.status(400).json({ error: 'Invalid input amount' });
        return;
      }

      // Get quote
      const quote = await this.routeOptimizer.getQuote(inputToken, outputToken, inputAmount);

      if (!quote) {
        res.status(404).json({ error: 'No route found for this swap' });
        return;
      }

      res.json({
        success: true,
        data: quote,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /build-tx
   * Build signed transaction for swap
   */
  private async handleBuildTx(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { quote, userAddress, referrer } = req.body;

      // Validate input
      if (!quote || !userAddress) {
        res.status(400).json({ error: 'Missing required fields: quote, userAddress' });
        return;
      }

      if (!ethers.utils.isAddress(userAddress)) {
        res.status(400).json({ error: 'Invalid user address' });
        return;
      }

      // Build transaction (with auto-approval if needed)
      console.log('[SwapRoutes] Building transaction for quote:', {
        inputToken: quote.inputToken,
        outputToken: quote.outputToken,
        inputAmount: quote.inputAmount,
        outputAmount: quote.outputAmount,
        dex: (quote as any).route?.hops?.[0]?.dexName,
      });

      const { approval, swap: swapTx } = await this.txBuilder.buildSwapTransactionWithApproval(
        quote as Quote,
        userAddress,
        referrer
      );

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
    } catch (error) {
      console.error('[SwapRoutes] Error in handleBuildTx:', error);
      next(error);
    }
  }

  /**
   * POST /approval
   * Build approval transaction
   */
  private async handleApproval(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tokenAddress, spenderAddress, amount, userAddress } = req.body;

      // Validate input
      if (!ethers.utils.isAddress(tokenAddress) || !ethers.utils.isAddress(spenderAddress)) {
        res.status(400).json({ error: 'Invalid token or spender address' });
        return;
      }

      if (!userAddress || !ethers.utils.isAddress(userAddress)) {
        res.status(400).json({ error: 'Invalid user address' });
        return;
      }

      // Build approval transaction
      const approval = this.txBuilder.buildApprovalTransaction(
        tokenAddress,
        spenderAddress,
        amount || ethers.constants.MaxUint256.toString(),
        userAddress
      );

      res.json({
        success: true,
        data: approval,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /dexes
   * Get list of available DEXes
   */
  private async handleGetDexes(_req: Request, res: Response, next: NextFunction) {
    try {
      const dexes = this.dexService.getAllDexes();

      res.json({
        success: true,
        data: dexes,
        count: dexes.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /price
   * Get current price for token pair
   */
  private async handleGetPrice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token0, token1, dex } = req.query;

      if (!token0 || !token1) {
        res.status(400).json({ error: 'Missing token0 or token1 parameter' });
        return;
      }

      const token0Str = String(token0);
      const token1Str = String(token1);

      if (!ethers.utils.isAddress(token0Str) || !ethers.utils.isAddress(token1Str)) {
        res.status(400).json({ error: 'Invalid token addresses' });
        return;
      }

      let price: number | null = null;
      let dexId = dex ? String(dex) : 'best';

      if (dex) {
        price = await this.dexService.getPrice(String(dex), token0Str, token1Str);
      } else {
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
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /gas-price
   * Get current gas prices
   */
  private async handleGetGasPrice(_req: Request, res: Response, next: NextFunction) {
    try {
      const gasPrices = await this.txBuilder.getGasPrice();

      res.json({
        success: true,
        data: gasPrices,
        chainId: this.config.chainId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /metrics
   * Get router optimizer metrics
   */
  private async handleGetMetrics(_req: Request, res: Response, next: NextFunction) {
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
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get router instance
   */
  getRouter(): Router {
    return this.router;
  }
}

/**
 * Global error handler middleware
 */
export const errorHandler = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  err: any,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) => {
  console.error('API Error:', err);

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString(),
  });
};

/**
 * Request validation middleware
 */
export const validateJsonRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.method !== 'GET' && !req.is('application/json')) {
    res.status(400).json({
      error: 'Content-Type must be application/json',
    });
    return;
  }
  next();
};

/**
 * Rate limiting middleware (basic implementation)
 */
export const createRateLimiter = (maxRequests: number = 100, windowMs: number = 60000) => {
  const clients = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp = req.ip || 'unknown';
    const now = Date.now();

    if (!clients.has(clientIp)) {
      clients.set(clientIp, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const client = clients.get(clientIp)!;

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
