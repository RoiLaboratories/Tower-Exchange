"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { ArrowUpDown } from "lucide-react";
import arcBadge from "@/public/assets/ARCSvg.svg";
import fullscreenIcon from "@/public/assets/fullscreen_icon.svg";
import type { SwapTokenSymbol } from "@/lib/swapTokens";
import { getTokenIcon } from "@/lib/tokenIcons";

export type ChartTimeframe = "1D" | "1W" | "1M" | "1Y" | "All time";

export type StrategyIndex = 0 | 1 | 2 | 3;

export const PRICE_STRATEGIES: {
  index: StrategyIndex;
  title: string;
  range: string;
  description: string;
}[] = [
  {
    index: 0,
    title: "Stable",
    range: "Ãƒâ€šÃ‚Â± 1.82%",
    description: "Good for stablecoins or low volatility pairs",
  },
  {
    index: 1,
    title: "Wide",
    range: "ÃƒÂ¢Ã‹â€ Ã¢â‚¬â„¢50% ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â +100%",
    description: "Good for volatile pairs",
  },
  {
    index: 2,
    title: "One-sided lower",
    range: "ÃƒÂ¢Ã‹â€ Ã¢â‚¬â„¢50%",
    description: "Supply liquidity if price goes down",
  },
  {
    index: 3,
    title: "One-sided Upper",
    range: "+100%",
    description: "Supply liquidity if price goes up",
  },
];

const CHART_PLOT_MIN_HEIGHT = 380;

function DesignSection({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`relative w-full ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

function depositTokenCircleColor(token: SwapTokenSymbol) {
  if (token === "EURC") {
    return "#0B53BF";
  }

  return "#3E73C4";
}

function TokenIconWithArcBadge({
  token,
  size = "md",
}: {
  token: SwapTokenSymbol;
  size?: "sm" | "md";
}) {
  const icon = getTokenIcon(token);
  const outer = size === "sm" ? 18 : 26;
  const badge = size === "sm" ? 9 : 11;

  return (
    <span
      className="relative inline-flex shrink-0"
      style={{ width: outer, height: outer }}
    >
      <span
        className="inline-flex items-center justify-center overflow-hidden rounded-full"
        style={{
          width: outer,
          height: outer,
          backgroundColor: depositTokenCircleColor(token),
        }}
      >
        {icon ? (
          <Image
            src={icon}
            alt=""
            width={outer}
            height={outer}
            className="h-full w-full object-cover"
            aria-hidden
          />
        ) : null}
      </span>
      <span
        className="absolute inline-flex items-center justify-center overflow-hidden rounded-full border border-[#191A1C] bg-card"
        style={{
          width: badge,
          height: badge,
          right: size === "sm" ? -1 : -2,
          bottom: size === "sm" ? -1 : -2,
        }}
      >
        <Image
          src={arcBadge}
          alt=""
          width={badge}
          height={badge}
          className="h-full w-full object-cover"
          aria-hidden
        />
      </span>
    </span>
  );
}

function TokenToggleButton({
  token,
  active,
  onClick,
}: {
  token: SwapTokenSymbol;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-[24px] min-w-[72px] items-center justify-center gap-1.5 rounded-[12px] px-2.5 text-xs font-light text-foreground transition-colors ${
        active ? "bg-white/[0.08]" : "bg-transparent hover:bg-white/[0.04]"
      }`}
    >
      <TokenIconWithArcBadge token={token} size="sm" />
      {token}
    </button>
  );
}

interface PriceChartPanelProps {
  token0: SwapTokenSymbol;
  token1: SwapTokenSymbol;
  quoteToken: SwapTokenSymbol;
  onQuoteTokenChange: (token: SwapTokenSymbol) => void;
  timeframe: ChartTimeframe;
  onTimeframeChange: (timeframe: ChartTimeframe) => void;
  priceLabel: string;
  priceUsdLabel: string;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFullscreen?: () => void;
  onReset?: () => void;
}

export function PriceChartPanel({
  token0,
  token1,
  quoteToken,
  onQuoteTokenChange,
  timeframe,
  onTimeframeChange,
  priceLabel,
  priceUsdLabel,
  onZoomIn,
  onZoomOut,
  onFullscreen,
  onReset,
}: PriceChartPanelProps) {
  const timeframes: ChartTimeframe[] = ["1D", "1W", "1M", "1Y", "All time"];

  return (
    <DesignSection className="overflow-hidden rounded-t-[20px] bg-secondary">
      <div className="flex flex-col px-5 pt-5 pb-5">
        <div className="flex shrink-0 items-start justify-between gap-3">
          <div>
            <p className="text-xs leading-none text-muted-foreground">Current price</p>
            <p className="mt-1.5 text-sm leading-snug text-foreground">
              {priceLabel}{" "}
              <span className="text-muted-foreground">({priceUsdLabel})</span>
            </p>
          </div>

          <div className="inline-flex h-[32px] shrink-0 items-center rounded-full border border-border p-[3px]">
            <TokenToggleButton
              token={token0}
              active={quoteToken === token0}
              onClick={() => onQuoteTokenChange(token0)}
            />
            <TokenToggleButton
              token={token1}
              active={quoteToken === token1}
              onClick={() => onQuoteTokenChange(token1)}
            />
          </div>
        </div>

        <div
          className="mt-3 flex flex-col rounded-t-[30px] bg-muted"
          style={{ minHeight: CHART_PLOT_MIN_HEIGHT }}
        >
          <div className="min-h-0 flex-1" aria-hidden />

          <div className="flex shrink-0 items-center gap-3 px-5 pb-5 pt-3">
            <div className="inline-flex h-[28px] w-fit shrink-0 items-center gap-1 rounded-full border border-border px-1.5">
              {timeframes.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onTimeframeChange(item)}
                  className={`h-[20px] shrink-0 rounded-[10px] px-1.5 text-[10px] transition-colors ${
                    timeframe === item
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="inline-flex h-[28px] w-[88px] shrink-0 items-stretch rounded-full border border-border">
              <button
                type="button"
                onClick={onZoomOut}
                className="inline-flex flex-1 items-center justify-center text-foreground hover:text-foreground"
                aria-label="Zoom out"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M4.5 7H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
              <span className="w-px self-center bg-muted" style={{ height: 22 }} aria-hidden />
              <button
                type="button"
                onClick={onFullscreen}
                className="inline-flex flex-1 items-center justify-center text-foreground hover:text-foreground"
                aria-label="Fullscreen"
              >
                <Image src={fullscreenIcon} alt="" width={13} height={13} aria-hidden />
              </button>
              <span className="w-px self-center bg-muted" style={{ height: 22 }} aria-hidden />
              <button
                type="button"
                onClick={onZoomIn}
                className="inline-flex flex-1 items-center justify-center text-foreground hover:text-foreground"
                aria-label="Zoom in"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M4.5 7H9.5M7 4.5V9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="flex-1" aria-hidden />

            <button
              type="button"
              onClick={onReset}
              className="inline-flex h-[28px] w-[58px] shrink-0 items-center justify-center rounded-lg bg-card text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </DesignSection>
  );
}

interface FullRangePanelProps {
  priceValue: string;
  priceUnitLabel: string;
  estAprValue?: string;
  estAprStatus?: string;
}

export function FullRangePanel({
  priceValue,
  priceUnitLabel,
  estAprValue = "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â",
  estAprStatus = "Out of range, not earning fees",
}: FullRangePanelProps) {
  const boxClass =
    "rounded-[20px] border border-[#303133] bg-transparent px-4 py-4";

  return (
    <DesignSection className="space-y-3">
      <div className={boxClass}>
        <p className="text-[11px] font-light text-muted-foreground">Current Price</p>
        <p className="mt-2 text-2xl font-bold leading-none text-foreground">
          {priceValue}
        </p>
        <p className="mt-1.5 text-[11px] font-light text-muted-foreground">
          {priceUnitLabel}
        </p>
      </div>

      <div className={`${boxClass} flex items-center justify-between gap-3`}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#22C55E]"
              aria-hidden
            />
            <p className="text-[11px] font-light text-muted-foreground">EST. APR</p>
          </div>
          <p className="mt-1.5 text-[11px] font-light text-muted-foreground">
            {estAprStatus}
          </p>
        </div>
        <p className="shrink-0 self-center text-2xl font-light leading-none text-foreground">
          {estAprValue}
        </p>
      </div>
    </DesignSection>
  );
}

interface PriceStrategiesPanelProps {
  selectedStrategy: StrategyIndex;
  onSelectStrategy: (index: StrategyIndex) => void;
}

export function PriceStrategiesPanel({
  selectedStrategy,
  onSelectStrategy,
}: PriceStrategiesPanelProps) {
  return (
    <DesignSection>
      <h3 className="mb-3 text-sm font-medium text-foreground">Price Strategies</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {PRICE_STRATEGIES.map((strategy) => {
          const isSelected = selectedStrategy === strategy.index;

          return (
            <button
              key={strategy.index}
              type="button"
              onClick={() => onSelectStrategy(strategy.index)}
              className={`flex h-[118px] min-w-0 flex-col rounded-2xl px-3.5 py-3.5 text-left transition-colors ${
                isSelected ? "bg-accent" : "bg-card hover:bg-accent"
              }`}
            >
              <p className="text-xs font-light text-foreground">{strategy.title}</p>
              <p className="mt-1.5 break-words text-[13px] font-light leading-none text-foreground">
                {strategy.range}
              </p>
              <p className="mt-auto pt-3 text-[11px] font-light leading-[1.35] text-[#9CA0A7]">
                {strategy.description}
              </p>
            </button>
          );
        })}
      </div>
    </DesignSection>
  );
}

function PriceAdjustButton({
  kind,
  onClick,
  label,
}: {
  kind: "plus" | "minus";
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-accent"
    >
      {kind === "plus" ? (
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path d="M7 3V11M3 7H11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path d="M3 7H11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}

interface PriceRangePanelProps {
  minPrice: string;
  maxPrice: string;
  minDelta: string;
  maxDelta: string;
  onMinPriceChange: (value: string) => void;
  onMaxPriceChange: (value: string) => void;
  onAdjustMin: (direction: "up" | "down") => void;
  onAdjustMax: (direction: "up" | "down") => void;
}

function PriceBoundColumn({
  label,
  value,
  delta,
  onChange,
  onAdjustUp,
  onAdjustDown,
}: {
  label: string;
  value: string;
  delta: string;
  onChange: (value: string) => void;
  onAdjustUp: () => void;
  onAdjustDown: () => void;
}) {
  return (
    <div className="relative h-[125px] flex-1 bg-secondary">
      <p className="absolute left-5 top-[18px] text-xs text-muted-foreground">
        {label}
      </p>

      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="absolute left-5 top-[52px] w-[calc(100%-72px)] bg-transparent text-[24px] font-light leading-none text-foreground outline-none sm:text-[32px]"
      />

      <p className="absolute left-5 top-[92px] text-xs leading-none text-[#9CA0A7]">
        {delta}
      </p>

      <div className="absolute right-5 top-[28px] flex flex-col gap-4">
        <PriceAdjustButton
          kind="plus"
          onClick={onAdjustUp}
          label={`Increase ${label.toLowerCase()}`}
        />
        <PriceAdjustButton
          kind="minus"
          onClick={onAdjustDown}
          label={`Decrease ${label.toLowerCase()}`}
        />
      </div>
    </div>
  );
}

export function PriceRangePanel({
  minPrice,
  maxPrice,
  minDelta,
  maxDelta,
  onMinPriceChange,
  onMaxPriceChange,
  onAdjustMin,
  onAdjustMax,
}: PriceRangePanelProps) {
  return (
    <DesignSection className="overflow-hidden rounded-b-[20px]">
      <div className="flex gap-2">
        <PriceBoundColumn
          label="Min price"
          value={minPrice}
          delta={minDelta}
          onChange={onMinPriceChange}
          onAdjustUp={() => onAdjustMin("up")}
          onAdjustDown={() => onAdjustMin("down")}
        />
        <PriceBoundColumn
          label="Max price"
          value={maxPrice}
          delta={maxDelta}
          onChange={onMaxPriceChange}
          onAdjustUp={() => onAdjustMax("up")}
          onAdjustDown={() => onAdjustMax("down")}
        />
      </div>
    </DesignSection>
  );
}

interface DepositTokensPanelProps {
  token0: SwapTokenSymbol;
  token1: SwapTokenSymbol;
  deposit0: string;
  deposit1: string;
  onDeposit0Change: (value: string) => void;
  onDeposit1Change: (value: string) => void;
  description?: string;
}

function DepositTokenIcon({ token }: { token: SwapTokenSymbol }) {
  return <TokenIconWithArcBadge token={token} size="md" />;
}

function DepositTokenRow({
  token,
  value,
  onChange,
}: {
  token: SwapTokenSymbol;
  value: string;
  onChange: (value: string) => void;
}) {
  const displayAmount = value || "0";

  return (
    <div className="flex h-[96px] items-center justify-between rounded-2xl border border-[#303133] px-4">
      <input
        type="text"
        inputMode="decimal"
        placeholder="0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 bg-transparent text-[28px] font-light leading-none text-foreground outline-none placeholder:font-light placeholder:text-foreground focus:placeholder:text-muted-foreground sm:text-[40px]"
      />
      <div className="ml-3 flex shrink-0 flex-col items-end">
        <div className="inline-flex items-center gap-1.5 text-xs font-light text-foreground">
          <DepositTokenIcon token={token} />
          {token}
        </div>
        <p className="mt-1.5 max-w-[120px] truncate text-xs font-light text-muted-foreground sm:max-w-none">
          {displayAmount} {token}
        </p>
      </div>
    </div>
  );
}

export function DepositTokensPanel({
  token0,
  token1,
  deposit0,
  deposit1,
  onDeposit0Change,
  onDeposit1Change,
  description = "Specify the token amounts for your liquidity contribution.",
}: DepositTokensPanelProps) {
  const [tokensSwapped, setTokensSwapped] = useState(false);
  const showEnterAmount = !deposit0.trim() && !deposit1.trim();

  const topToken = tokensSwapped ? token1 : token0;
  const bottomToken = tokensSwapped ? token0 : token1;
  const topValue = tokensSwapped ? deposit1 : deposit0;
  const bottomValue = tokensSwapped ? deposit0 : deposit1;
  const onTopChange = tokensSwapped ? onDeposit1Change : onDeposit0Change;
  const onBottomChange = tokensSwapped ? onDeposit0Change : onDeposit1Change;

  return (
    <DesignSection>
      <h3 className="text-sm font-medium text-foreground">Deposit Tokens</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>

      <div className="relative mt-3">
        <div className="space-y-2">
          <DepositTokenRow
            token={topToken}
            value={topValue}
            onChange={onTopChange}
          />
          <DepositTokenRow
            token={bottomToken}
            value={bottomValue}
            onChange={onBottomChange}
          />
        </div>

        <button
          type="button"
          onClick={() => setTokensSwapped((current) => !current)}
          aria-label="Switch token positions"
          className="group absolute left-1/2 top-1/2 z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-md transition-transform hover:scale-105"
        >
          <ArrowUpDown className="h-4 w-4 text-black transition-transform duration-300 ease-out group-hover:rotate-180" />
        </button>
      </div>

      {showEnterAmount ? (
        <button
          type="button"
          disabled
          className="mt-3 flex h-[44px] w-full cursor-not-allowed items-center justify-center rounded-[10px] bg-accent text-xs font-medium text-muted-foreground"
        >
          Enter an amount
        </button>
      ) : null}
    </DesignSection>
  );
}

interface ReviewPositionPanelProps {
  poolLabel: string;
  feeLabel: string;
  rangeLabel: string;
  depositLabel: string;
  estAprLabel: string;
}

export function ReviewPositionPanel({
  poolLabel,
  feeLabel,
  rangeLabel,
  depositLabel,
  estAprLabel,
}: ReviewPositionPanelProps) {
  const rows = [
    { label: "POOL", value: `${poolLabel} ${feeLabel}` },
    { label: "RANGE", value: rangeLabel },
    { label: "DEPOSIT", value: depositLabel },
    { label: "EST. APR", value: estAprLabel },
  ];

  return (
    <DesignSection className="rounded-2xl border border-[#303133] px-4 py-4">
      <h3 className="text-sm font-medium text-foreground">Review Position</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Check the core details before previewing
      </p>

      <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="min-w-0">
            <p className="text-[10px] tracking-wide text-muted-foreground">{row.label}</p>
            <p className="mt-1.5 break-words text-xs font-light text-foreground">
              {row.value}
            </p>
          </div>
        ))}
      </div>
    </DesignSection>
  );
}

interface TokenApprovalPanelProps {
  token0: SwapTokenSymbol;
  token1: SwapTokenSymbol;
  approved0: boolean;
  approved1: boolean;
  onApprove0: () => void;
  onApprove1: () => void;
  onPreview?: () => void;
}

export function TokenApprovalPanel({
  token0,
  token1,
  approved0,
  approved1,
  onApprove0,
  onApprove1,
  onPreview,
}: TokenApprovalPanelProps) {
  const canPreview = approved0 && approved1;

  return (
    <DesignSection>
      <div className="flex min-h-[72px] items-start gap-3 rounded-lg bg-muted px-4 py-3.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#535353]">
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden>
            <circle cx="9" cy="9" r="7" stroke="white" strokeWidth="1.6" />
            <path d="M9 6.2V9.4M9 11.8H9.01" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground">
            Token Approval Required
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Approve the token spend before previewing the liquidity transaction.
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <ApproveTokenButton
          token={token0}
          approved={approved0}
          onClick={onApprove0}
        />
        <ApproveTokenButton
          token={token1}
          approved={approved1}
          onClick={onApprove1}
        />
      </div>

      <button
        type="button"
        onClick={onPreview}
        disabled={!canPreview}
        className="mt-2 flex h-[44px] w-full items-center justify-center rounded-full bg-primary text-xs font-medium text-[#0C0C0D] transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
      >
        Preview
      </button>
    </DesignSection>
  );
}

function ApproveTokenButton({
  token,
  approved,
  onClick,
}: {
  token: SwapTokenSymbol;
  approved: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={approved}
      className="flex h-[44px] flex-1 items-center justify-center rounded-full bg-primary text-xs font-medium text-[#0C0C0D] transition-colors hover:bg-primary/90 disabled:cursor-default disabled:bg-muted disabled:text-muted-foreground"
    >
      {approved ? `${token} Approved` : `Approve ${token}`}
    </button>
  );
}
