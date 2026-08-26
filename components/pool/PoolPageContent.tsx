"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useRainbowKitAuth } from "@/lib/use-rainbowkit-auth";
import usePoolPositions from "@/lib/hooks/usePoolPositions";
import { buildManagePositionPath } from "@/lib/pool/increaseLiquidity";
import type { PoolPosition, PoolSummary } from "@/lib/pool/types";
import { AppErrorModal } from "@/components/AppErrorModal";
import ProvideLiquidityBanner from "@/components/pool/ProvideLiquidityBanner";
import PoolSidebar from "@/components/pool/PoolSidebar";
import PoolSummaryCards from "@/components/pool/PoolSummaryCards";
import PoolPositionsTable from "@/components/pool/PoolPositionsTable";
import PoolPositionsPanel from "@/components/pool/PoolPositionsPanel";
import ClaimFeesModal from "@/components/pool/modals/ClaimFeesModal";

type PoolPageState = "disconnected" | "empty" | "loading" | "positions";

export default function PoolPageContent() {
  const router = useRouter();
  const { authenticated, user, ready } = useRainbowKitAuth();
  const walletAddress = user?.wallet?.address ?? null;
  const { positions, summary, loading, error } = usePoolPositions(walletAddress);
  const [claimOpen, setClaimOpen] = useState(false);

  const pageState = useMemo<PoolPageState>(() => {
    if (!ready) {
      return "loading";
    }

    if (!authenticated || !walletAddress) {
      return "disconnected";
    }

    if (loading) {
      return "loading";
    }

    if (positions.length === 0) {
      return "empty";
    }

    return "positions";
  }, [authenticated, loading, positions.length, ready, walletAddress]);

  const resolvedSummary = useMemo<PoolSummary | null>(() => {
    if (summary) {
      return summary;
    }

    if (positions.length === 0) {
      return null;
    }

    const activePositions = positions.filter(
      (position) => position.status !== "closed",
    ).length;

    return {
      totalPositionValue: "$0.00",
      netApr: "0.00%",
      activePositions: activePositions || positions.length,
      activeNetworks: 1,
      claimableRewards: "$0.00",
    };
  }, [positions, summary]);

  const goToNewPosition = () => {
    router.push("/pool/new");
  };

  const goToExplorePools = () => {
    router.push("/pool/explore");
  };

  const handleManagePosition = (position: PoolPosition) => {
    router.push(buildManagePositionPath(position.id));
  };

  const hasPositions = pageState === "positions";

  return (
    <>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="mb-4 text-xl font-semibold tracking-tight text-foreground sm:text-2xl md:text-3xl">
          Your Positions
        </h1>

        <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
          <div className="min-w-0 flex-1 space-y-4">
            {!hasPositions ? (
              <ProvideLiquidityBanner
                compact
                onCreatePosition={goToNewPosition}
              />
            ) : null}

            {hasPositions && resolvedSummary ? (
              <PoolSummaryCards
                summary={resolvedSummary}
                onClaimAll={() => setClaimOpen(true)}
              />
            ) : null}

            {hasPositions ? (
              <PoolPositionsTable
                positions={positions}
                onCreatePosition={goToNewPosition}
                onManagePosition={handleManagePosition}
              />
            ) : (
              <PoolPositionsPanel
                compact
                view={
                  pageState === "disconnected"
                    ? "disconnected"
                    : pageState === "loading"
                      ? "loading"
                      : "empty"
                }
                onExplorePools={goToExplorePools}
                onCreatePosition={goToNewPosition}
              />
            )}
          </div>

          <PoolSidebar compact onAccessMorePools={goToExplorePools} />
        </div>
      </main>

      <AppErrorModal
        error={error}
        onClose={() => {}}
        title="Failed to load pool positions"
      />

      <ClaimFeesModal
        isOpen={claimOpen}
        onClose={() => setClaimOpen(false)}
        fees={[
          { token: "USDC", amount: resolvedSummary?.claimableRewards ?? "<0" },
          { token: "EURC", amount: "0" },
        ]}
      />
    </>
  );
}
