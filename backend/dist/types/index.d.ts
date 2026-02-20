/**
 * Type definitions for DEX Aggregator
 */
export interface DexInfo {
    id: string;
    name: string;
    routerAddress: string;
    factoryAddress: string;
    type: 'v2' | 'v3' | 'stable' | 'pool-based';
    chainId: number;
    enabled: boolean;
    supportedTokens: string[];
}
export interface PoolData {
    id: string;
    dexId: string;
    token0: string;
    token1: string;
    reserve0: string;
    reserve1: string;
    fee?: number;
    liquidity?: string;
    lastUpdated: number;
}
export interface Quote {
    inputToken: string;
    outputToken: string;
    inputAmount: string;
    outputAmount: string;
    route: SwapRoute;
    priceImpact: number;
    gasEstimate: string;
    slippage: number;
    exec_price: number;
    minOut: string;
}
export interface SwapRoute {
    type: 'single' | 'multi' | 'split';
    hops: RouteHop[];
    totalFee: number;
    estimatedOutput: string;
}
export interface RouteHop {
    dexId: string;
    dexName: string;
    dexRouter: string;
    path: string[];
    amountIn: string;
    amountOut: string;
    priceImpact: number;
    liquidity: string;
}
export interface SplitRoute {
    dexId: string;
    dexName: string;
    dexRouter: string;
    path: string[];
    percentage: number;
    amountIn: string;
    amountOut: string;
    priceImpact: number;
}
export interface SwapTransaction {
    to: string;
    data: string;
    value: string;
    from: string;
    gasLimit: string;
    chainId: number;
    platformFeeAmount?: string;
    expectedUserOutput?: string;
    expectedFeeCollectorOutput?: string;
}
export interface ApprovalTransaction {
    to: string;
    data: string;
    from: string;
    gasLimit: string;
}
export interface RouteOptimizerConfig {
    maxHops: number;
    maxSplits: number;
    minLiquidity: string;
    slippagePercentage: number;
    gasPriceMultiplier: number;
    timeLimit: number;
}
export interface LiquidityData {
    reserve0: bigint;
    reserve1: bigint;
    fee?: number;
    totalLiquidity?: bigint;
}
export interface TokenInfo {
    address: string;
    symbol: string;
    decimals: number;
    name: string;
}
export interface PriceData {
    token: string;
    price: number;
    priceInWei: string;
    timestamp: number;
}
export interface GasEstimate {
    base: string;
    withSlippage: string;
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
}
export interface ArcTestnetConfig {
    chainId: number;
    rpcUrl: string;
    towerRouterAddress: string;
    feeCollectorAddress?: string;
    explorerUrl: string;
    blockTime: number;
}
export interface FeeCollectionResult {
    success: boolean;
    transactionHash?: string;
    outputToken: string;
    feeAmount: string;
    blockNumber?: number;
    error?: string;
}
//# sourceMappingURL=index.d.ts.map