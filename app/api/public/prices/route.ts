import { NextRequest, NextResponse } from "next/server";
import { withDevApiAuth, handleCorsPreflight } from "@/lib/server/devApiMiddleware";
import { GET as internalPricesGet } from "@/app/api/prices/route";

export const OPTIONS = handleCorsPreflight;

export const GET = withDevApiAuth(
  "/api/public/prices",
  { requiredScope: null, computeUnits: 1 },
  async () => {
    return internalPricesGet();
  }
);

export function POST() {
  return NextResponse.json(
    { success: false, error: "Method POST not allowed. Use GET /api/public/prices.", status: 405 },
    { status: 405 }
  );
}
