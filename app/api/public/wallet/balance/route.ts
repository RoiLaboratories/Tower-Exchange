import { NextRequest } from "next/server";
import { withDevApiAuth, handleCorsPreflight } from "@/lib/server/devApiMiddleware";
import { POST as internalWalletBalancePost } from "@/app/api/wallet/balance/route";

export const OPTIONS = handleCorsPreflight;

export const POST = withDevApiAuth(
  "/api/public/wallet/balance",
  { requiredScope: null, computeUnits: 1 },
  async (request: NextRequest) => {
    return internalWalletBalancePost(request);
  }
);
