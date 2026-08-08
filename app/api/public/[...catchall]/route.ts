import { NextRequest, NextResponse } from "next/server";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
};

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

function handleJsonNotFound(request: NextRequest) {
  const method = request.method.toUpperCase();
  const pathname = request.nextUrl.pathname;

  return NextResponse.json(
    {
      success: false,
      error: `Endpoint not found: ${method} ${pathname}`,
      status: 404,
      // availableEndpoints: [
      //   "GET  /api/public/prices",
      //   "POST /api/public/wallet/balance",
      //   "GET  /api/public/swap/dexes",
      //   "POST /api/public/swap/quote",
      //   "POST /api/public/swap/build-tx",
      //   "POST /api/public/rpc/{chainId}",
      //   "POST /api/public/bridge",
      // ],
    },
    {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        ...CORS_HEADERS,
      },
    }
  );
}

export const GET = handleJsonNotFound;
export const POST = handleJsonNotFound;
export const PUT = handleJsonNotFound;
export const DELETE = handleJsonNotFound;
export const PATCH = handleJsonNotFound;
export const HEAD = handleJsonNotFound;
