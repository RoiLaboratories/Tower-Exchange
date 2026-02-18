/**
 * Type definitions for DEX Aggregator
 */

export interface DexInfo {
  id: string;
  name: string;
  routerAddress: string;
  factoryAddress: string;
  type: 'v2' | 'v3' | 'stable';
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
  fee?: number; // For V3
  liquidity?: string;
  lastUpdated: number;
}

export interface Quote {
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  outputAmount: string;
  route: SwapRoute;
  priceImpact: number; // in basis points
  gasEstimate: string;
  slippage: number; // in basis points
  exec_price: number;
  minOut: string;
}

export interface SwapRoute {
  type: 'single' | 'multi' | 'split';
  hops: RouteHop[];
  totalFee: number; // in basis points
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
  percentage: number; // 0-100
  amountIn: string;
  amountOut: string;
  priceImpact: number;
}

export interface SwapTransaction {
  to: string; // TowerRouter address
  data: string; // Encoded function call
  value: string; // ETH value (0 for ERC20)
  from: string;
  gasLimit: string;
  chainId: number;
}

export interface ApprovalTransaction {
  to: string; // Token contract address
  data: string; // approve() encoded call
  from: string;
  gasLimit: string;
}

export interface RouteOptimizerConfig {
  maxHops: number;
  maxSplits: number;
  minLiquidity: string;
  slippagePercentage: number; // 0-100
  gasPriceMultiplier: number;
  timeLimit: number; // milliseconds
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
  explorerUrl: string;
  blockTime: number;
}
