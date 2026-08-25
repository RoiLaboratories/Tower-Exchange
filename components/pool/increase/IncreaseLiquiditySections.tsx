"use client";

import Image from "next/image";
import type { ExistingPoolPosition, PoolPositionStatus } from "@/lib/pool/types";
import type { SwapTokenSymbol } from "@/lib/swapTokens";
import { getTokenIcon } from "@/lib/tokenIcons";
import TokenPairIcon from "@/components/pool/TokenPairIcon";

const STATUS_LABELS: Record<PoolPositionStatus, string> = {
  "in-range": "In range",
  "out-of-range": "Out of range",
  closed: "Closed",
};

const STATUS_DOT: Record<PoolPositionStatus, string> = {
  "in-range": "bg-[#07D54F]",
  "out-of-range": "bg-[#FF5A5F]",
  closed: "bg-muted-foreground/40",
};

function depositTokenCircleColor(token: SwapTokenSymbol) {
  if (token === "EURC") {
    return "#0B53BF";
  }

  return "#3E73C4";
}

export function IncreaseLiquidityCardHeader({
  position,
}: {
  position: ExistingPoolPosition;
}) {
  return (
    <div className="px-4 pt-4 pb-3">
      <div className="flex min-h-[52px] items-center justify-between gap-3 rounded-[20px] border border-border/60 bg-secondary/15 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <TokenPairIcon
            token0={position.token0}
            token1={position.token1}
            size="md"
          />
          <span className="truncate text-sm font-medium text-foreground">
            {position.pair}
          </span>
          <span className="shrink-0 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-medium text-primary">
            {position.feeLabel}
          </span>
        </div>

        <span
          className={`inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium ${
            position.status === "in-range"
              ? "text-[#07D54F]"
              : position.status === "out-of-range"
                ? "text-[#FF5A5F]"
                : "text-muted-foreground"
          }`}
        >
          {STATUS_LABELS[position.status]}
          <span
            className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[position.status]}`}
            aria-hidden
          />
        </span>
      </div>
    </div>
  );
}

export function CurrentHoldingsPanel({
  position,
}: {
  position: ExistingPoolPosition;
}) {
  const holdingRows = [
    {
      token: position.token0 as SwapTokenSymbol,
      amount: position.holding0,
    },
    {
      token: position.token1 as SwapTokenSymbol,
      amount: position.holding1,
    },
  ];

  return (
    <div className="rounded-[20px] border border-border bg-card px-4 py-3.5">
      <div className="space-y-3">
        {holdingRows.map((row) => {
          const icon = getTokenIcon(row.token);
          return (
            <div
              key={row.token}
              className="flex items-center justify-between gap-3"
            >
              <div className="inline-flex items-center gap-2">
                <span
                  className="inline-flex h-[22px] w-[22px] items-center justify-center overflow-hidden rounded-full"
                  style={{ backgroundColor: depositTokenCircleColor(row.token) }}
                >
                  {icon ? (
                    <Image
                      src={icon}
                      alt=""
                      width={22}
                      height={22}
                      className="h-full w-full object-cover"
                      aria-hidden
                    />
                  ) : null}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {row.token}
                </span>
              </div>
              <span className="text-sm font-medium text-foreground">{row.amount}</span>
            </div>
          );
        })}
      </div>

      <div className="my-3.5 h-px w-full bg-muted" />

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-foreground">Fee tier</span>
        <span className="text-sm font-medium text-foreground">
          {position.feeLabel}
        </span>
      </div>
    </div>
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
    <div className="inline-flex h-[28px] items-center rounded-full border border-border p-[2px]">
      {[token0, token1].map((token) => {
        const active = value === token;
        return (
          <button
            key={token}
            type="button"
            onClick={() => onChange(token)}
            className={`inline-flex h-[24px] min-w-[72px] items-center justify-center gap-1.5 rounded-[12px] px-2.5 text-xs font-medium transition-colors ${
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

function RangeBoundCard({
  label,
  value,
  unitLabel,
  note,
}: {
  label: string;
  value: string;
  unitLabel: string;
  note: string;
}) {
  return (
    <div className="rounded-[10px] border border-border bg-card px-4 py-4 text-center">
      <p className="text-xs text-foreground">{label}</p>
      <p className="mt-3 truncate text-[24px] font-light leading-none text-foreground tabular-nums sm:text-[32px]">
        {value}
      </p>
      <p className="mt-2 text-xs text-foreground">{unitLabel}</p>
      <p className="mt-3 text-[11px] leading-snug text-muted-foreground/80">{note}</p>
    </div>
  );
}

export { RangeBoundCard };

export function SelectedRangePanel({
  token0,
  token1,
  quoteToken,
  onQuoteTokenChange,
  minPrice,
  maxPrice,
}: {
  token0: SwapTokenSymbol;
  token1: SwapTokenSymbol;
  quoteToken: SwapTokenSymbol;
  onQuoteTokenChange: (token: SwapTokenSymbol) => void;
  minPrice: string;
  maxPrice: string;
}) {
  const baseToken = quoteToken === token0 ? token1 : token0;
  const unitLabel = `${quoteToken} per ${baseToken}`;
  const edgeNote = `Your position will be 100% ${quoteToken} at this price.`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-foreground">Selected Range</h3>
        <QuoteTokenToggle
          token0={token0}
          token1={token1}
          value={quoteToken}
          onChange={onQuoteTokenChange}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <RangeBoundCard
          label="Min Price"
          value={minPrice}
          unitLabel={unitLabel}
          note={edgeNote}
        />
        <RangeBoundCard
          label="Max Price"
          value={maxPrice}
          unitLabel={unitLabel}
          note={edgeNote}
        />
      </div>
    </div>
  );
}
