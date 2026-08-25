"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import TokenPairIcon from "@/components/pool/TokenPairIcon";
import { RangeBoundCard } from "@/components/pool/increase/IncreaseLiquiditySections";
import ClaimFeesModal from "@/components/pool/modals/ClaimFeesModal";
import RemoveLiquidityModal from "@/components/pool/modals/RemoveLiquidityModal";
import { getManagePosition } from "@/lib/pool/data";
import usePoolPositions from "@/lib/hooks/usePoolPositions";
import { mapPoolPositionToManageDetails } from "@/lib/pool/positionMapping";
import { useRainbowKitAuth } from "@/lib/use-rainbowkit-auth";
import {
  buildIncreaseLiquidityPath,
} from "@/lib/pool/increaseLiquidity";
import type { PoolPositionStatus } from "@/lib/pool/types";
import { getTokenIcon } from "@/lib/tokenIcons";
import type { SwapTokenSymbol } from "@/lib/swapTokens";

const STATUS_LABELS: Record<PoolPositionStatus, string> = {
  "in-range": "In range",
  "out-of-range": "Out of range",
  closed: "Closed",
};

const STATUS_TEXT: Record<PoolPositionStatus, string> = {
  "in-range": "text-[#07D54F]",
  "out-of-range": "text-[#FF5A5F]",
  closed: "text-muted-foreground",
};

const STATUS_DOT: Record<PoolPositionStatus, string> = {
  "in-range": "bg-[#07D54F]",
  "out-of-range": "bg-[#FF5A5F]",
  closed: "bg-muted-foreground/40",
};

function TokenAmountRow({
  token,
  amount,
  share,
}: {
  token: string;
  amount: string;
  share?: string;
}) {
  const icon = getTokenIcon(token);

  return (
      <div className="flex min-w-0 items-center justify-between gap-3">
      <div className="inline-flex min-w-0 items-center gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-secondary">
          {icon ? (
            <Image
              src={icon}
              alt=""
              width={20}
              height={20}
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="text-[8px] text-muted-foreground">{token.slice(0, 1)}</span>
          )}
        </span>
        <span className="truncate text-sm font-light text-foreground">{token}</span>
      </div>
      <div className="inline-flex min-w-0 items-center gap-3 text-sm font-light text-foreground sm:gap-4">
        <span className="truncate tabular-nums">{amount}</span>
        {share ? <span className="min-w-[2.5rem] shrink-0 text-right">{share}</span> : null}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: PoolPositionStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-sm font-light ${STATUS_TEXT[status]}`}
    >
      {STATUS_LABELS[status]}
      <span
        className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`}
        aria-hidden
      />
    </span>
  );
}

function QuoteTokenToggle({
  token0,
  token1,
  value,
  onChange,
}: {
  token0: SwapTokenSymbol;
  token1: SwapTokenSymbol;
  value: SwapTokenSymbol;
  onChange: (token: SwapTokenSymbol) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-[12px] bg-secondary p-0.5">
      {([token0, token1] as SwapTokenSymbol[]).map((token) => {
        const active = value === token;
        return (
          <button
            key={token}
            type="button"
            onClick={() => onChange(token)}
            className={`inline-flex h-7 min-w-[64px] items-center justify-center rounded-[10px] px-2.5 text-xs font-medium transition-colors ${
              active
                ? "bg-primary text-[#0C0C0D]"
                : "bg-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {token}
          </button>
        );
      })}
    </div>
  );
}

interface ManagePositionContentProps {
  positionId: string;
}

export default function ManagePositionContent({
  positionId,
}: ManagePositionContentProps) {
  const router = useRouter();
  const { authenticated, user } = useRainbowKitAuth();
  const walletAddress = authenticated ? user?.wallet?.address : null;
  const { positions, loading } = usePoolPositions(walletAddress);
  const databasePosition = useMemo(
    () =>
      positions.find(
        (candidate) =>
          candidate.id === positionId || candidate.poolId === positionId,
      ) ?? null,
    [positionId, positions],
  );
  const position = useMemo(
    () =>
      databasePosition
        ? mapPoolPositionToManageDetails(databasePosition)
        : getManagePosition(positionId),
    [databasePosition, positionId],
  );
  const [quoteToken, setQuoteToken] = useState<SwapTokenSymbol | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);

  if (!position && loading) {
    return (
      <main className="mx-auto flex min-h-[240px] w-full max-w-7xl items-center justify-center px-4 py-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </main>
    );
  }

  if (!position) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center">
          <h1 className="text-xl font-semibold text-foreground">
            Position not found
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We couldn&apos;t find this liquidity position.
          </p>
          <Link
            href="/pool"
            className="mt-5 inline-flex rounded-full bg-primary px-5 py-2 text-sm font-bold text-black transition-colors hover:bg-primary/90"
          >
            Back to Pool
          </Link>
        </div>
      </main>
    );
  }

  const token0 = position.token0 as SwapTokenSymbol;
  const token1 = position.token1 as SwapTokenSymbol;
  const resolvedQuote = quoteToken ?? token0;
  const baseToken = resolvedQuote === token0 ? token1 : token0;
  const unitLabel = `${resolvedQuote} per ${baseToken}`;
  const edgeNote = `Your position will be 100% ${resolvedQuote} at this price.`;

  return (
    <>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link href="/pool" className="transition-colors hover:text-foreground">
            Pool
          </Link>
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
          <span className="text-foreground">Manage Position</span>
        </div>

        <section className="mx-auto w-fit max-w-full rounded-[30px] bg-card p-5 sm:p-6">
          <div className="flex w-full max-w-[741px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
              <TokenPairIcon
                token0={position.token0}
                token1={position.token1}
                size="md"
              />
              <span className="truncate text-base font-medium text-foreground">
                {position.pair}
              </span>
              <span className="rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-light text-muted-foreground">
                {position.feeLabel}
              </span>
              <StatusBadge status={position.status} />
            </div>

            <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={() =>
                  router.push(buildIncreaseLiquidityPath(position.poolId))
                }
                className="inline-flex h-10 w-full items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-black transition-colors hover:bg-primary/90 sm:w-auto"
              >
                Increase Liquidity
              </button>
              <button
                type="button"
                onClick={() => setRemoveOpen(true)}
                className="inline-flex h-10 w-full items-center justify-center rounded-full bg-primary/15 px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/25 sm:w-auto"
              >
                Remove Liquidity
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <div className="flex h-auto min-h-[240px] w-full max-w-[364.5px] flex-col rounded-[20px] border border-border bg-secondary/60 px-4 py-5 sm:h-[268px] sm:px-8">
              <p className="text-sm font-medium text-foreground">Liquidity</p>
              <p className="mt-3 truncate text-[28px] font-medium leading-none tracking-tight text-foreground tabular-nums sm:text-[36px]">
                {position.liquidityUsd}
              </p>
              <div className="mt-4 flex min-h-[110px] w-full max-w-[300.5px] flex-col justify-center gap-3 self-center rounded-[20px] border border-border bg-card px-3 py-3 sm:mt-auto sm:px-4">
                {position.holdings.map((row) => (
                  <TokenAmountRow
                    key={row.token}
                    token={row.token}
                    amount={row.amount}
                    share={row.share}
                  />
                ))}
              </div>
            </div>

            <div className="flex h-auto min-h-[240px] w-full max-w-[364.5px] flex-col rounded-[20px] border border-border bg-secondary/60 px-4 py-5 sm:h-[268px] sm:px-8">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">Unclaimed Fee</p>
                <button
                  type="button"
                  onClick={() => setClaimOpen(true)}
                  className="inline-flex h-8 shrink-0 items-center justify-center rounded-full bg-primary px-3.5 text-xs font-semibold text-black transition-colors hover:bg-primary/90"
                >
                  Collect Fees
                </button>
              </div>
              <p className="mt-3 truncate text-[28px] font-medium leading-none tracking-tight text-foreground tabular-nums sm:text-[36px]">
                {position.unclaimedFeeUsd}
              </p>
              <div className="mt-4 flex min-h-[110px] w-full max-w-[300.5px] flex-col justify-center gap-3 self-center rounded-[20px] border border-border bg-card px-3 py-3 sm:mt-auto sm:px-4">
                {position.feeBreakdown.map((row) => (
                  <TokenAmountRow
                    key={row.token}
                    token={row.token}
                    amount={row.amount}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 w-full max-w-[741px]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2.5">
                <h3 className="text-sm font-medium text-foreground">
                  Price Range
                </h3>
                <StatusBadge status={position.status} />
              </div>
              <QuoteTokenToggle
                token0={token0}
                token1={token1}
                value={resolvedQuote}
                onChange={setQuoteToken}
              />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <RangeBoundCard
                label="Min Price"
                value={position.minPrice}
                unitLabel={unitLabel}
                note={edgeNote}
              />
              <RangeBoundCard
                label="Max Price"
                value={position.maxPrice}
                unitLabel={unitLabel}
                note={edgeNote}
              />
            </div>

            <div className="mt-5 text-center">
              <p className="text-sm font-light text-muted-foreground">Current Price</p>
              <p className="mt-2 truncate text-[28px] font-medium leading-none tracking-tight text-foreground tabular-nums sm:text-[36px]">
                {position.currentPrice}
              </p>
              <p className="mt-2 text-sm font-light text-muted-foreground">
                {unitLabel}
              </p>
            </div>
          </div>
        </section>
      </main>

      <RemoveLiquidityModal
        isOpen={removeOpen}
        onClose={() => setRemoveOpen(false)}
        pair={position.pair}
        token0={position.token0}
        token1={position.token1}
        status={position.status}
        pooled0={
          position.holdings.find((row) => row.token === position.token0)
            ?.amount ?? "0"
        }
        pooled1={
          position.holdings.find((row) => row.token === position.token1)
            ?.amount ?? "0"
        }
        fees0={
          position.feeBreakdown.find((row) => row.token === position.token0)
            ?.amount.replace("$", "") ?? "0"
        }
        fees1={
          position.feeBreakdown.find((row) => row.token === position.token1)
            ?.amount.replace("$", "") ?? "0"
        }
      />

      <ClaimFeesModal
        isOpen={claimOpen}
        onClose={() => setClaimOpen(false)}
        fees={position.feeBreakdown.map((row) => ({
          token: row.token,
          amount: row.amount,
        }))}
      />
    </>
  );
}

