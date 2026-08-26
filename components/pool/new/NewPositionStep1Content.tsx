"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PoolTokenSelector from "@/components/pool/new/PoolTokenSelector";
import NewPositionStepper, {
  NewPositionPageHeader,
} from "@/components/pool/new/NewPositionStepper";
import type { SwapToken, SwapTokenSymbol } from "@/lib/swapTokens";
import {
  DEFAULT_POOL_FEE_TIER,
  getPoolToken,
  getPoolTokenOptions,
  isValidNewPositionSelection,
  parseNewPositionSearchParams,
  buildNewPositionStep2Path,
} from "@/lib/pool/newPosition";

export default function NewPositionStep1Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSelection = useMemo(
    () => parseNewPositionSearchParams(searchParams),
    [searchParams],
  );

  const [token0, setToken0] = useState<SwapToken | null>(() =>
    getPoolToken(initialSelection.token0) ?? null,
  );
  const [token1, setToken1] = useState<SwapToken | null>(() =>
    getPoolToken(initialSelection.token1) ?? null,
  );

  useEffect(() => {
    setToken0(getPoolToken(initialSelection.token0) ?? null);
    setToken1(getPoolToken(initialSelection.token1) ?? null);
  }, [initialSelection.token0, initialSelection.token1]);

  const token0Options = useMemo(
    () => getPoolTokenOptions(token1?.symbol ?? null),
    [token1],
  );

  const token1Options = useMemo(
    () => getPoolTokenOptions(token0?.symbol ?? null),
    [token0],
  );

  const canContinue = isValidNewPositionSelection(
    token0?.symbol,
    token1?.symbol,
  );

  const handleToken0Select = (token: SwapToken) => {
    setToken0(token);

    if (token1 && !getPoolTokenOptions(token.symbol).some((t) => t.symbol === token1.symbol)) {
      setToken1(null);
    }
  };

  const handleToken1Select = (token: SwapToken) => {
    setToken1(token);

    if (token0 && !getPoolTokenOptions(token.symbol).some((t) => t.symbol === token0.symbol)) {
      setToken0(null);
    }
  };

  const handleReset = () => {
    setToken0(null);
    setToken1(null);
    router.replace("/pool/new");
  };

  const handleContinue = () => {
    if (!canContinue || !token0 || !token1) {
      return;
    }

    router.push(
      buildNewPositionStep2Path({
        token0: token0.symbol as SwapTokenSymbol,
        token1: token1.symbol as SwapTokenSymbol,
        fee: initialSelection.fee ?? DEFAULT_POOL_FEE_TIER,
      }),
    );
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-5 sm:py-6">
      <NewPositionPageHeader compact onReset={handleReset} />

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <aside className="w-full shrink-0 xl:w-[360px]">
          <NewPositionStepper compact currentStep={1} />
        </aside>

        <section className="min-w-0 flex-1 overflow-visible rounded-xl bg-card p-4 sm:p-5">
          <h2 className="text-sm font-light text-[#FFFFFF]">Select Pair</h2>
          <p className="mt-1.5 text-[11px] font-light leading-relaxed text-[#FFFFFF] sm:text-xs">
            Choose the tokens you want to provide liquidity for. You can select tokens on Tower only.
          </p>

          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <PoolTokenSelector
              compact
              selected={token0}
              onSelect={handleToken0Select}
              options={token0Options}
            />
            <PoolTokenSelector
              compact
              selected={token1}
              onSelect={handleToken1Select}
              options={token1Options}
            />
          </div>

          <button
            type="button"
            onClick={handleContinue}
            disabled={!canContinue}
            className="mt-6 flex h-11 w-full items-center justify-center rounded-[10px] text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground enabled:bg-primary enabled:text-[#0C0C0D] enabled:hover:bg-primary/90"
          >
            Continue
          </button>
        </section>
      </div>
    </main>
  );
}
