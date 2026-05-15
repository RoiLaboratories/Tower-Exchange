import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ARC_RPC_ENDPOINTS = [
  "https://rpc.drpc.testnet.arc.network",
  "https://rpc.quicknode.testnet.arc.network",
  "https://rpc.blockdaemon.testnet.arc.network",
  "https://rpc.testnet.arc.network",
];

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

export async function GET() {
  return NextResponse.json({
    ok: true,
    chainId: "5042002",
    message: "Arc RPC proxy is available. Send JSON-RPC requests with POST.",
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    let lastError: unknown = null;

    for (const rpcUrl of ARC_RPC_ENDPOINTS) {
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

        if (!upstreamResponse.ok && ARC_RPC_ENDPOINTS.length > 1) {
          lastError = new Error(
            `Arc RPC ${rpcUrl} returned HTTP ${upstreamResponse.status}`,
          );
          continue;
        }

        const responseBody = await upstreamResponse.text();

        if (
          ARC_RPC_ENDPOINTS.length > 1 &&
          shouldTryNextRpcForNullResult(body, responseBody) &&
          rpcUrl !== ARC_RPC_ENDPOINTS[ARC_RPC_ENDPOINTS.length - 1]
        ) {
          lastError = new Error(
            `Arc RPC ${rpcUrl} returned null transaction result`,
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

    throw lastError ?? new Error("All Arc RPC endpoints failed");
  } catch (error) {
    console.error("Arc RPC proxy error:", error);

    return NextResponse.json(
      { error: "Failed to reach Arc RPC endpoint" },
      { status: 502 },
    );
  }
}
