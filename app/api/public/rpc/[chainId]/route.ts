import { NextRequest, NextResponse } from "next/server";
import { POST as originalPOST } from "../../../rpc/[chainId]/route";
import { validateApiKey, logApiRequest, getClientIp } from "@/lib/server/apiKeyAuth";

type RouteContext = {
  params: Promise<{
    chainId: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: RouteContext) {
  const startTime = Date.now();
  let authResult;
  const resolvedParams = await params;
  const chainId = resolvedParams.chainId;
  const ipAddress = getClientIp(request);

  try {
    // 1. Authenticate with key and require 'read' scope
    authResult = await validateApiKey(request, "read");

    if (!authResult.authorized) {
      const responseTime = Date.now() - startTime;
      await logApiRequest({
        endpoint: `/public/rpc/${chainId}`,
        method: "POST",
        statusCode: authResult.status || 401,
        responseTimeMs: responseTime,
        ipAddress,
        userAgent: request.headers.get("user-agent") || undefined,
      });

      return NextResponse.json(
        { error: authResult.error || "Unauthorized" },
        { status: authResult.status || 401 }
      );
    }

    // 2. Delegate to the original internal route
    const response = await originalPOST(request, { params: Promise.resolve({ chainId }) });

    // 3. Log execution details
    const responseTime = Date.now() - startTime;
    await logApiRequest({
      apiKeyId: authResult.apiKeyId,
      userId: authResult.userId,
      endpoint: `/public/rpc/${chainId}`,
      method: "POST",
      statusCode: response.status,
      responseTimeMs: responseTime,
      ipAddress,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    return response;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`Public API RPC error for chain ${chainId}:`, error);

    await logApiRequest({
      apiKeyId: authResult?.apiKeyId,
      userId: authResult?.userId,
      endpoint: `/public/rpc/${chainId}`,
      method: "POST",
      statusCode: 500,
      responseTimeMs: responseTime,
      ipAddress,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
