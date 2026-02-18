/**
 * Arc Testnet Pool Integration - Central Export File
 * 
 * Import all Arc integration functions and types from a single location:
 * 
 * import {
 *   getSwapQuote,
 *   getPoolBalances,
 *   prepareSwapTransaction,
 *   useArcPools,
 *   ARC_POOLS,
 *   ARC_TESTNET_CONFIG
 * } from "@/lib/arc";
 */

// Core network configuration
export {
  ARC_TESTNET_CONFIG,
  ARC_POOLS,
  SWAP_ROUTER_ABI,
} from "./arcNetwork";

// Core functions
export {
  fetchArcBalance,
  formatBalance,
  getSwapQuote,
  getRouterTokenIndex,
  getRouterTokenIndices,
  getPoolBalances,
  prepareSwapTransaction,
  getPoolInfo,
  listAvailablePools,
  calculatePriceImpact,
} from "./arcNetwork";

// React hook
export { useArcPools } from "./useArcPools";

// Types
export type { PoolState, SwapQuoteState } from "./useArcPools";
