"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, RotateCcw, Settings } from "lucide-react";
import NewPositionStepper from "@/components/pool/new/NewPositionStepper";
import { DepositTokensPanel } from "@/components/pool/new/step2/NewPositionStep2Sections";
import {
  CurrentHoldingsPanel,
  IncreaseLiquidityCardHeader,
  SelectedRangePanel,
} from "@/components/pool/increase/IncreaseLiquiditySections";
import { getExistingPoolPosition } from "@/lib/pool/data";
import usePoolPositions from "@/lib/hooks/usePoolPositions";
import { mapPoolPositionToExistingPoolPosition } from "@/lib/pool/positionMapping";
import { useRainbowKitAuth } from "@/lib/use-rainbowkit-auth";
import { getExistingPositionTokens } from "@/lib/pool/increaseLiquidity";
import type { ExistingPoolPosition } from "@/lib/pool/types";
import type { SwapTokenSymbol } from "@/lib/swapTokens";

const MOCK_PRICE_RATIO = 2.093;

function sanitizeDepositInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [whole = "", ...fractionParts] = cleaned.split(".");
  if (fractionParts.length === 0) {
    return whole;
  }

  return `${whole}.${fractionParts.join("")}`;
}

function formatDepositQuote(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }

  const fixed = value >= 1 ? value.toFixed(6) : value.toFixed(8);
  return fixed.replace(/\.?0+$/, "");
}

function ExistingPositionSummaryCard({
  position,
}: {
  position: ExistingPoolPosition;
}) {
  const rows = [
    { label: "Pair", value: position.pair },
    { label: "Fee", value: position.feeLabel },
    { label: "Mode", value: position.mode },
  ];

  return (
    <div className="w-full rounded-xl bg-card px-4 py-3">
      <h3 className="text-sm font-semibold text-foreground">Position</h3>
      <dl className="mt-3 space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4">
            <dt className="text-xs text-muted-foreground">{row.label}</dt>
            <dd className="text-right text-xs font-light text-foreground">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

interface IncreaseLiquidityContentProps {
  poolId: string;
}

export default function IncreaseLiquidityContent({
  poolId,
}: IncreaseLiquidityContentProps) {
  const router = useRouter();
  const { authenticated, user } = useRainbowKitAuth();
  const walletAddress = authenticated ? user?.wallet?.address : null;
  const { positions, loading } = usePoolPositions(walletAddress);
  const databasePosition = useMemo(
    () =>
      positions.find(
        (candidate) => candidate.id === poolId || candidate.poolId === poolId,
      ) ?? null,
    [poolId, positions],
  );
  const position = useMemo(
    () =>
      databasePosition
        ? mapPoolPositionToExistingPoolPosition(databasePosition)
        : getExistingPoolPosition(poolId),
    [databasePosition, poolId],
  );
  const tokens = useMemo(
    () => (position ? getExistingPositionTokens(position) : null),
    [position],
  );

  const [quoteToken, setQuoteToken] = useState<SwapTokenSymbol | null>(null);
  const [deposit0, setDeposit0] = useState("");
  const [deposit1, setDeposit1] = useState("");

  const resolvedQuoteToken =
    quoteToken ?? tokens?.token0 ?? ("USDC" as SwapTokenSymbol);

  if (!position && loading) {
    return (
      <main className="mx-auto flex min-h-[240px] w-full max-w-6xl items-center justify-center px-4 py-5 sm:px-5 sm:py-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-white" />
      </main>
    );
  }

  if (!position || !tokens) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-5 sm:py-6">
        <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center">
          <h1 className="text-xl font-semibold text-foreground">
            Position not found
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We couldn&apos;t find an existing position for this pool.
          </p>
          <Link
            href="/pool/explore"
            className="mt-5 inline-flex rounded-full bg-primary px-5 py-2 text-sm font-bold text-black transition-colors hover:bg-primary/90"
          >
            Back to Explore
          </Link>
        </div>
      </main>
    );
  }

  const handleReset = () => {
    setDeposit0("");
    setDeposit1("");
    setQuoteToken(tokens.token0);
  };

  const handleDeposit0Change = (value: string) => {
    const next = sanitizeDepositInput(value);
    setDeposit0(next);

    if (!next.trim()) {
      setDeposit1("");
      return;
    }

    const amount = Number(next);
    if (!Number.isFinite(amount)) {
      return;
    }

    setDeposit1(formatDepositQuote(amount / MOCK_PRICE_RATIO));
  };

  const handleDeposit1Change = (value: string) => {
    const next = sanitizeDepositInput(value);
    setDeposit1(next);

    if (!next.trim()) {
      setDeposit0("");
      return;
    }

    const amount = Number(next);
    if (!Number.isFinite(amount)) {
      return;
    }

    setDeposit0(formatDepositQuote(amount * MOCK_PRICE_RATIO));
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-5 sm:py-6">
      <div className="mb-4">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Link href="/pool" className="transition-colors hover:text-foreground">
            Your Positions
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="text-foreground">Increase Liquidity</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Add to existing position
          </h1>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-[8px] bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
            <button
              type="button"
              aria-label="Position settings"
              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] bg-card text-foreground transition-colors hover:bg-accent"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <aside className="flex w-full shrink-0 flex-col gap-3 xl:w-[360px]">
          <NewPositionStepper compact currentStep={2} />
          <ExistingPositionSummaryCard position={position} />
        </aside>

        <section className="min-w-0 flex-1 overflow-hidden rounded-xl bg-card">
          <IncreaseLiquidityCardHeader position={position} />

          <div className="space-y-4 p-4 sm:p-5">
            <CurrentHoldingsPanel position={position} />

            <SelectedRangePanel
              token0={tokens.token0}
              token1={tokens.token1}
              quoteToken={resolvedQuoteToken}
              onQuoteTokenChange={setQuoteToken}
              minPrice={position.minPrice}
              maxPrice={position.maxPrice}
            />

            <DepositTokensPanel
              token0={tokens.token0}
              token1={tokens.token1}
              deposit0={deposit0}
              deposit1={deposit1}
              onDeposit0Change={handleDeposit0Change}
              onDeposit1Change={handleDeposit1Change}
              description="Specify the token amounts for your additional liquidity contribution."
            />

            {deposit0.trim() || deposit1.trim() ? (
              <button
                type="button"
                onClick={() => router.push("/pool")}
                className="flex h-[44px] w-full items-center justify-center rounded-[10px] bg-primary text-xs font-bold text-black transition-colors hover:bg-primary/90"
              >
                Preview
              </button>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}


