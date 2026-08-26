"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
// Custom range temporarily disabled ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â full range only for now
// import FullCustomRangeTabs from "@/components/pool/new/FullCustomRangeTabs";
import NewPositionStepper, {
  NewPositionPageHeader,
  NewPositionSummaryCard,
} from "@/components/pool/new/NewPositionStepper";
import NewPositionStep2CardHeader from "@/components/pool/new/step2/NewPositionStep2CardHeader";
import {
  DepositTokensPanel,
  FullRangePanel,
  // Custom range temporarily disabled ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â full range only for now
  // PriceChartPanel,
  // PriceRangePanel,
  // PriceStrategiesPanel,
  ReviewPositionPanel,
  TokenApprovalPanel,
  // type ChartTimeframe,
  // type StrategyIndex,
} from "@/components/pool/new/step2/NewPositionStep2Sections";
import AddLiquidityModal from "@/components/pool/modals/AddLiquidityModal";
import { useRainbowKitAuth } from "@/lib/use-rainbowkit-auth";
import { userApiFetch } from "@/lib/userApi";
import { buildManagePositionPath } from "@/lib/pool/increaseLiquidity";
import { getTowerPoolByTokens } from "@/lib/pool/towerPools";
import {
  formatPoolFeeLabel,
  parseNewPositionSearchParams,
  resolveNewPositionSelection,
} from "@/lib/pool/newPosition";
type RangeMode = "full" | "custom";

// Custom range temporarily disabled ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â full range only for now
// const STRATEGY_PRESETS: Record<
//   StrategyIndex,
//   { min: number; max: number; minDelta: string; maxDelta: string }
// > = {
//   0: { min: 35000, max: 35000, minDelta: "-7.60%", maxDelta: "-7.60%" },
//   1: { min: 17500, max: 70000, minDelta: "-50.0%", maxDelta: "+100.0%" },
//   2: { min: 17500, max: 35000, minDelta: "-50.0%", maxDelta: "0.0%" },
//   3: { min: 35000, max: 70000, minDelta: "0.0%", maxDelta: "+100.0%" },
// };
//
// const MOCK_CURRENT_PRICE = 1758.69;

const MOCK_FULL_RANGE_PRICE = 2.093;

interface SavePoolPositionResponse {
  success: boolean;
  position?: {
    id?: string | null;
  } | null;
}

// export function formatBoundPrice(usd: number) {
//   if (!Number.isFinite(usd)) {
//     return "$0";
//   }
//
//   if (usd >= 1000) {
//     return `$${Math.round(usd / 1000)}K`;
//   }
//
//   return `$${usd.toFixed(2)}`;
// }
//
// function parseBoundPriceInput(value: string) {
//   const normalized = value.trim().replace(/[$,\s]/g, "").toUpperCase();
//   if (!normalized) {
//     return null;
//   }
//
//   if (normalized.endsWith("K")) {
//     const parsed = Number(normalized.slice(0, -1));
//     return Number.isFinite(parsed) ? parsed * 1000 : null;
//   }
//
//   const parsed = Number(normalized);
//   return Number.isFinite(parsed) ? parsed : null;
// }
//
// function adjustBoundPrice(value: number, direction: "up" | "down") {
//   const step = value >= 10000 ? 1000 : value >= 1000 ? 100 : 10;
//   const next = direction === "up" ? value + step : value - step;
//   return Math.max(0, next);
// }

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

export default function NewPositionStep2Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selection = useMemo(
    () => resolveNewPositionSelection(parseNewPositionSearchParams(searchParams)),
    [searchParams],
  );
  const { authenticated, user, login } = useRainbowKitAuth();
  const walletAddress = authenticated ? user?.wallet?.address : null;
  const selectedPool = useMemo(
    () =>
      selection
        ? getTowerPoolByTokens(selection.token0, selection.token1)
        : null,
    [selection],
  );
  const [rangeMode, setRangeMode] = useState<RangeMode>("full");
  // Custom range temporarily disabled ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â full range only for now
  // const [quoteToken, setQuoteToken] = useState<SwapTokenSymbol>("USDC");
  // const [timeframe, setTimeframe] = useState<ChartTimeframe>("1M");
  // const [selectedStrategy, setSelectedStrategy] = useState<StrategyIndex>(0);
  // const [minPrice, setMinPrice] = useState(STRATEGY_PRESETS[0].min);
  // const [maxPrice, setMaxPrice] = useState(STRATEGY_PRESETS[0].max);
  const [deposit0, setDeposit0] = useState("");
  const [deposit1, setDeposit1] = useState("");
  const [approved0, setApproved0] = useState(false);
  const [approved1, setApproved1] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isAddingPosition, setIsAddingPosition] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  useEffect(() => {
    if (!selection) {
      router.replace("/pool/new");
    }
  }, [router, selection]);

  // useEffect(() => {
  //   if (selection) {
  //     setQuoteToken(selection.token1);
  //   }
  // }, [selection]);

  if (!selection) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-5 sm:py-6">
        <div className="flex min-h-[240px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-white" />
        </div>
      </main>
    );
  }

  const feeLabel = formatPoolFeeLabel(selection.fee);
  // const selectedPreset = STRATEGY_PRESETS[selectedStrategy];
  //
  // const priceLabel = `${MOCK_CURRENT_PRICE.toLocaleString("en-US", {
  //   minimumFractionDigits: 2,
  //   maximumFractionDigits: 2,
  // })} ${selection.token0}/${selection.token1}`;
  //
  // const priceUsdLabel = `$${MOCK_CURRENT_PRICE.toLocaleString("en-US", {
  //   minimumFractionDigits: 2,
  //   maximumFractionDigits: 2,
  // })}`;

  const handleReset = () => {
    setRangeMode("full");
    // setSelectedStrategy(0);
    // setMinPrice(STRATEGY_PRESETS[0].min);
    // setMaxPrice(STRATEGY_PRESETS[0].max);
    setDeposit0("");
    setDeposit1("");
    setApproved0(false);
    setApproved1(false);
    // setQuoteToken(selection.token1);
    // setTimeframe("1M");
  };

  // const handleSelectStrategy = (index: StrategyIndex) => {
  //   setSelectedStrategy(index);
  //   const preset = STRATEGY_PRESETS[index];
  //   setMinPrice(preset.min);
  //   setMaxPrice(preset.max);
  // };

  // token0 per token1 (e.g. USDC per EURC)
  const depositPriceRatio = MOCK_FULL_RANGE_PRICE;

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

    setDeposit1(formatDepositQuote(amount / depositPriceRatio));
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

    setDeposit0(formatDepositQuote(amount * depositPriceRatio));
  };

  const rangeLabel = "Full range";
  // rangeMode === "full"
  //   ? "Full range"
  //   : `${formatBoundPrice(minPrice)} ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“ ${formatBoundPrice(maxPrice)}`;

  const depositLabel =
    deposit0 || deposit1
      ? `${deposit0 || "0"} ${selection.token0} + ${deposit1 || "0"} ${selection.token1}`
      : "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â";

  const handlePreview = () => {
    setAddError(null);
    setPreviewOpen(true);
  };

  const amountForPoolToken = (symbol: string) => {
    const normalizedSymbol = symbol.toLowerCase();

    if (selection.token0.toLowerCase() === normalizedSymbol) {
      return deposit0.trim() || "0";
    }

    if (selection.token1.toLowerCase() === normalizedSymbol) {
      return deposit1.trim() || "0";
    }

    return "0";
  };

  const handleAddLiquidity = async () => {
    const deposit0Amount = Number(deposit0 || 0);
    const deposit1Amount = Number(deposit1 || 0);

    if (!Number.isFinite(deposit0Amount) || !Number.isFinite(deposit1Amount)) {
      setAddError("Enter a valid deposit amount.");
      return;
    }

    if (deposit0Amount <= 0 && deposit1Amount <= 0) {
      setAddError("Enter an amount before adding liquidity.");
      return;
    }

    if (!walletAddress) {
      setAddError("Connect your wallet to save this position.");
      login();
      return;
    }

    if (!selectedPool) {
      setAddError("This Tower pool is not supported yet.");
      return;
    }

    setIsAddingPosition(true);
    setAddError(null);

    try {
      const result = await userApiFetch<SavePoolPositionResponse>(
        "/api/pool/positions",
        {
          method: "POST",
          walletAddress,
          body: JSON.stringify({
            poolId: selectedPool.id,
            pairAddress: selectedPool.pairAddress,
            token0Amount: amountForPoolToken(selectedPool.token0),
            token1Amount: amountForPoolToken(selectedPool.token1),
            lpTokenAmount: "0",
            currentPrice: MOCK_FULL_RANGE_PRICE.toString(),
            status: "in-range",
            eventType: "add",
            metadata: {
              source: "pool-new-position-ui",
              rangeMode,
              selectionToken0: selection.token0,
              selectionToken1: selection.token1,
            },
          }),
        },
      );

      if (!result.ok) {
        throw new Error(result.error || "Failed to save pool position.");
      }

      setPreviewOpen(false);
      router.push(
        buildManagePositionPath(result.data?.position?.id || selectedPool.id),
      );
    } catch (error) {
      setAddError(
        error instanceof Error ? error.message : "Failed to save pool position.",
      );
    } finally {
      setIsAddingPosition(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-5 sm:py-6">
      <NewPositionPageHeader compact onReset={handleReset} />

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <aside className="flex w-full shrink-0 flex-col gap-3 xl:w-[360px]">
          <NewPositionStepper compact currentStep={2} />
          <NewPositionSummaryCard compact selection={selection} />
        </aside>

        <section className="min-w-0 flex-1 overflow-hidden rounded-xl bg-card">
          <NewPositionStep2CardHeader selection={selection} />

          <div className="space-y-4 p-4 sm:p-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Price range (Full range)
              </h2>

              <p className="mt-3 max-w-3xl text-[11px] font-light leading-relaxed text-[#FFFFFF] sm:text-xs">
                Your liquidity stays active no matter how the price changes.
                It&apos;s simple to manage but is less capital-efficient.
              </p>
              {/* Full/Custom range tabs temporarily removed ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â full range only
              <div className="mt-3">
                <FullCustomRangeTabs value={rangeMode} onChange={setRangeMode} />
              </div>
              */}
              {/* Custom range subtitle temporarily disabled
              {rangeMode === "custom" ? (
                <p className="mt-3 max-w-3xl text-[11px] font-light leading-relaxed text-[#FFFFFF]">
                  Custom range lets you choose the price range where your
                  liquidity is active. This can help you earn more fees, but{" "}
                  <br />
                  you&apos;ll need to manage it more often.
                </p>
              ) : null}
              */}
            </div>

            <FullRangePanel
              priceValue={MOCK_FULL_RANGE_PRICE.toFixed(3)}
              priceUnitLabel={`${selection.token0} per ${selection.token1}`}
            />
            {/* Custom range panels temporarily disabled ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â full range only for now
            {rangeMode === "custom" ? (
              <>
                <PriceChartPanel
                  token0={selection.token0}
                  token1={selection.token1}
                  quoteToken={quoteToken}
                  onQuoteTokenChange={setQuoteToken}
                  timeframe={timeframe}
                  onTimeframeChange={setTimeframe}
                  priceLabel={priceLabel}
                  priceUsdLabel={priceUsdLabel}
                  onZoomIn={() => {}}
                  onZoomOut={() => {}}
                  onFullscreen={() => {}}
                  onReset={() => setTimeframe("1M")}
                />

                <PriceStrategiesPanel
                  selectedStrategy={selectedStrategy}
                  onSelectStrategy={handleSelectStrategy}
                />

                <PriceRangePanel
                  minPrice={formatBoundPrice(minPrice)}
                  maxPrice={formatBoundPrice(maxPrice)}
                  minDelta={selectedPreset.minDelta}
                  maxDelta={selectedPreset.maxDelta}
                  onMinPriceChange={(value) => {
                    const parsed = parseBoundPriceInput(value);
                    if (parsed !== null) {
                      setMinPrice(parsed);
                    }
                  }}
                  onMaxPriceChange={(value) => {
                    const parsed = parseBoundPriceInput(value);
                    if (parsed !== null) {
                      setMaxPrice(parsed);
                    }
                  }}
                  onAdjustMin={(direction) =>
                    setMinPrice((current) =>
                      adjustBoundPrice(current, direction),
                    )
                  }
                  onAdjustMax={(direction) =>
                    setMaxPrice((current) =>
                      adjustBoundPrice(current, direction),
                    )
                  }
                />
              </>
            ) : null}
            */}
          </div>

          <div className="border-b border-border p-4 sm:p-5">
            <DepositTokensPanel
              token0={selection.token0}
              token1={selection.token1}
              deposit0={deposit0}
              deposit1={deposit1}
              onDeposit0Change={handleDeposit0Change}
              onDeposit1Change={handleDeposit1Change}
            />
          </div>

          <div className="border-b border-border p-4 sm:p-5">
            <ReviewPositionPanel
              poolLabel={`${selection.token0}/${selection.token1}`}
              feeLabel={feeLabel}
              rangeLabel={rangeLabel}
              depositLabel={depositLabel}
              estAprLabel="Not available"
            />
          </div>

          <div className="p-4 sm:p-5">
            <TokenApprovalPanel
              token0={selection.token0}
              token1={selection.token1}
              approved0={approved0}
              approved1={approved1}
              onApprove0={() => setApproved0(true)}
              onApprove1={() => setApproved1(true)}
              onPreview={handlePreview}
            />
          </div>
        </section>
      </div>

      <AddLiquidityModal
        isOpen={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setAddError(null);
        }}
        onAdd={handleAddLiquidity}
        isAdding={isAddingPosition}
        errorMessage={addError}
        pair={`${selection.token0}/${selection.token1}`}
        token0={selection.token0}
        token1={selection.token1}
        feeLabel={feeLabel}
        rangeLabel={rangeLabel === "Full range" ? "Full Range" : rangeLabel}
        depositLabel={
          deposit0 || deposit1
            ? `${deposit0 || "0"} ${selection.token0} and ${deposit1 || "0"} ${selection.token1}`
            : `0 ${selection.token0} and 0 ${selection.token1}`
        }
        currentPrice={MOCK_FULL_RANGE_PRICE.toFixed(3)}
        priceUnitLabel={`${selection.token0} per ${selection.token1}`}
      />
    </main>
  );
}



