import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const splitRpcEnv = (value?: string) =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const uniqueRpcEndpoints = (...lists: string[][]) =>
  Array.from(new Set(lists.flat().filter(Boolean)));

const SOLANA_RPC_ENDPOINTS = uniqueRpcEndpoints(
  splitRpcEnv(process.env.SOLANA_DEVNET_RPC_URLS),
  splitRpcEnv(process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URLS),
  splitRpcEnv(process.env.SOLANA_RPC_URLS),
  splitRpcEnv(process.env.NEXT_PUBLIC_SOLANA_RPC_URLS),
  [
    process.env.SOLANA_DEVNET_RPC_URL,
    process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL,
    process.env.SOLANA_RPC_URL,
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
  ].filter((value): value is string => Boolean(value && value.trim())),
  ["https://api.devnet.solana.com"],
);

const RPC_ENDPOINTS: Record<string, string[]> = {
  "1": [
    "https://ethereum-rpc.publicnode.com",
    "https://ethereum.publicnode.com",
    "https://eth.llamarpc.com",
    "https://cloudflare-eth.com",
  ],
  "10": ["https://mainnet.optimism.io"],
  "1301": ["https://sepolia.unichain.org"],
  "137": ["https://polygon.drpc.org"],
  "14601": ["https://rpc.testnet.soniclabs.com"],
  "8453": ["https://mainnet.base.org"],
  "43113": ["https://api.avax-test.network/ext/bc/C/rpc"],
  "42161": ["https://arb1.arbitrum.io/rpc"],
  "59141": ["https://rpc.sepolia.linea.build"],
  "80002": ["https://rpc-amoy.polygon.technology"],
  "84532": ["https://sepolia.base.org"],
  "421614": [
    "https://sepolia-rollup.arbitrum.io/rpc",
    "https://arbitrum-sepolia-rpc.publicnode.com",
    "https://arbitrum-sepolia.drpc.org",
  ],
  "5042002": [
    "https://rpc.drpc.testnet.arc.network",
    "https://rpc.quicknode.testnet.arc.network",
    "https://rpc.blockdaemon.testnet.arc.network",
    "https://rpc.testnet.arc.network",
  ],
  solana: SOLANA_RPC_ENDPOINTS,
  "11155111": ["https://sepolia.drpc.org"],
  "11155420": ["https://sepolia.optimism.io"],
};

const NULL_RESULT_FALLBACK_METHODS = new Set([
  "eth_getTransactionByHash",
  "eth_getTransactionReceipt",
]);

const shouldTryNextRpcForNullResult = (
  requestBody: string,
  responseBody: string,
) => {
  try {
    const requestJson = JSON.parse(requestBody) as { method?: string };
    const responseJson = JSON.parse(responseBody) as { result?: unknown };

    return (
      typeof requestJson.method === "string" &&
      NULL_RESULT_FALLBACK_METHODS.has(requestJson.method) &&
      responseJson.result === null
    );
  } catch {
    return false;
  }
};

type RouteContext = {
  params: Promise<{
    chainId: string;
  }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { chainId } = await params;
  const rpcUrls = RPC_ENDPOINTS[chainId];

  if (!rpcUrls) {
    return NextResponse.json(
      { error: `Unsupported RPC chain ID: ${chainId}` },
      { status: 400 }
    );
  }

  try {
    const body = await request.text();
    let lastError: unknown = null;

    for (const rpcUrl of rpcUrls) {
      try {
        const upstreamResponse = await fetch(rpcUrl, {
          method: "POST",
          headers: {
            "content-type":
              request.headers.get("content-type") ?? "application/json",
          },
          body,
          cache: "no-store",
        });

        if (!upstreamResponse.ok && rpcUrls.length > 1) {
          lastError = new Error(
            `RPC ${rpcUrl} returned HTTP ${upstreamResponse.status}`
          );
          continue;
        }

        const responseBody = await upstreamResponse.text();

        if (
          rpcUrls.length > 1 &&
          shouldTryNextRpcForNullResult(body, responseBody) &&
          rpcUrl !== rpcUrls[rpcUrls.length - 1]
        ) {
          lastError = new Error(
            `RPC ${rpcUrl} returned null transaction result`
          );
          continue;
        }

        return new NextResponse(responseBody, {
          status: upstreamResponse.status,
          headers: {
            "cache-control": "no-store",
            "content-type":
              upstreamResponse.headers.get("content-type") ??
              "application/json",
          },
        });
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error("All RPC endpoints failed");
  } catch (error) {
    console.error(`RPC proxy error for chain ${chainId}:`, error);

    return NextResponse.json(
      { error: "Failed to reach upstream RPC endpoint" },
      { status: 502 }
    );
  }
}
