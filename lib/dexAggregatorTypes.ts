/**
 * Type definitions exported by the DEX Aggregator SDK
 */

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

export interface SwapTransaction {
  to: string;
  data: string;
  value: string;
  from: string;
  gasLimit: string;
  chainId: number;
}

export interface ApprovalTransaction {
  to: string;
  data: string;
  from: string;
  gasLimit: string;
}

export interface GasEstimate {
  base: string;
  withSlippage: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
}

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

export interface SwapState {
  quote: Quote | null;
  isLoading: boolean;
  error: string | null;
  gasPrice: GasEstimate | null;
}

export interface ExecutionState {
  txHash: string | null;
  isExecuting: boolean;
  error: string | null;
  isApproved: boolean;
  approvalTxHash: string | null;
}
