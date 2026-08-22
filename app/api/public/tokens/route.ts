import { NextResponse } from "next/server";
import { withDevApiAuth, handleCorsPreflight } from "@/lib/server/devApiMiddleware";
import { GET as internalTokensGet } from "@/app/api/tokens/route";

export const OPTIONS = handleCorsPreflight;

export const GET = withDevApiAuth(
  "/api/public/tokens",
  { requiredScope: null, computeUnits: 1 },
  async () => {
    return internalTokensGet();
  }
);

export function POST() {
  return NextResponse.json(
    { success: false, error: "Method POST not allowed. Use GET /api/public/tokens.", status: 405 },
    { status: 405 }
  );
}
