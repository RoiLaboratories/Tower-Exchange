"use client";

/**
 * Bridge Service - Arc Network Bridge Integration
 * 
 * Handles bridging USDC across different EVM blockchains using Arc's Bridge Kit
 * Reference: https://docs.arc.network/app-kit/bridge
 * 
 * This module uses browser APIs (window.ethereum) and must run on the client-side
 */

import { PublicClient, createPublicClient, http, Chain as ViemChain, createWalletClient } from "viem";
import {
  mainnet,
  sepolia,
  base,
  baseSepolia,
  optimism,
  optimismSepolia,
  arbitrum,
  arbitrumSepolia,
  avalanche,
  avalancheFuji,
} from "viem/chains";

// Bridge Kit adapters and chain definitions
import { BridgeKit } from "@circle-fin/bridge-kit";
import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import {
  ArcTestnet,
  ArbitrumSepolia,
  AvalancheFuji,
  BaseSepolia,
  EthereumSepolia,
  LineaSepolia,
  OptimismSepolia,
  PolygonAmoy,
  SonicTestnet,
  UnichainSepolia,
} from "@circle-fin/bridge-kit/chains";

// Chain mapping for viem
const VIEM_CHAIN_MAP: Record<number, ViemChain> = {
  84532: baseSepolia,
  11155420: optimismSepolia,
  43113: avalancheFuji,
  421614: arbitrumSepolia,
  11155111: {
    id: 11155111,
    name: "Ethereum Sepolia",
    network: "ethereum-sepolia",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: ["https://sepolia.drpc.org"] },
      public: { http: ["https://sepolia.drpc.org"] },
    },
  } as ViemChain,
  59141: {
    id: 59141,
    name: "Linea Sepolia",
    network: "linea-sepolia",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: ["https://rpc.sepolia.linea.build"] },
      public: { http: ["https://rpc.sepolia.linea.build"] },
    },
  } as ViemChain,
  80002: {
    id: 80002,
    name: "Polygon Amoy",
    network: "polygon-amoy",
    nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
    rpcUrls: {
      default: { http: ["https://rpc-amoy.polygon.technology"] },
      public: { http: ["https://rpc-amoy.polygon.technology"] },
    },
  } as ViemChain,
  14601: {
    id: 14601,
    name: "Sonic Testnet",
    network: "sonic-testnet",
    nativeCurrency: { name: "Sonic", symbol: "S", decimals: 18 },
    rpcUrls: {
      default: { http: ["https://rpc.testnet.soniclabs.com"] },
      public: { http: ["https://rpc.testnet.soniclabs.com"] },
    },
  } as ViemChain,
  1301: {
    id: 1301,
    name: "Unichain Sepolia",
    network: "unichain-sepolia",
    nativeCurrency: { name: "Uni", symbol: "UNI", decimals: 18 },
    rpcUrls: {
      default: { http: ["https://sepolia.unichain.org"] },
      public: { http: ["https://sepolia.unichain.org"] },
    },
  } as ViemChain,
  5042002: {
    id: 5042002,
    name: "Arc Testnet",
    network: "arc-testnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: ["https://rpc.testnet.arc.network"] },
      public: { http: ["https://rpc.testnet.arc.network"] },
    },
  } as ViemChain,
};

// Chain configurations for supported networks
export const SUPPORTED_CHAINS = {
  "arc-testnet": {
    name: "Arc Testnet",
    chainId: 5042002,
    rpcUrl: "https://rpc.testnet.arc.network",
    circleChain: "Arc_Testnet" as const,
    usdcAddress: "0x3600000000000000000000000000000000000000",
  },
  "base-sepolia": {
    name: "Base Sepolia",
    chainId: 84532,
    rpcUrl: "https://sepolia.base.org",
    circleChain: "Base_Sepolia" as const,
    usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  },
  "optimism-sepolia": {
    name: "Optimism Sepolia",
    chainId: 11155420,
    rpcUrl: "https://sepolia.optimism.io",
    circleChain: "Optimism_Sepolia" as const,
    usdcAddress: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
  },
  "avalanche-fuji": {
    name: "Avalanche Fuji",
    chainId: 43113,
    rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
    circleChain: "Avalanche_Fuji" as const,
    usdcAddress: "0x5425890298aed601595a70ab815c96711a31bc65",
  },
  "arbitrum-sepolia": {
    name: "Arbitrum Sepolia",
    chainId: 421614,
    rpcUrl: "https://sepolia-rpc.arbitrum.io/rpc",
    circleChain: "Arbitrum_Sepolia" as const,
    usdcAddress: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
  },
  "ethereum-sepolia": {
    name: "Ethereum Sepolia",
    chainId: 11155111,
    rpcUrl: "https://sepolia.drpc.org",
    circleChain: "Ethereum_Sepolia" as const,
    usdcAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  },
  "linea-sepolia": {
    name: "Linea Sepolia",
    chainId: 59141,
    rpcUrl: "https://rpc.sepolia.linea.build",
    circleChain: "Linea_Sepolia" as const,
    usdcAddress: "0xfece4462d57bd51a6a552365a011b95f0e16d9b7",
  },
  "polygon-amoy": {
    name: "Polygon Amoy",
    chainId: 80002,
    rpcUrl: "https://rpc-amoy.polygon.technology",
    circleChain: "Polygon_Amoy_Testnet" as const,
    usdcAddress: "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582",
  },
  "sonic-testnet": {
    name: "Sonic Testnet",
    chainId: 14601,
    rpcUrl: "https://rpc.testnet.soniclabs.com",
    circleChain: "Sonic_Testnet" as const,
    usdcAddress: "0x0BA304580ee7c9a980CF72e55f5Ed2E9fd30Bc51",
  },
  "unichain-sepolia": {
    name: "Unichain Sepolia",
    chainId: 1301,
    rpcUrl: "https://sepolia.unichain.org",
    circleChain: "Unichain_Sepolia" as const,
    usdcAddress: "0x31d0220469e10c4E71834a79b1f276d740d3768F",
  },
  solana: {
    name: "Solana Devnet",
    chainId: 900,
    rpcUrl: "https://api.devnet.solana.com",
    circleChain: "Solana_Devnet" as const,
  },
};

/**
 * Circle's bridge fee configuration
 * Circle automatically deducts a fee (~0.00013 USDC) from the bridge amount
 * This is mandatory and cannot be avoided
 * Platform custom fees have been disabled
 */
export const BRIDGE_FEE_CONFIG = {
  // Circle's fee per bridge (varies by chain pair, approximate)
  circleFee: "0.00013",
};

// Bridge request parameters
export interface BridgeRequest {
  fromChain: string;
  toChain: string;
  amount: string; // In token units (e.g., "1.00" for USDC)
  token: string; // Token symbol, usually "USDC"
  toAddress?: string; // Destination wallet address
  sourceAddress?: string; // Source wallet address
}

// Bridge response
export interface BridgeResponse {
  success: boolean;
  transactionHash?: string;
  status?: string;
  error?: string;
  estimatedTime?: string;
}

// Token configuration
export interface SupportedToken {
  symbol: string;
  name: string;
  decimals: number;
  chains: string[]; // Which chains support this token
  chainAddresses: Record<string, string>; // Contract address per chain
  logo?: string; // Logo image path
}

/**
 * Create a single Bridge Kit adapter that supports all EVM chains
 */
/**
 * Create a Bridge Kit adapter from the browser wallet provider
 * Uses Circle's createViemAdapterFromProvider factory function for user-controlled transactions
 */
async function createBridgeKitAdapter(): Promise<any> {
  // Get the EIP1193 provider from the browser window
  const provider = (window as any).ethereum;
  
  if (!provider) {
    throw new Error("No wallet provider found. Please connect your wallet.");
  }

  // Use Circle's factory function with the browser provider directly
  // This creates a user-controlled adapter that connects to the wallet
  const adapter = await createViemAdapterFromProvider({
    provider,
  });

  return adapter;
}

/**
 * Initialize Circle AppKit with the bridge capability
 * AppKit is preferred over BridgeKit for better bridge support
 */
let appKitInstance: AppKit | null = null;
let evmAdapter: any = null;

async function initializeCircleSDK(): Promise<any> {
  if (appKitInstance && evmAdapter) {
    return appKitInstance;
  }

  try {
    // Create the EVM adapter from the browser wallet provider
    evmAdapter = await createBridgeKitAdapter();

    // Initialize AppKit (which includes Bridge capability)
    appKitInstance = new AppKit();

    console.log("Circle AppKit initialized successfully with EVM adapter");
    return appKitInstance;
  } catch (error) {
    console.error("Failed to initialize Circle SDK:", error);
    throw new Error("Failed to initialize bridge service");
  }
}

/**
 * Create a Viem public client for EVM chains
 * Returns a configured client that can be used with Bridge Kit adapters
 */
function createEVMPublicClient(chainId: number, rpcUrl: string): PublicClient {
  const chain = VIEM_CHAIN_MAP[chainId] || {
    id: chainId,
    name: `Chain ${chainId}`,
    network: `chain-${chainId}`,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: [rpcUrl] },
      public: { http: [rpcUrl] },
    },
  };

  return createPublicClient({
    chain: chain as ViemChain,
    transport: http(rpcUrl),
  });
}

/**
 * Bridge tokens from one chain to another
 * 
 * This function executes cross-chain bridge transactions using the user's browser wallet (Privy).
 * The bridge is executed client-side with your wallet's signing capability.
 * 
 * Usage:
 * const result = await bridgeTokens({
 *   fromChain: "base-sepolia",
 *   toChain: "arc-testnet",
 *   amount: "100",
 *   token: "USDC",
 *   toAddress: "0x123...",
 * });
 */
export async function bridgeTokens(
  request: BridgeRequest
): Promise<BridgeResponse> {
  try {
    const fromChainConfig = SUPPORTED_CHAINS[request.fromChain as keyof typeof SUPPORTED_CHAINS];
    const toChainConfig = SUPPORTED_CHAINS[request.toChain as keyof typeof SUPPORTED_CHAINS];

    if (!fromChainConfig || !toChainConfig) {
      return {
        success: false,
        error: `Unsupported chain. Supported: ${Object.keys(SUPPORTED_CHAINS).join(", ")}`,
      };
    }

    // Determine if destination is cross-chain type (EVM <-> Solana)
    const isFromEVM = request.fromChain !== "solana";
    const isToEVM = request.toChain !== "solana";
    const isChainTypeCrossover = isFromEVM !== isToEVM;

    // Validate destination address for cross-chain type transitions
    if (isChainTypeCrossover) {
      if (!request.toAddress) {
        const chainType = isToEVM ? "EVM" : "Solana";
        return {
          success: false,
          error: `Destination ${chainType} address is required when bridging from ${isFromEVM ? "EVM" : "Solana"} to ${isToEVM ? "EVM" : "Solana"}`,
        };
      }

      // Validate address format matches destination chain type
      const addressType = isToEVM ? "evm" : "solana";
      if (!isValidAddress(request.toAddress, addressType)) {
        return {
          success: false,
          error: `Invalid ${addressType.toUpperCase()} address format for destination chain`,
        };
      }
    }

    console.log("Bridge Request (Client-Side with Privy Wallet):", {
      from: fromChainConfig.name,
      to: toChainConfig.name,
      amount: request.amount,
      token: request.token,
      destination: request.toAddress,
      sourceChainId: fromChainConfig.chainId,
      destChainId: toChainConfig.chainId,
    });

    // Use Circle's recommended client-side bridge with browser wallet (Privy)
    const kit = await initializeCircleSDK();
    
    // Get the proper chain objects from Circle's definitions
    const allTokens = getSupportedTokens();
    const tokenDef = allTokens.find(
      (t) => t.symbol.toLowerCase() === (request.token || "USDC").toLowerCase()
    );

    if (!tokenDef) {
      return {
        success: false,
        error: `Unsupported token: ${request.token}`,
      };
    }

    // Map to Circle's chain objects
    const CIRCLE_CHAIN_OBJECTS: Record<string, any> = {
      "arc-testnet": ArcTestnet,
      "base-sepolia": BaseSepolia,
      "optimism-sepolia": OptimismSepolia,
      "avalanche-fuji": AvalancheFuji,
      "arbitrum-sepolia": ArbitrumSepolia,
      "ethereum-sepolia": EthereumSepolia,
      "linea-sepolia": LineaSepolia,
      "polygon-amoy": PolygonAmoy,
      "sonic-testnet": SonicTestnet,
      "unichain-sepolia": UnichainSepolia,
    };

    const fromChainObj = CIRCLE_CHAIN_OBJECTS[request.fromChain];
    const toChainObj = CIRCLE_CHAIN_OBJECTS[request.toChain];

    if (!fromChainObj || !toChainObj) {
      return {
        success: false,
        error: `Chain objects not found for ${request.fromChain} or ${request.toChain}`,
      };
    }

    // Execute bridge using Circle's documented pattern
    // Use the same adapter for both chains (user-controlled adapters auto-detect wallet context)
    const adapter = evmAdapter;
    if (!adapter) {
      return {
        success: false,
        error: "Bridge adapter not initialized. Please connect your wallet.",
      };
    }

    console.log("Executing bridge with adapter:", { 
      fromChain: (fromChainObj as any).name,
      toChain: (toChainObj as any).name,
      amount: request.amount,
      token: request.token,
    });

    // Fee collection disabled - execute bridge without custom fees
    const result = await kit.bridge({
      from: { adapter, chain: fromChainObj },
      to: { adapter, chain: toChainObj },
      amount: request.amount,
      token: request.token as "USDC",
    });

    console.log("Bridge transaction result:", result);
    console.log("Result type:", typeof result);
    console.log("Result keys:", result && typeof result === "object" ? Object.keys(result as object) : "null/undefined");
    console.log("Result state:", (result as any)?.state);
    
    // Don't try to stringify the whole result - it has BigInts
    // Instead log the steps array length and details
    if ((result as any)?.steps && Array.isArray((result as any).steps)) {
      console.log("Result steps count:", (result as any).steps.length);
      (result as any).steps.forEach((step: any, index: number) => {
        console.log(`Step ${index}:`, { name: step.name, state: step.state, txHash: step.txHash });
      });
    }
    
    // Store result globally for easy copying (without JSON.stringify)
    (window as any).__lastBridgeResult = result;
    console.log("Bridge result stored in window.__lastBridgeResult");

    // Extract transaction hash and check result status
    let txHash: string | undefined;
    let errorMessage: string | undefined;

    if (typeof result === "string") {
      // If result is just a string, it's the transaction hash
      txHash = result;
    } else if (result && typeof result === "object") {
      // Check various possible hash properties at root level
      const resultObj = result as any;
      if (typeof resultObj.transactionHash === "string") {
        txHash = resultObj.transactionHash;
      } else if (typeof resultObj.hash === "string") {
        txHash = resultObj.hash;
      } else if (typeof resultObj.txHash === "string") {
        txHash = resultObj.txHash;
      }

      // If no tx hash at root level, check steps array
      if (!txHash && Array.isArray(resultObj.steps)) {
        // Prioritize the "mint" step (final transaction), otherwise take the last step with a txHash
        let lastTxHash: string | undefined;
        for (const step of resultObj.steps) {
          if (step.txHash && typeof step.txHash === "string") {
            lastTxHash = step.txHash;
            // If this is the mint step, use it and break
            if (step.name === "mint") {
              txHash = lastTxHash;
              break;
            }
          }
          if (!txHash && step.transactionHash && typeof step.transactionHash === "string") {
            lastTxHash = step.transactionHash;
            if (step.name === "mint") {
              txHash = lastTxHash;
              break;
            }
          }
        }
        // If no mint step found, use the last txHash we found
        if (!txHash && lastTxHash) {
          txHash = lastTxHash;
        }
      }

      // Check steps array for any errors
      if (Array.isArray(resultObj.steps)) {
        const failedStep = resultObj.steps.find((step: any) => step.state === "error");
        if (failedStep?.error) {
          const stepError = failedStep.error;
          // Extract meaningful error message
          if (typeof stepError === "object") {
            errorMessage = (stepError as any).message || (stepError as any).details || String(stepError);
          } else {
            errorMessage = String(stepError);
          }
        }
      }

      // Circle's response has a 'state' field: 'success', 'pending', 'error', or 'failed'
      // But also check if any step failed (steps might show errors even if state is 'success')
      if (resultObj.state === "error" || resultObj.state === "failed") {
        errorMessage = errorMessage || resultObj.error || "Bridge transaction failed";
      } else if (resultObj.state === "success" && errorMessage) {
        // Steps had errors even though state says success - treat as failure
        errorMessage = `Step failed: ${errorMessage}`;
      }
    }

    // Success only if state is success AND no step errors
    const isSuccess = (result as any)?.state === "success" && !errorMessage;

    if (isSuccess && txHash) {
      return {
        success: true,
        status: "completed",
        estimatedTime: estimateBridgeTime(request.fromChain, request.toChain),
        transactionHash: txHash,
      };
    } else if (isSuccess) {
      // State is success but no tx hash - still pending attestation
      return {
        success: true,
        status: "pending",
        estimatedTime: estimateBridgeTime(request.fromChain, request.toChain),
        transactionHash: txHash,
      };
    } else {
      return {
        success: false,
        error: errorMessage || `Bridge failed with state: ${(result as any)?.state || "unknown"}`,
      };
    }
  } catch (error) {
    console.error("Bridge error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Unknown bridge error",
    };
  }
}

/**
 * Get a viem public client for a specific chain
 * Can be used to initialize Bridge Kit ViemAdapter
 */
export function getViemClient(chainId: string): PublicClient | null {
  const chainConfig = SUPPORTED_CHAINS[chainId as keyof typeof SUPPORTED_CHAINS];
  if (!chainConfig) return null;
  
  return createEVMPublicClient(chainConfig.chainId, chainConfig.rpcUrl);
}

/**
 * Validate if a bridge route is supported
 */
export function isBridgeRouteSupported(
  fromChain: string,
  toChain: string
): boolean {
  const fromSupported = fromChain in SUPPORTED_CHAINS;
  const toSupported = toChain in SUPPORTED_CHAINS;
  const sameChain = fromChain === toChain;

  return fromSupported && toSupported && !sameChain;
}

/**
 * Get supported bridge routes
 */
export function getSupportedBridgeRoutes(): Array<{
  from: string;
  to: string;
  fromName: string;
  toName: string;
}> {
  const routes: Array<{
    from: string;
    to: string;
    fromName: string;
    toName: string;
  }> = [];

  Object.entries(SUPPORTED_CHAINS).forEach(([fromChainId, fromConfig]) => {
    Object.entries(SUPPORTED_CHAINS).forEach(([toChainId, toConfig]) => {
      if (fromChainId !== toChainId) {
        routes.push({
          from: fromChainId,
          to: toChainId,
          fromName: fromConfig.name,
          toName: toConfig.name,
        });
      }
    });
  });

  return routes;
}

/**
 * Get bridge fees for a specific route and amount
 * Returns only Circle's mandatory fee (platform custom fees have been disabled)
 */
export async function getBridgeFees(
  _fromChain: string,
  _toChain: string,
  _amount: string
): Promise<{
  circleFee: string;
  platformFee: string;
  totalFee: string;
  totalWithFees: string;
}> {
  // Only Circle's mandatory fee applies
  const circleFee = parseFloat(BRIDGE_FEE_CONFIG.circleFee);
  const userAmount = parseFloat(_amount) - circleFee;
  
  return {
    circleFee: circleFee.toFixed(6),
    platformFee: "0.00",
    totalFee: circleFee.toFixed(6),
    totalWithFees: userAmount.toFixed(6),
  };
}

/**
 * Get supported tokens for bridging
 * Can filter by chain if needed
 */
export function getSupportedTokens(filterByChain?: string): SupportedToken[] {
  const allTokens: SupportedToken[] = [
    {
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      chains: [
        "arc-testnet",
        "base-sepolia",
        "optimism-sepolia",
        "avalanche-fuji",
        "arbitrum-sepolia",
        "ethereum-sepolia",
        "linea-sepolia",
        "polygon-amoy",
        "sonic-testnet",
        "unichain-sepolia",
      ],
      chainAddresses: {
        "arc-testnet": "0x3600000000000000000000000000000000000000",
        "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        "optimism-sepolia": "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
        "avalanche-fuji": "0x5425890298aed601595a70ab815c96711a31bc65",
        "arbitrum-sepolia": "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
        "ethereum-sepolia": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
        "linea-sepolia": "0xfece4462d57bd51a6a552365a011b95f0e16d9b7",
        "polygon-amoy": "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582",
        "sonic-testnet": "0x0BA304580ee7c9a980CF72e55f5Ed2E9fd30Bc51",
        "unichain-sepolia": "0x31d0220469e10c4E71834a79b1f276d740d3768F",
      },
      logo: "/assets/USDC-fotor-bg-remover-2025111075935.png",
    },
  ];

  if (filterByChain) {
    return allTokens.filter((token) => token.chains.includes(filterByChain));
  }

  return allTokens;
}

/**
 * Get token address for a specific chain
 */
export function getTokenAddressForChain(
  tokenSymbol: string,
  chainId: string
): string | null {
  const tokens = getSupportedTokens();
  const token = tokens.find((t) => t.symbol === tokenSymbol);
  
  if (!token) return null;
  return token.chainAddresses[chainId] || null;
}

/**
 * Get the default USDC token configuration
 */
export function getUSDCToken(): SupportedToken {
  const tokens = getSupportedTokens();
  const usdc = tokens.find((t) => t.symbol === "USDC");
  if (!usdc) {
    throw new Error("USDC token not found in supported tokens");
  }
  return usdc;
}

/**
 * Estimate bridge time between chains
 */
export function estimateBridgeTime(
  fromChain: string,
  toChain: string
): string {
  // Different chains have different settlement times
  const timeMap: Record<string, string> = {
    "arc-testnet": "1-2 minutes",
    "base-sepolia": "2-5 minutes",
    "optimism-sepolia": "3-7 minutes",
    "avalanche-fuji": "2-5 minutes",
    "arbitrum-sepolia": "2-5 minutes",
    solana: "5-15 seconds",
  };

  return timeMap[toChain] || "2-5 minutes";
}

/**
 * Format bridge amount to proper decimal places
 */
export function formatBridgeAmount(amount: string, decimals: number = 6): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return "0.00";
  return num.toFixed(decimals);
}

/**
 * Validate wallet address format based on chain
 */
export function isValidAddress(address: string, chainType: "evm" | "solana"): boolean {
  if (chainType === "evm") {
    // EVM address: 0x followed by 40 hex characters
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  } else if (chainType === "solana") {
    // Solana address: base58, typically 44 characters
    return /^[1-9A-HJ-NP-Z]{44}$/.test(address);
  }
  return false;
}

export default {
  bridgeTokens,
  isBridgeRouteSupported,
  getSupportedBridgeRoutes,
  getSupportedTokens,
  getTokenAddressForChain,
  getUSDCToken,
  getBridgeFees,
  estimateBridgeTime,
  formatBridgeAmount,
  isValidAddress,
  getViemClient,
  createEVMPublicClient: createEVMPublicClient,
  initializeCircleSDK,
  SUPPORTED_CHAINS,
  VIEM_CHAIN_MAP,
};
