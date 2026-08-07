import { NextRequest, NextResponse } from "next/server";
import { withDevApiAuth, handleCorsPreflight } from "@/lib/server/devApiMiddleware";
import { GET as internalSwapDexesGet } from "@/app/api/swap/dexes/route";

export const OPTIONS = handleCorsPreflight;

export const GET = withDevApiAuth(
  "/api/public/swap/dexes",
  { requiredScope: null, computeUnits: 1 },
  async () => {
    return internalSwapDexesGet();
  }
);

export function POST() {
  return NextResponse.json(
    { success: false, error: "Method POST not allowed. Use GET /api/public/swap/dexes.", status: 405 },
    { status: 405 }
  );
}
