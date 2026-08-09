import { NextRequest, NextResponse } from "next/server";
import { withDevApiAuth, handleCorsPreflight } from "@/lib/server/devApiMiddleware";
import { POST as internalSwapQuotePost } from "@/app/api/swap/quote/route";

export const OPTIONS = handleCorsPreflight;

export const POST = withDevApiAuth(
  "/api/public/swap/quote",
  { requiredScope: "swaps", computeUnits: 2 },
  async (request: NextRequest) => {
    return internalSwapQuotePost(request);
  }
);

export function GET() {
  return NextResponse.json(
    { success: false, error: "Method GET not allowed. Use POST /api/public/swap/quote.", status: 405 },
    { status: 405 }
  );
}
