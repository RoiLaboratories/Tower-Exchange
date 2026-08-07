import { NextRequest } from "next/server";
import { withDevApiAuth, handleCorsPreflight } from "@/lib/server/devApiMiddleware";
import { POST as internalRpcPost } from "@/app/api/rpc/[chainId]/route";

export const OPTIONS = handleCorsPreflight;

type RouteContext = {
  params: Promise<{ chainId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const handler = withDevApiAuth(
    "/api/public/rpc/[chainId]",
    { requiredScope: null, computeUnits: 1 },
    async (req: NextRequest) => {
      return internalRpcPost(req, context);
    }
  );

  return handler(request);
}
