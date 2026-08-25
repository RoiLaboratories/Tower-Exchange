"use client";

import Image from "next/image";
import type { PoolSummary } from "@/lib/pool/types";

interface PoolSummaryCardsProps {
  summary: PoolSummary;
  onClaimAll?: () => void;
}

export default function PoolSummaryCards({
  summary,
  onClaimAll,
}: PoolSummaryCardsProps) {
  const positionLabel =
    summary.activePositions === 1 ? "Active Position" : "Active Positions";
  const networkLabel =
    summary.activeNetworks === 1 ? "Network" : "Networks";

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 xl:items-stretch">
      <div className="flex min-h-[148px] flex-col items-center justify-center rounded-[20px] border border-border bg-card px-5 py-5 text-center">
        <p className="text-sm font-light text-muted-foreground">Total Position Value</p>
        <p className="mt-3 max-w-full truncate text-[24px] font-semibold leading-none tracking-tight text-foreground tabular-nums sm:text-[32px]">
          {summary.totalPositionValue}
        </p>
      </div>

      <div className="flex min-h-[148px] flex-col items-center justify-center rounded-[20px] border border-border bg-card px-5 py-5 text-center">
        <p className="text-sm font-light text-muted-foreground">Net APR</p>
        <p className="mt-3 max-w-full truncate text-[24px] font-semibold leading-none tracking-tight text-foreground tabular-nums sm:text-[32px]">
          {summary.netApr}
        </p>
      </div>

      <div className="flex min-h-[148px] flex-col justify-between rounded-[20px] border border-border bg-card px-5 py-5 sm:col-span-2 xl:col-span-1">
        <div className="space-y-3.5">
          <div className="flex items-center gap-3">
            <Image
              src="/assets/active position icon.svg"
              alt=""
              width={30}
              height={30}
              className="h-[30px] w-[30px] shrink-0"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {summary.activePositions} {positionLabel}
              </p>
              <p className="mt-0.5 text-xs font-light text-muted-foreground">
                Across {summary.activeNetworks} {networkLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Image
              src="/assets/claimable_rewards icon.svg"
              alt=""
              width={30}
              height={30}
              className="h-[30px] w-[30px] shrink-0"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {summary.claimableRewards}
              </p>
              <p className="mt-0.5 text-xs font-light text-muted-foreground">
                Claimable Rewards
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClaimAll}
          className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-black transition-colors hover:bg-primary/90"
        >
          Claim All ({summary.activePositions})
        </button>
      </div>
    </div>
  );
}
