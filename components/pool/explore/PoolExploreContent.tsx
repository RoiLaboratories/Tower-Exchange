"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import ProvideLiquidityBanner from "@/components/pool/ProvideLiquidityBanner";
import PoolExploreTable from "@/components/pool/explore/PoolExploreTable";
import { EXPLORE_POOLS } from "@/lib/pool/data";
import usePoolPositions from "@/lib/hooks/usePoolPositions";
import { useRainbowKitAuth } from "@/lib/use-rainbowkit-auth";

export default function PoolExploreContent() {
  const router = useRouter();
  const { authenticated, user } = useRainbowKitAuth();
  const walletAddress = authenticated ? user?.wallet?.address : null;
  const { positions } = usePoolPositions(walletAddress);

  const pools = useMemo(() => {
    const activePositionByPool = new Map(
      positions
        .filter((position) => position.status !== "closed")
        .map((position) => [position.poolId, position.id]),
    );

    return EXPLORE_POOLS.map((pool) => {
      const positionId = activePositionByPool.get(pool.id);
      return {
        ...pool,
        hasPosition: Boolean(positionId),
        positionId,
      };
    });
  }, [positions]);

  const goToNewPosition = () => {
    router.push("/pool/new");
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/pool" className="transition-colors hover:text-foreground">
          Pool
        </Link>
        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
        <span className="text-foreground">Explore</span>
      </div>

      <div className="space-y-4">
        <ProvideLiquidityBanner onCreatePosition={goToNewPosition} />
        <PoolExploreTable pools={pools} onCreatePosition={goToNewPosition} />
      </div>
    </main>
  );
}