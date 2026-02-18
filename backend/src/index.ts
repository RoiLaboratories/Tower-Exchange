import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import {
  SwapRoutes,
  errorHandler,
  validateJsonRequest,
  createRateLimiter,
} from './routes/swapRoutes';
import { DexDiscoveryService } from './services/DexDiscoveryService';
import { RouteOptimizer } from './services/RouteOptimizer';
import { TransactionBuilder } from './services/TransactionBuilder';
import { ArcTestnetConfig, RouteOptimizerConfig } from './types';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(validateJsonRequest);
app.use(createRateLimiter(100, 60000)); // 100 requests per minute

// Initialize Arc testnet configuration
const arcConfig: ArcTestnetConfig = {
  chainId: 5042002,
  rpcUrl: process.env.ARC_TESTNET_RPC_URL || 'https://rpc.testnet.arc.network',
  towerRouterAddress: process.env.TOWER_ROUTER_ADDRESS || '0x0000000000000000000000000000000000000000',
  explorerUrl: 'https://testnet.arcscan.app',
  blockTime: 2000, // 2 seconds (example)
};

// Initialize Ethers provider
const provider = new ethers.providers.JsonRpcProvider(arcConfig.rpcUrl);

// Initialize optimizer config
const optimizerConfig: RouteOptimizerConfig = {
  maxHops: 5,
  maxSplits: 3,
  minLiquidity: ethers.utils.parseEther('1').toString(),
  slippagePercentage: 50, // 0.5%
  gasPriceMultiplier: 1.2,
  timeLimit: 30000, // 30 seconds
};

// Initialize services
let dexService: DexDiscoveryService;
let routeOptimizer: RouteOptimizer;
let txBuilder: TransactionBuilder;

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Tower Finance DEX Aggregator',
    chainId: arcConfig.chainId,
    timestamp: new Date().toISOString(),
  });
});

// Initialize services and start server
async function initializeServices() {
  try {
    console.log('Initializing DEX Aggregator services...');

    // Initialize DEX Discovery Service
    dexService = new DexDiscoveryService(provider, arcConfig);
    console.log(`✓ DEX Discovery Service initialized with ${dexService.getAllDexes().length} DEXes`);

    // Initialize Route Optimizer
    routeOptimizer = new RouteOptimizer(dexService, optimizerConfig);
    console.log('✓ Route Optimizer initialized');

    // Initialize Transaction Builder
    txBuilder = new TransactionBuilder(arcConfig, provider);
    console.log('✓ Transaction Builder initialized');

    // Setup swap routes
    const swapRoutes = new SwapRoutes(routeOptimizer, txBuilder, dexService, arcConfig);
    app.use('/api/swap', swapRoutes.getRouter());

    // Error handler (must be last)
    app.use(errorHandler);

    console.log('\n✓ All services initialized successfully\n');
  } catch (error) {
    console.error('Error initializing services:', error);
    process.exit(1);
  }
}

// Start server
async function start() {
  try {
    await initializeServices();

    app.listen(port, () => {
      console.log(`🚀 Tower Finance DEX Aggregator running on port ${port}`);
      console.log(`📍 Arc Testnet RPC: ${arcConfig.rpcUrl}`);
      console.log(`🔄 Tower Router: ${arcConfig.towerRouterAddress}`);
      console.log(`\n📚 API Documentation:`);
      console.log(`   POST /api/swap/quote - Get swap quote`);
      console.log(`   POST /api/swap/build-tx - Build swap transaction`);
      console.log(`   POST /api/swap/approval - Build approval transaction`);
      console.log(`   GET  /api/swap/dexes - List available DEXes`);
      console.log(`   GET  /api/swap/price - Get token price`);
      console.log(`   GET  /api/swap/gas-price - Get gas prices`);
      console.log(`   GET  /api/swap/metrics - Get optimizer metrics`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

export default app;
