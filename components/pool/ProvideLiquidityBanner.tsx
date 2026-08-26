"use client";

import ThemeAwareImage from "@/components/ThemeAwareImage";

interface ProvideLiquidityBannerProps {
  onCreatePosition?: () => void;
  compact?: boolean;
}

export default function ProvideLiquidityBanner({
  onCreatePosition,
  compact = false,
}: ProvideLiquidityBannerProps) {
  return (
    <div
      className={`rounded-2xl border border-border/70 bg-card/60 ${
        compact ? "px-4 py-4 sm:px-5 sm:py-4" : "px-4 py-4 sm:px-5 sm:py-5"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-left">
          <h2 className="text-base font-semibold text-foreground sm:text-lg">
            Provide Liquidity to Tower Pools
          </h2>

          <div className="mt-2">
            <ThemeAwareImage
              darkSrc="/assets/est. net.svg"
              lightSrc="/assets/est-net-light.svg"
              alt="Est. net APR 32.4%"
              width={201}
              height={38}
              className={compact ? "h-[34px] w-auto" : "h-[38px] w-auto"}
            />
          </div>

          <p className="mt-2 max-w-xl text-sm font-light leading-relaxed text-muted-foreground">
            Earn from trading fees by supplying liquidity with USDC, EURC, USDT
            &amp; cirBTC.
          </p>
        </div>

        <button
          type="button"
          onClick={onCreatePosition}
          className={`inline-flex w-full shrink-0 items-center justify-center rounded-full border border-border bg-muted font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary hover:text-[#0C0C0D] sm:w-auto sm:self-center ${
            compact
              ? "h-[50px] px-6 text-sm sm:min-w-[175px] sm:px-7"
              : "h-[55px] px-6 text-sm sm:min-w-[188px] sm:px-8"
          }`}
        >
          Create Position
        </button>
      </div>
    </div>
  );
}
