import { NextRequest, NextResponse } from "next/server";
import { GET as originalGET } from "../../../swap/dexes/route";
import { validateApiKey, logApiRequest, getClientIp } from "@/lib/server/apiKeyAuth";

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  let authResult;
  const ipAddress = getClientIp(request);

  try {
    // 1. Authenticate with key and require 'swaps' or 'read' scope
    authResult = await validateApiKey(request, "swaps");

    if (!authResult.authorized) {
      const responseTime = Date.now() - startTime;
      await logApiRequest({
        endpoint: "/public/swap/dexes",
        method: "GET",
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
    const response = await originalGET();

    // 3. Log execution details
    const responseTime = Date.now() - startTime;
    await logApiRequest({
      apiKeyId: authResult.apiKeyId,
      userId: authResult.userId,
      endpoint: "/public/swap/dexes",
      method: "GET",
      statusCode: response.status,
      responseTimeMs: responseTime,
      ipAddress,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    return response;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error("Public API swap dexes error:", error);

    await logApiRequest({
      apiKeyId: authResult?.apiKeyId,
      userId: authResult?.userId,
      endpoint: "/public/swap/dexes",
      method: "GET",
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
