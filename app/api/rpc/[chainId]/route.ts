import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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
  "421614": ["https://sepolia-rollup.arbitrum.io/rpc"],
  "5042002": [
    "https://rpc.testnet.arc.network",
    "https://rpc.drpc.testnet.arc.network",
    "https://rpc.quicknode.testnet.arc.network",
    "https://rpc.blockdaemon.testnet.arc.network",
  ],
  "11155111": ["https://sepolia.drpc.org"],
  "11155420": ["https://sepolia.optimism.io"],
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
