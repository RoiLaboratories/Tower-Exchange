
/**
 * Bridge Service - Arc Network Bridge Integration
 * 
 * Handles bridging USDC across different EVM blockchains using Arc's Bridge Kit
 * Reference: https://docs.arc.network/app-kit/bridge
 * 
 * This module uses browser APIs (window.ethereum) and must run on the client-side
 */

import {
  PublicClient,
  createPublicClient,
  createWalletClient,
  http,
  Chain as ViemChain,
  type EIP1193Provider,
} from "viem";
import {
  baseSepolia,
  optimismSepolia,
  arbitrumSepolia,
  avalancheFuji,
} from "viem/chains";

// Bridge Kit adapters and chain definitions
import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import { createSolanaKitAdapterFromProvider } from "@circle-fin/adapter-solana-kit";
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
  SolanaDevnet,
} from "@circle-fin/bridge-kit/chains";

// Chain mapping for viem
const VIEM_CHAIN_MAP: Record<number, ViemChain> = {
  // Testnet chains
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
  // PRODUCTION CHAINS
  "arc-testnet": {
    name: "Arc Testnet",
    chainId: 5042002,
    rpcUrl: "https://rpc.testnet.arc.network",
    nativeTokenSymbol: "USDC",
    circleChain: "Arc_Testnet" as const,
    usdcAddress: "0x3600000000000000000000000000000000000000",
  },
  "base-sepolia": {
    name: "Base Sepolia",
    chainId: 84532,
    rpcUrl: "https://sepolia.base.org",
    nativeTokenSymbol: "ETH",
    circleChain: "Base_Sepolia" as const,
    usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  },
  "optimism-sepolia": {
    name: "Optimism Sepolia",
    chainId: 11155420,
    rpcUrl: "https://sepolia.optimism.io",
    nativeTokenSymbol: "ETH",
    circleChain: "Optimism_Sepolia" as const,
    usdcAddress: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
  },
  "avalanche-fuji": {
    name: "Avalanche Fuji",
    chainId: 43113,
    rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
    nativeTokenSymbol: "AVAX",
    circleChain: "Avalanche_Fuji" as const,
    usdcAddress: "0x5425890298aed601595a70ab815c96711a31bc65",
  },
  "arbitrum-sepolia": {
    name: "Arbitrum Sepolia",
    chainId: 421614,
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    nativeTokenSymbol: "ETH",
    circleChain: "Arbitrum_Sepolia" as const,
    usdcAddress: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
  },
  "ethereum-sepolia": {
    name: "Ethereum Sepolia",
    chainId: 11155111,
    rpcUrl: "https://sepolia.drpc.org",
    nativeTokenSymbol: "ETH",
    circleChain: "Ethereum_Sepolia" as const,
    usdcAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  },
  "linea-sepolia": {
    name: "Linea Sepolia",
    chainId: 59141,
    rpcUrl: "https://rpc.sepolia.linea.build",
    nativeTokenSymbol: "ETH",
    circleChain: "Linea_Sepolia" as const,
    usdcAddress: "0xfece4462d57bd51a6a552365a011b95f0e16d9b7",
  },
  "polygon-amoy": {
    name: "Polygon Amoy",
    chainId: 80002,
    rpcUrl: "https://rpc-amoy.polygon.technology",
    nativeTokenSymbol: "POL",
    circleChain: "Polygon_Amoy_Testnet" as const,
    usdcAddress: "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582",
  },
  "sonic-testnet": {
    name: "Sonic Testnet",
    chainId: 14601,
    rpcUrl: "https://rpc.testnet.soniclabs.com",
    nativeTokenSymbol: "S",
    circleChain: "Sonic_Testnet" as const,
    usdcAddress: "0x0BA304580ee7c9a980CF72e55f5Ed2E9fd30Bc51",
  },
  "unichain-sepolia": {
    name: "Unichain Sepolia",
    chainId: 1301,
    rpcUrl: "https://sepolia.unichain.org",
    nativeTokenSymbol: "UNI",
    circleChain: "Unichain_Sepolia" as const,
    usdcAddress: "0x31d0220469e10c4E71834a79b1f276d740d3768F",
  },
};

const SUPPORTED_EVM_CIRCLE_CHAINS = [
  ArcTestnet,
  BaseSepolia,
  OptimismSepolia,
  AvalancheFuji,
  ArbitrumSepolia,
  EthereumSepolia,
  LineaSepolia,
  PolygonAmoy,
  SonicTestnet,
  UnichainSepolia,
] as const;

const BRIDGE_STEP_RECEIPT_TIMEOUT_MS = 5 * 60 * 1000;
const BRIDGE_EXECUTION_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_USE_CIRCLE_FORWARDER = true;
const ACTIONABLE_PENDING_BRIDGE_STEPS = new Set([
  "burn",
  "depositForBurn",
  "fetchAttestation",
  "mint",
]);
const CHAIN_SWITCH_RESTORE_DELAY_MS = 350;

export type BridgeProgressSnapshot = {
  lastStep?: string;
  lastTxHash?: string;
  lastExplorerUrl?: string;
  events: Array<{
    step: string;
    txHash?: string;
    explorerUrl?: string;
  }>;
};

function getBridgeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }

  return "Unknown bridge error";
}

function isBridgeTimeoutError(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes("timeout") ||
    normalizedMessage.includes("timed out") ||
    normalizedMessage.includes("execution exceeded")
  );
}

function isBridgeNetworkError(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes("network") ||
    normalizedMessage.includes("connection") ||
    normalizedMessage.includes("rpc") ||
    normalizedMessage.includes("fetch failed")
  );
}

function hasActionableBridgeProgress(progress: BridgeProgressSnapshot): boolean {
  return progress.events.some((event) =>
    ACTIONABLE_PENDING_BRIDGE_STEPS.has(event.step)
  );
}

function createPendingBridgeMessage(progress: BridgeProgressSnapshot): string {
  switch (progress.lastStep) {
    case "mint":
      return "Bridge mint transaction was submitted and is still confirming on the destination chain. Check your wallet or the explorer while it finishes.";
    case "fetchAttestation":
      return "Bridge burn transaction succeeded and Circle is still finalizing the attestation. The transfer is still in progress.";
    case "burn":
    case "depositForBurn":
      return "Bridge burn transaction was submitted and is still settling on the source chain. The transfer is still in progress.";
    default:
      return "Bridge transaction was submitted and is still processing on-chain. Check your wallet or the explorer while it finishes.";
  }
}

function withBridgeTransactionTimeouts<T>(adapter: T): T {
  const candidate = adapter as T & {
    waitForTransaction?: (
      txHash: string,
      config: { confirmations?: number; timeout?: number } | undefined,
      chain: unknown
    ) => Promise<unknown>;
    __towerBridgeTimeoutPatched?: boolean;
  };

  if (
    !candidate ||
    typeof candidate.waitForTransaction !== "function" ||
    candidate.__towerBridgeTimeoutPatched
  ) {
    return adapter;
  }

  const originalWaitForTransaction = candidate.waitForTransaction.bind(candidate);
  candidate.waitForTransaction = (txHash, config, chain) =>
    originalWaitForTransaction(
      txHash,
      {
        ...config,
        timeout: config?.timeout ?? BRIDGE_STEP_RECEIPT_TIMEOUT_MS,
      },
      chain
    );
  candidate.__towerBridgeTimeoutPatched = true;

  return adapter;
}

async function getActiveWalletChainId(): Promise<string | null> {
  const provider = (window as Window & { ethereum?: EIP1193Provider }).ethereum;

  if (!provider) {
    return null;
  }

  try {
    const chainId = await provider.request({ method: "eth_chainId" });
    return typeof chainId === "string" ? chainId : null;
  } catch (error) {
    console.warn("Unable to read active wallet chain before bridge:", error);
    return null;
  }
}

async function restoreActiveWalletChain(initialChainId: string | null) {
  const provider = (window as Window & { ethereum?: EIP1193Provider }).ethereum;

  if (!provider || !initialChainId) {
    return;
  }

  try {
    const currentChainId = await provider.request({ method: "eth_chainId" });

    if (currentChainId === initialChainId) {
      return;
    }

    window.setTimeout(() => {
      void provider
        .request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: initialChainId }],
        })
        .catch((error) => {
          console.warn("Unable to restore wallet network after bridge:", error);
        });
    }, CHAIN_SWITCH_RESTORE_DELAY_MS);
  } catch (error) {
    console.warn("Unable to check wallet network after bridge:", error);
  }
}

/**
 * Circle's bridge fee configuration
 * Circle automatically deducts a fee (~0.00013 USDC) from the bridge amount
 * This is mandatory and cannot be avoided
 * Platform custom fees have been disabled
 */
export const BRIDGE_FEE_CONFIG: Record<string, string> = {
  // Circle's fee per bridge (varies by chain pair, approximate)
  USDC: "0.00013",
};

// Bridge request parameters
export interface BridgeRequest {
  fromChain: string;
  toChain: string;
  amount: string; // In token units (e.g., "1.00" for USDC)
  token: string; // Token symbol, usually "USDC"
  toAddress?: string; // Destination wallet address
  sourceAddress?: string; // Source wallet address
  // Optional: For RainbowKit/wagmi integration - provide pre-configured viem clients
  publicClient?: any; // PublicClient from usePublicClient();
  walletClient?: any; // WalletClient from useWalletClient();
  chain?: any; // Chain object from useAccount() or useChainId();
  useForwarder?: boolean; // Let Circle submit the destination mint transaction.
  onProgress?: (progress: BridgeProgressSnapshot) => void;
}

// Bridge response
export interface BridgeResponse {
  success: boolean;
  transactionHash?: string;
  status?: string;
  error?: string;
  estimatedTime?: string;
  message?: string; // Additional info message (e.g., pending settlement status)
  forwarded?: boolean;
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
 * Create a single Bridge Kit adapter for the bridgeable EVM testnets we support
 */
/**
 * Create a Bridge Kit adapter from the browser wallet provider
 * Uses Circle's createViemAdapterFromProvider factory function for user-controlled transactions
 * 
 * Works with both Privy and RainbowKit/wagmi
 */
async function createBridgeKitAdapter(): Promise<
  Awaited<ReturnType<typeof createViemAdapterFromProvider>>
> {
  // Get the EIP1193 provider from the browser window
  let provider = (window as Window & { ethereum?: EIP1193Provider }).ethereum;
  
  // For RainbowKit: Check if provider exists and has the expected methods
  if (provider) {
    console.log("Wallet provider found at window.ethereum", {
      hasRequest: typeof (provider as any).request === "function",
      providerName: (provider as any).name || "unknown",
    });
  } else {
    console.warn("No provider at window.ethereum - checking for RainbowKit/wagmi providers");
    
    // Try to find wagmi-injected providers
    if ((window as any).ethereum) {
      provider = (window as any).ethereum;
      console.log("Found wagmi provider at window.ethereum");
    } else {
      throw new Error(
        "No wallet provider found. Please ensure RainbowKit/MetaMask is installed and connected. " +
        "If using RainbowKit, verify the wallet connector is properly configured."
      );
    }
  }

  if (!provider || typeof (provider as any).request !== "function") {
    throw new Error(
      "Provider does not have EIP1193 methods. " +
      "This may indicate RainbowKit is not properly connected. " +
      "Please check your wallet connection in the browser."
    );
  }

  // Use Circle's factory function with the browser provider directly
  // This automatically handles wallet client creation from the provider
  // Route read-only calls through our API to avoid CORS issues
  // CRITICAL: let viem retry aggressively, but also extend the transaction receipt
  // wait at the adapter layer because AppKit calls waitForTransaction without a timeout.
  try {
    const adapter = await createViemAdapterFromProvider({
      provider,
      getPublicClient: ({ chain }) =>
        createPublicClient({
          chain,
          transport: http(`/api/rpc/${chain.id}`, {
            retryCount: 10, // Retry up to 10 times for slow testnets
            timeout: 180000, // Per-request RPC timeout
          }),
          // Polling settings for transaction receipt - helps with slower block times
          pollingInterval: 2000, // Poll every 2 seconds instead of viem's default
        }),
      capabilities: {
        addressContext: "user-controlled",
        supportedChains: [...SUPPORTED_EVM_CIRCLE_CHAINS],
      },
    });

    console.log("Bridge adapter created successfully with extended receipt timeout");
    return withBridgeTransactionTimeouts(adapter);
  } catch (error) {
    console.error("Failed to create bridge adapter:", error);
    throw new Error(
      `Bridge adapter creation failed: ${error instanceof Error ? error.message : String(error)}. ` +
      `This may indicate the wallet provider is not compatible with Circle's Bridge Kit. ` +
      `If using RainbowKit, ensure your wallet connector supports EIP1193.`
    );
  }
}

/**
 * Create a Bridge Kit adapter from pre-configured viem clients
 * This is specifically for RainbowKit/wagmi integration
 * 
 * Usage (from a React component with wagmi hooks):
 * ```tsx
 * const publicClient = usePublicClient();
 * const { data: walletClient } = useWalletClient();
 * const adapter = await createBridgeKitAdapterFromClients(publicClient, walletClient, chain);
 * ```
 */
export async function createBridgeKitAdapterFromClients(
  publicClient: PublicClient | undefined,
  walletClient: any | undefined,
  chain: any,
): Promise<any> {
  if (!publicClient) {
    throw new Error("Public client not available. RainbowKit may not be connected.");
  }
  
  if (!walletClient) {
    throw new Error("Wallet client not available. RainbowKit wallet may not be connected.");
  }

  if (!chain) {
    throw new Error("Chain information is required.");
  }

  // Create a simple adapter that directly returns the provided clients
  // This bypasses Circle's factory and uses our already-configured wagmi clients
  const adapter = {
    getPublicClient: async () => publicClient,
    getWalletClient: async () => walletClient,
    // Metadata for Circle
    getSupportedChains: async () => [...SUPPORTED_EVM_CIRCLE_CHAINS],
  };

  console.log("Bridge adapter created from RainbowKit/wagmi clients");
  return adapter;
}

/**
 * Initialize Circle AppKit with the bridge capability
 * AppKit is preferred over BridgeKit for better bridge support
 */
let appKitInstance: AppKit | null = null;
let evmAdapter: any = null;
let solanaAdapter: any = null;

/**
 * Helper function to initialize Solana adapter from wallet provider
 * Returns null if Solana wallet is not available
 */
async function initializeSolanaAdapter(): Promise<any> {
  try {
    const solanaWindow = (window as any).solana;
    if (!solanaWindow) {
      console.warn("Solana wallet not found - Phantom not installed");
      return null;
    }

    // Request connection to Phantom wallet
    try {
      await solanaWindow.connect();
      console.log("Connected to Phantom wallet");
    } catch (connectError) {
      console.warn("User rejected Phantom connection or already connected:", connectError);
      // Continue anyway - wallet might already be connected
    }

    // Create adapter with connected wallet
    const adapter = await createSolanaKitAdapterFromProvider({
      provider: solanaWindow,
    });
    console.log("Solana adapter initialized successfully");
    return adapter;
  } catch (error) {
    console.warn("Failed to initialize Solana adapter:", error);
    return null;
  }
}

async function initializeCircleSDK(): Promise<any> {
  if (appKitInstance && evmAdapter) {
    return appKitInstance;
  }

  try {
    // Create the EVM adapter from the browser wallet provider
    evmAdapter = await createBridgeKitAdapter();

    // Initialize Solana adapter if Solana wallet is available
    solanaAdapter = await initializeSolanaAdapter();

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
  const bridgeProgress: BridgeProgressSnapshot = { events: [] };
  (window as any).__lastBridgeProgress = bridgeProgress;
  const initialWalletChainId = await getActiveWalletChainId();

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

    console.log("Bridge Request:", {
      from: fromChainConfig.name,
      to: toChainConfig.name,
      amount: request.amount,
      token: request.token,
      destination: request.toAddress,
      sourceChainId: fromChainConfig.chainId,
      destChainId: toChainConfig.chainId,
      hasCustomClients: !!request.publicClient,
      useForwarder: request.useForwarder ?? DEFAULT_USE_CIRCLE_FORWARDER,
    });

    // Use Circle's recommended client-side bridge with browser wallet
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
      // Testnet chains
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
      "solana": SolanaDevnet,
    };

    const fromChainObj = CIRCLE_CHAIN_OBJECTS[request.fromChain];
    const toChainObj = CIRCLE_CHAIN_OBJECTS[request.toChain];

    if (!fromChainObj || !toChainObj) {
      return {
        success: false,
        error: `Chain objects not found for ${request.fromChain} or ${request.toChain}`,
      };
    }

    const useForwarder = request.useForwarder ?? DEFAULT_USE_CIRCLE_FORWARDER;

    // Determine adapters based on chain types
    let fromAdapter = evmAdapter;
    let toAdapter = evmAdapter;

    // For cross-chain bridges (EVM → Solana), only use EVM adapter
    // The destination address is provided by the user, not from a connected wallet
    const isEVMtoSolana = request.fromChain !== "solana" && request.toChain === "solana";
    const isSolanatoEVM = request.fromChain === "solana" && request.toChain !== "solana";

    // Check for cross-chain type transfers (not currently supported by Circle)
    if (isEVMtoSolana || isSolanatoEVM) {
      return {
        success: false,
        error: "Cross-chain transfers between EVM and Solana are not yet supported by Circle's Bridge Kit. Circle currently only supports EVM-to-EVM or Solana-to-Solana transfers.",
      };
    }

    // For EVM → EVM: Only EVM adapter needed, destination address is manual
    if (!isEVMtoSolana && request.toChain !== "solana") {
      if (!request.toAddress) {
        return {
          success: false,
          error: "Destination address is required",
        };
      }
    }

    // For Solana → EVM or Solana → Solana: Need Solana adapter
    if (request.fromChain === "solana") {
      if (!solanaAdapter) {
        solanaAdapter = await initializeSolanaAdapter();
      }
      if (!solanaAdapter) {
        return {
          success: false,
          error: "Phantom wallet not connected. Please connect Phantom to Solana Devnet.",
        };
      }
      fromAdapter = solanaAdapter;
    }

    if (request.toChain === "solana" && request.fromChain === "solana") {
      if (!solanaAdapter) {
        solanaAdapter = await initializeSolanaAdapter();
      }
      if (!solanaAdapter) {
        return {
          success: false,
          error: "Phantom wallet not connected. Please connect Phantom to Solana Devnet.",
        };
      }
      toAdapter = solanaAdapter;
    }

    // Validate that adapters are initialized
    if (!fromAdapter) {
      return {
        success: false,
        error: "Bridge adapter not initialized. Please connect your wallet.",
      };
    }

    if (!toAdapter) {
      return {
        success: false,
        error: "Destination adapter not initialized. Please ensure required wallet is connected.",
      };
    }

    console.log("Executing bridge with adapter:", { 
      fromChain: (fromChainObj as any).name,
      toChain: (toChainObj as any).name,
      amount: request.amount,
      token: request.token,
      useForwarder,
    });

    // Circle's AppKit only supports USDC bridging
    // EURC bridging is not yet supported by Circle's bridge SDK
    if (request.token && request.token !== "USDC") {
      return {
        success: false,
        error: `${request.token} bridging is not yet supported. Only USDC can be bridged at this time.`,
      };
    }

    // Ensure wallet is properly connected by requesting accounts before bridge
    try {
      const provider = (window as Window & { ethereum?: EIP1193Provider }).ethereum;
      if (provider) {
        const accounts = await provider.request({
          method: "eth_requestAccounts",
        }) as string[];
        console.log("Wallet accounts confirmed before bridge:", accounts[0]);
      }
    } catch (e) {
      console.warn("Could not confirm wallet accounts:", e);
      // Continue anyway - wallet might still be connected from adapter
    }

    // Fee collection disabled - execute bridge without custom fees
    console.log("Starting bridge execution...");
    console.log("Bridge adapter info:", {
      fromChain: (fromChainObj as any).name,
      toChain: (toChainObj as any).name,
      adapterReady: !!fromAdapter,
      walletConnected: !!fromAdapter,
    });
    
    const startTime = Date.now();
    const bridgeEventHandler = (event: any) => {
      const step =
        typeof event?.method === "string" ? event.method : "unknown";
      const values =
        event && typeof event === "object" && event.values && typeof event.values === "object"
          ? event.values
          : {};
      const txHash =
        typeof (values as Record<string, unknown>).txHash === "string"
          ? ((values as Record<string, unknown>).txHash as string)
          : undefined;
      const explorerUrl =
        typeof (values as Record<string, unknown>).explorerUrl === "string"
          ? ((values as Record<string, unknown>).explorerUrl as string)
          : undefined;

      bridgeProgress.lastStep = step;
      if (txHash) {
        bridgeProgress.lastTxHash = txHash;
      }
      if (explorerUrl) {
        bridgeProgress.lastExplorerUrl = explorerUrl;
      }
      bridgeProgress.events.push({ step, txHash, explorerUrl });

      (window as any).__lastBridgeProgress = bridgeProgress;
      request.onProgress?.({
        ...bridgeProgress,
        events: [...bridgeProgress.events],
      });
      console.log(`Bridge event [${step}]`, { txHash, explorerUrl, values });
    };

    let timeoutId: number | undefined;
    let result: unknown;

    kit.on("*", bridgeEventHandler);

    try {
      const bridgeDestination: Record<string, unknown> = {
        chain: toChainObj,
      };

      if (request.toAddress) {
        bridgeDestination.recipientAddress = request.toAddress;
      }

      if (useForwarder && request.toAddress) {
        bridgeDestination.useForwarder = true;
      } else {
        bridgeDestination.adapter = toAdapter;
        bridgeDestination.useForwarder = useForwarder;
      }

      // Add a longer execution timeout so slow attestations do not fail too early.
      const bridgePromise = kit.bridge({
        from: { adapter: fromAdapter, chain: fromChainObj },
        to: bridgeDestination as any,
        amount: request.amount,
        token: "USDC",
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(
            new Error(
              `Bridge timeout: Execution exceeded ${
                BRIDGE_EXECUTION_TIMEOUT_MS / 60000
              } minutes. The transaction may still be pending on-chain. Check your wallet or the explorer for updates.`
            )
          );
        }, BRIDGE_EXECUTION_TIMEOUT_MS);
      });

      // Race between bridge execution and timeout
      result = await Promise.race([bridgePromise, timeoutPromise]);
    } finally {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      kit.off("*", bridgeEventHandler);
    }

    const elapsedTime = Date.now() - startTime;
    console.log(`Bridge execution completed in ${elapsedTime}ms`);
    console.log("Bridge transaction result:", result);
    console.log("Result type:", typeof result);
    console.log("Result keys:", result && typeof result === "object" ? Object.keys(result as object) : "null/undefined");
    console.log("Result state:", (result as any)?.state);
    
    // Don't try to stringify the whole result - it has BigInts
    // Instead log the steps array length and details
    if ((result as any)?.steps && Array.isArray((result as any).steps)) {
      console.log("Result steps count:", (result as any).steps.length);
      (result as any).steps.forEach((step: any, index: number) => {
        const stepDetails: any = {
          name: step.name,
          state: step.state,
        };
        if (step.txHash) stepDetails.txHash = step.txHash;
        if (step.forwarded !== undefined) stepDetails.forwarded = step.forwarded;
        if (step.error) stepDetails.error = String(step.error);
        console.log(`Step ${index} (${step.name}):`, stepDetails);
      });
    }
    
    // Store result globally for easy copying (without JSON.stringify)
    (window as any).__lastBridgeResult = result;
    console.log("Bridge result stored in window.__lastBridgeResult");

    // Extract transaction hash and check result status
    let txHash: string | undefined;
    let errorMessage: string | undefined;
    let pendingMessage: string | undefined;
    let shouldTreatAsPending = false;
    let wasForwarded = false;

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

      // Check steps array for any errors or stuck pending steps
      if (Array.isArray(resultObj.steps)) {
        wasForwarded = resultObj.steps.some(
          (step: any) => step?.forwarded === true
        );

        // First check for explicit errors
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
        
        // Check for stuck pending steps (especially burn and mint which are longer operations)
        const pendingSteps = resultObj.steps.filter((step: any) => step.state === "pending");
        if (pendingSteps.length > 0) {
          const stuckSteps = pendingSteps.map((s: any) => s.name).join(", ");
          
          // If we have multiple pending steps or non-approve pending steps, this likely means they're stuck
          if (pendingSteps.length > 1 || (pendingSteps[0]?.name !== "approve" && resultObj.state !== "pending")) {
            errorMessage = errorMessage || 
              `Bridge appeared to complete but steps are still pending: ${stuckSteps}. ` + 
              `This may indicate the transaction is waiting for on-chain settlement. ` +
              `Check the explorer or try again in a few moments.`;
          }
        }

        const submittedBridgeStep = [...resultObj.steps]
          .reverse()
          .find(
            (step: any) =>
              ACTIONABLE_PENDING_BRIDGE_STEPS.has(step.name) &&
              typeof step.txHash === "string"
          );

        const actionableFailedStep = resultObj.steps.find(
          (step: any) =>
            step.state === "error" &&
            ACTIONABLE_PENDING_BRIDGE_STEPS.has(step.name)
        );

        const actionableFailedStepMessage =
          actionableFailedStep?.errorMessage ||
          (actionableFailedStep?.error
            ? getBridgeErrorMessage(actionableFailedStep.error)
            : "");

        if (
          submittedBridgeStep?.txHash &&
          (isBridgeTimeoutError(actionableFailedStepMessage) ||
            isBridgeNetworkError(actionableFailedStepMessage))
        ) {
          shouldTreatAsPending = true;
          txHash = txHash || submittedBridgeStep.txHash;
          pendingMessage = createPendingBridgeMessage({
            lastStep: actionableFailedStep?.name || submittedBridgeStep.name,
            lastTxHash: submittedBridgeStep.txHash,
            events: [],
          });
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

    if (shouldTreatAsPending) {
      return {
        success: true,
        status: "pending",
        estimatedTime: estimateBridgeTime(request.fromChain, request.toChain),
        transactionHash: txHash,
        forwarded: wasForwarded,
        message:
          pendingMessage ||
          "Bridge transaction was submitted and is still settling on-chain.",
      };
    }

    // Success only if state is success AND no step errors
    const isSuccess = (result as any)?.state === "success" && !errorMessage;
    const isPending = (result as any)?.state === "pending";

    if (isSuccess && txHash) {
      return {
        success: true,
        status: "completed",
        estimatedTime: estimateBridgeTime(request.fromChain, request.toChain),
        transactionHash: txHash,
        forwarded: wasForwarded,
      };
    } else if (isSuccess) {
      // State is success but no tx hash - still pending attestation
      return {
        success: true,
        status: wasForwarded ? "completed" : "pending",
        estimatedTime: estimateBridgeTime(request.fromChain, request.toChain),
        transactionHash: txHash,
        forwarded: wasForwarded,
        message: wasForwarded
          ? "Circle Forwarder confirmed the destination mint."
          : undefined,
      };
    } else if (isPending) {
      // Bridge is in pending state - it's processing but not yet complete
      // This is normal for burn/mint steps which require on-chain settlement
      const pendingSteps = (result as any)?.steps
        ?.filter((s: any) => s.state === "pending")
        .map((s: any) => s.name)
        .join(", ") || "settlement";
      
      return {
        success: true,
        status: "pending",
        estimatedTime: estimateBridgeTime(request.fromChain, request.toChain),
        transactionHash: txHash,
        forwarded: wasForwarded,
        message: `Bridge is in progress. Waiting for ${pendingSteps} to complete on-chain. This typically takes 2-5 minutes.`,
      };
    } else {
      return {
        success: false,
        error: errorMessage || `Bridge failed with state: ${(result as any)?.state || "unknown"}`,
      };
    }
  } catch (error) {
    console.error("Bridge error:", error);

    const rawErrorMessage = getBridgeErrorMessage(error);

    if (
      bridgeProgress.lastTxHash &&
      hasActionableBridgeProgress(bridgeProgress) &&
      (isBridgeTimeoutError(rawErrorMessage) ||
        isBridgeNetworkError(rawErrorMessage))
    ) {
      console.warn(
        "Treating bridge error as pending because a bridge transaction was already submitted",
        {
          error: rawErrorMessage,
          lastStep: bridgeProgress.lastStep,
          txHash: bridgeProgress.lastTxHash,
        }
      );

      return {
        success: true,
        status: "pending",
        estimatedTime: estimateBridgeTime(request.fromChain, request.toChain),
        transactionHash: bridgeProgress.lastTxHash,
        forwarded: request.useForwarder ?? DEFAULT_USE_CIRCLE_FORWARDER,
        message: createPendingBridgeMessage(bridgeProgress),
      };
    }

    let errorMessage = rawErrorMessage;

    // Check for specific error patterns
    if (isBridgeTimeoutError(rawErrorMessage)) {
      errorMessage =
        "Bridge transaction is taking longer than expected. The bridge may still be pending on-chain. Check your wallet for pending transactions, then try again once the network settles.";
    } else if (isBridgeNetworkError(rawErrorMessage)) {
      errorMessage =
        "Network connection error during bridge. The RPC endpoint may be unavailable. Check your connection and try again.";
    } else if (
      rawErrorMessage.toLowerCase().includes("user rejected") ||
      rawErrorMessage.toLowerCase().includes("rejected")
    ) {
      errorMessage = "Transaction rejected by wallet. Please check your wallet and try again.";
    } else if (rawErrorMessage.toLowerCase().includes("insufficient")) {
      errorMessage = "Insufficient balance or insufficient gas for bridge transaction.";
    }
    
    console.error("Final bridge error message:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  } finally {
    await restoreActiveWalletChain(initialWalletChainId);
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
  _amount: string,
  tokenSymbol: string = "USDC"
): Promise<{
  circleFee: string;
  platformFee: string;
  totalFee: string;
  totalWithFees: string;
}> {
  // Only Circle's mandatory fee applies
  const feeKey = tokenSymbol?.toUpperCase?.() ?? "USDC";
  const circleFee = parseFloat(BRIDGE_FEE_CONFIG[feeKey] ?? BRIDGE_FEE_CONFIG.USDC);
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
      logo: "/assets/usdc.svg",
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
    // Solana address: base58 (no 0, O, I, l), uppercase and lowercase, 43-44 characters
    return /^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(address);
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
