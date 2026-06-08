import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "FeeCollector fee submission is deprecated",
      details:
        "Platform fees are now collected inside TowerSwapExecutor.executeSwap, so no separate fee distribution request is needed.",
    },
    { status: 410 },
  );
}
