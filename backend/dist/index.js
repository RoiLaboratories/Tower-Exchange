"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const ethers_1 = require("ethers");
const dotenv_1 = __importDefault(require("dotenv"));
const swapRoutes_1 = require("./routes/swapRoutes");
const DexDiscoveryService_1 = require("./services/DexDiscoveryService");
const RouteOptimizer_1 = require("./services/RouteOptimizer");
const TransactionBuilder_1 = require("./services/TransactionBuilder");
const FeeCollectionService_1 = require("./services/FeeCollectionService");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3001;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(swapRoutes_1.validateJsonRequest);
app.use((0, swapRoutes_1.createRateLimiter)(100, 60000)); // 100 requests per minute
// Initialize Arc testnet configuration
const arcConfig = {
    chainId: 5042002,
    rpcUrl: process.env.ARC_TESTNET_RPC_URL || 'https://rpc.testnet.arc.network',
    towerRouterAddress: process.env.TOWER_ROUTER_ADDRESS || '0x0000000000000000000000000000000000000000',
    feeCollectorAddress: process.env.FEE_COLLECTOR_ADDRESS,
    explorerUrl: 'https://testnet.arcscan.app',
    blockTime: 2000, // 2 seconds (example)
};
// Initialize Ethers provider
const provider = new ethers_1.ethers.providers.JsonRpcProvider(arcConfig.rpcUrl);
// Initialize optimizer config
const optimizerConfig = {
    maxHops: 5,
    maxSplits: 3,
    minLiquidity: ethers_1.ethers.utils.parseEther('1').toString(),
    slippagePercentage: 50, // 0.5%
    gasPriceMultiplier: 1.2,
    timeLimit: 30000, // 30 seconds
};
// Initialize services
let dexService;
let routeOptimizer;
let txBuilder;
let feeCollectionService;
// Health check endpoint
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'Tower Exchange DEX Aggregator',
        chainId: arcConfig.chainId,
        timestamp: new Date().toISOString(),
    });
});
// Initialize services and start server
async function initializeServices() {
    try {
        console.log('Initializing DEX Aggregator services...');
        // Initialize DEX Discovery Service
        dexService = new DexDiscoveryService_1.DexDiscoveryService(provider, arcConfig);
        console.log(`✓ DEX Discovery Service initialized with ${dexService.getAllDexes().length} DEXes`);
        // Initialize Route Optimizer
        routeOptimizer = new RouteOptimizer_1.RouteOptimizer(dexService, optimizerConfig);
        console.log('✓ Route Optimizer initialized');
        // Initialize Transaction Builder
        txBuilder = new TransactionBuilder_1.TransactionBuilder(arcConfig, provider);
        console.log('✓ Transaction Builder initialized');
        // Initialize Fee Collection Service
        feeCollectionService = new FeeCollectionService_1.FeeCollectionService(arcConfig, provider);
        if (feeCollectionService.isAvailable()) {
            console.log(`✓ Fee Collection Service initialized (Backend: ${feeCollectionService.getBackendAddress()})`);
        }
        else {
            console.warn('⚠ Fee Collection Service not available - check FEE_COLLECTOR_ADDRESS and BACKEND_PRIVATE_KEY');
        }
        // Setup swap routes
        const swapRoutes = new swapRoutes_1.SwapRoutes(routeOptimizer, txBuilder, feeCollectionService, dexService, arcConfig);
        app.use('/api/swap', swapRoutes.getRouter());
        // Error handler (must be last)
        app.use(swapRoutes_1.errorHandler);
        console.log('\n✓ All services initialized successfully\n');
    }
    catch (error) {
        console.error('Error initializing services:', error);
        process.exit(1);
    }
}
// Start server
async function start() {
    try {
        await initializeServices();
        app.listen(port, () => {
            console.log(`🚀 Tower Exchange DEX Aggregator running on port ${port}`);
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
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
start();
exports.default = app;
//# sourceMappingURL=index.js.map