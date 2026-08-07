import { NextRequest, NextResponse } from "next/server";
import { withDevApiAuth, handleCorsPreflight } from "@/lib/server/devApiMiddleware";
import { POST as internalSwapBuildTxPost } from "@/app/api/swap/build-tx/route";

export const OPTIONS = handleCorsPreflight;

export const POST = withDevApiAuth(
  "/api/public/swap/build-tx",
  { requiredScope: "swaps", computeUnits: 3 },
  async (request: NextRequest) => {
    try {
      const cloned = request.clone();
      const body = await cloned.json().catch(() => null);

      if (!body || typeof body !== "object") {
        return NextResponse.json(
          { success: false, error: "Invalid JSON request body" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid request payload" },
        { status: 400 }
      );
    }

    return internalSwapBuildTxPost(request);
  }
);

export function GET() {
  return NextResponse.json(
    { success: false, error: "Method GET not allowed. Use POST /api/public/swap/build-tx.", status: 405 },
    { status: 405 }
  );
}
