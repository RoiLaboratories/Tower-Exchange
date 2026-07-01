import { NextRequest, NextResponse } from "next/server";
import { POST as originalPOST } from "../../bridge/route";
import { validateApiKey, logApiRequest, getClientIp } from "@/lib/server/apiKeyAuth";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let authResult;
  const ipAddress = getClientIp(request);

  try {
    // 1. Authenticate with key and require 'bridges' scope
    authResult = await validateApiKey(request, "bridges");

    if (!authResult.authorized) {
      const responseTime = Date.now() - startTime;
      await logApiRequest({
        endpoint: "/public/bridge",
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
    const response = await originalPOST(request);

    // 3. Log execution details
    const responseTime = Date.now() - startTime;
    await logApiRequest({
      apiKeyId: authResult.apiKeyId,
      userId: authResult.userId,
      endpoint: "/public/bridge",
      method: "POST",
      statusCode: response.status,
      responseTimeMs: responseTime,
      ipAddress,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    return response;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error("Public API bridge error:", error);

    await logApiRequest({
      apiKeyId: authResult?.apiKeyId,
      userId: authResult?.userId,
      endpoint: "/public/bridge",
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
