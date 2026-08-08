import { NextRequest, NextResponse } from "next/server";

function handleApiNotFound(request: NextRequest) {
  const method = request.method.toUpperCase();
  const pathname = request.nextUrl.pathname;

  return NextResponse.json(
    {
      success: false,
      error: `API route not found: ${method} ${pathname}`,
      status: 404,
    },
    {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
      },
    }
  );
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
    },
  });
}

export const GET = handleApiNotFound;
export const POST = handleApiNotFound;
export const PUT = handleApiNotFound;
export const DELETE = handleApiNotFound;
export const PATCH = handleApiNotFound;
export const HEAD = handleApiNotFound;
