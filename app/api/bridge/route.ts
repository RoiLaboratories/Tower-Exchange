/**
 * Server-side Bridge API Route
 * 
 * Handles bridge requests from the client via a server API.
 * This avoids CORS and RPC connectivity issues that occur with client-side calls.
 */

import { NextRequest, NextResponse } from "next/server";
import { BridgeKit } from "@circle-fin/bridge-kit";
import { ViemAdapter } from "@circle-fin/adapter-viem-v2";
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
import { createPublicClient, createWalletClient, http, Chain as ViemChain } from "viem";
import { getSupportedTokens } from "@/lib/bridgeService";

const RETRYABLE_RPC_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

const getBridgeRpcUrl = (chainId: number) => `/api/rpc/${chainId}`;

const getBridgeRpcUrls = (chainId: number) => {
  const primaryUrl = getBridgeRpcUrl(chainId);
  return [primaryUrl];
};

// Map chain IDs to chain name keys for token lookup
const CHAIN_ID_TO_TOKEN_KEY: Record<number, string> = {
  5042002: "arc-testnet",
  84532: "base-sepolia",
  11155420: "optimism-sepolia",
  43113: "avalanche-fuji",
  421614: "arbitrum-sepolia",
  11155111: "ethereum-sepolia",
  59141: "linea-sepolia",
  80002: "polygon-amoy",
  14601: "sonic-testnet",
  1301: "unichain-sepolia",
};

// Map chain IDs to Circle chain identifiers
const CHAIN_ID_TO_CIRCLE_CHAIN: Record<number, string> = {
  5042002: "Arc_Testnet",
  84532: "Base_Sepolia",
  11155420: "Optimism_Sepolia",
  43113: "Avalanche_Fuji",
  421614: "Arbitrum_Sepolia",
  11155111: "Ethereum_Sepolia",
  59141: "Linea_Sepolia",
  80002: "Polygon_Amoy_Testnet",
  14601: "Sonic_Testnet",
  1301: "Unichain_Sepolia",
};

// Map Circle's chain definitions to their actual viem Chain objects
const CIRCLE_CHAIN_OBJECTS = {
  Arc_Testnet: ArcTestnet,
  Base_Sepolia: BaseSepolia,
  Optimism_Sepolia: OptimismSepolia,
  Avalanche_Fuji: AvalancheFuji,
  Arbitrum_Sepolia: ArbitrumSepolia,
  Ethereum_Sepolia: EthereumSepolia,
  Linea_Sepolia: LineaSepolia,
  Polygon_Amoy_Testnet: PolygonAmoy,
  Sonic_Testnet: SonicTestnet,
  Unichain_Sepolia: UnichainSepolia,
} as const;

export interface BridgeRequestBody {
  fromChainId: number;
  toChainId: number;
  amount: string;
  token: string;
  recipientAddress: string;
  senderAddress?: string;
  useForwarder?: boolean;
}

export interface BridgeResponseBody {
  success: boolean;
  transactionHash?: string;
  status?: string;
  error?: string;
  estimatedTime?: string;
}

/**
 * Create a Bridge Kit adapter with custom RPC endpoints for server-side use
 */
async function createServerBridgeAdapter(): Promise<any> {
  // Get all supported chains as full Viem Chain objects with all properties
  const supportedChains = Object.values(CIRCLE_CHAIN_OBJECTS);

  const adapterOptions = {
    getPublicClient: ({ chain }: { chain: ViemChain }) => {
      const rpcUrls = getBridgeRpcUrls(chain.id);
      if (!rpcUrls.length) {
        throw new Error(`No RPC configured for chain: ${chain.name} (${chain.id})`);
      }
      return createPublicClient({
        chain,
        transport: http(rpcUrls[0], {
          retryCount: 5,
          timeout: 30000, // 30 second timeout for server-side
        }),
      });
    },
    getWalletClient: ({ chain }: { chain: ViemChain }) => {
      const rpcUrls = getBridgeRpcUrls(chain.id);
      if (!rpcUrls.length) {
        throw new Error(`No RPC configured for chain: ${chain.name} (${chain.id})`);
      }
      return createWalletClient({
        chain,
        transport: http(rpcUrls[0], {
          retryCount: 5,
          timeout: 30000,
        }),
        account: undefined,
      });
    },
  };

  const capabilities = {
    addressContext: 'developer-controlled' as const,
    supportedChains,
  };

  return new (ViemAdapter as any)(adapterOptions, capabilities);
}

/**
 * POST /api/bridge
 * 
 * Initiates a bridge transaction on the server-side.
 * 
 * Request body:
 * {
 *   fromChainId: number,
 *   toChainId: number,
 *   amount: string,
 *   token: string,
 *   recipientAddress: string
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as BridgeRequestBody;

    // Validate request
    if (
      !body.fromChainId ||
      !body.toChainId ||
      !body.amount ||
      !body.token ||
      !body.recipientAddress
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: fromChainId, toChainId, amount, token, recipientAddress",
        },
        { status: 400 }
      );
    }

    const fromCircleChain = CHAIN_ID_TO_CIRCLE_CHAIN[body.fromChainId];
    const toCircleChain = CHAIN_ID_TO_CIRCLE_CHAIN[body.toChainId];

    if (!fromCircleChain || !toCircleChain) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported chain. From: ${body.fromChainId}, To: ${body.toChainId}`,
        },
        { status: 400 }
      );
    }

    console.log("Server-side bridge request:", {
      from: fromCircleChain,
      to: toCircleChain,
      amount: body.amount,
      token: body.token,
      recipient: body.recipientAddress,
    });

    // Initialize BridgeKit
    const kit = new BridgeKit();

    // Create adapter with server-side RPC configuration
    const adapter = await createServerBridgeAdapter();

    // Execute the bridge transaction
    // Use viem Chain objects from Circle's chain definitions
    const fromChainObj = CIRCLE_CHAIN_OBJECTS[fromCircleChain as keyof typeof CIRCLE_CHAIN_OBJECTS];
    const toChainObj = CIRCLE_CHAIN_OBJECTS[toCircleChain as keyof typeof CIRCLE_CHAIN_OBJECTS];

    if (!fromChainObj || !toChainObj) {
      return NextResponse.json(
        {
          success: false,
          error: `Chain object not found for ${fromCircleChain} or ${toCircleChain}`,
        },
        { status: 400 }
      );
    }

    // Use sender address from request or default to recipient (for testing)
    const senderAddress = body.senderAddress || body.recipientAddress;

    // Get token address from supported tokens
    const allTokens = getSupportedTokens();
    const tokenDef = allTokens.find(
      (t) => t.symbol.toLowerCase() === (body.token || "USDC").toLowerCase()
    );

    if (!tokenDef) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported token: ${body.token}`,
        },
        { status: 400 }
      );
    }

    // Get token address for source chain
    const fromChainTokenKey = CHAIN_ID_TO_TOKEN_KEY[body.fromChainId];
    const tokenAddress = tokenDef.chainAddresses[fromChainTokenKey];

    if (!tokenAddress) {
      return NextResponse.json(
        {
          success: false,
          error: `Token ${body.token} not available on source chain`,
        },
        { status: 400 }
      );
    }

    const result = await (kit.bridge as any)({
      from: {
        adapter,
        chain: fromChainObj,
        address: senderAddress,
      },
      to: {
        chain: toChainObj,
        recipientAddress: body.recipientAddress,
        useForwarder: body.useForwarder ?? true,
      },
      amount: body.amount,
      token: body.token, // Use token symbol (e.g., "USDC"), not contract address
    });

    console.log("Bridge transaction result type:", typeof result);
    console.log("Bridge transaction result keys:", result ? Object.keys(result) : "null/undefined");
    console.log("Bridge transaction result:", JSON.stringify(result, null, 2));

    // Extract transaction hash from result - ensure it's a string
    let txHash: string | undefined;
    if (typeof result === "string") {
      // Result is directly a hash string
      txHash = result;
    } else if (result && typeof result === "object") {
      // Try common hash properties
      if (typeof result.transactionHash === "string") {
        txHash = result.transactionHash;
      } else if (typeof result.hash === "string") {
        txHash = result.hash;
      } else if (typeof result.txHash === "string") {
        txHash = result.txHash;
      }
      // If still no hash found, don't set it
    }

    return NextResponse.json(
      {
        success: true,
        transactionHash: txHash, // Will be undefined if no hash found
        status: "pending",
        estimatedTime: "2-5 minutes",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Bridge API error:", error);

    let errorMessage = "Unknown bridge error";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    } else if (error && typeof error === "object" && "message" in error) {
      errorMessage = String((error as any).message);
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
