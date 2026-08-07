import { NextRequest } from "next/server";
import { withDevApiAuth, handleCorsPreflight } from "@/lib/server/devApiMiddleware";
import { GET as internalSwapDexesGet } from "@/app/api/swap/dexes/route";

export const OPTIONS = handleCorsPreflight;

export const GET = withDevApiAuth(
  "/api/public/swap/dexes",
  { requiredScope: null, computeUnits: 1 },
  async () => {
    // Delegate directly to internal swap dexes implementation
    return internalSwapDexesGet();
  }
);
