import { NextRequest } from "next/server";
import { withDevApiAuth, handleCorsPreflight } from "@/lib/server/devApiMiddleware";
import { POST as internalBridgePost } from "@/app/api/bridge/route";

export const OPTIONS = handleCorsPreflight;

export const POST = withDevApiAuth(
  "/api/public/bridge",
  { requiredScope: "bridges", computeUnits: 5 },
  async (request: NextRequest) => {
    return internalBridgePost(request);
  }
);
