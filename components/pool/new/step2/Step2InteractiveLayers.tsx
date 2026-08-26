"use client";

import type { ButtonHTMLAttributes } from "react";
import type { SwapTokenSymbol } from "@/lib/swapTokens";

const DESIGN_WIDTH = 824;

export type ChartTimeframe = "1D" | "1W" | "1M" | "1Y" | "All time";

function pctX(value: number) {
  return `${(value / DESIGN_WIDTH) * 100}%`;
}

function pctY(value: number, height: number) {
  return `${(value / height) * 100}%`;
}

function pctW(value: number) {
  return `${(value / DESIGN_WIDTH) * 100}%`;
}

function pctH(value: number, height: number) {
  return `${(value / height) * 100}%`;
}

function boxStyle(x: number, y: number, w: number, h: number, viewHeight: number) {
  return {
    left: pctX(x),
    top: pctY(y, viewHeight),
    width: pctW(w),
    height: pctH(h, viewHeight),
  };
}

function Hotspot({
  x,
  y,
  w,
  h,
  viewHeight,
  className = "",
  ...props
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  viewHeight: number;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`absolute z-10 cursor-pointer border-0 bg-transparent p-0 ${className}`}
      style={boxStyle(x, y, w, h, viewHeight)}
      {...props}
    />
  );
}

function OverlayField({
  x,
  y,
  w,
  h,
  viewHeight,
  value,
  onChange,
  inputMode = "decimal",
  className = "",
  transparent = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  viewHeight: number;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "decimal" | "numeric";
  className?: string;
  transparent?: boolean;
}) {
  return (
    <input
      type="text"
      inputMode={inputMode}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder=""
      className={`absolute z-10 border-0 text-foreground outline-none caret-white placeholder:text-transparent ${
        transparent ? "bg-transparent" : "bg-secondary"
      } ${className}`}
      style={boxStyle(x, y, w, h, viewHeight)}
    />
  );
}

export type StrategyIndex = 0 | 1 | 2 | 3;

const STRATEGY_BOUNDS: { x: number; w: number }[] = [
  { x: 0, w: 195 },
  { x: 212, w: 195 },
  { x: 424, w: 195 },
  { x: 636, w: 195 },
];

const TIMEFRAME_BOUNDS: { id: ChartTimeframe; x: number; w: number }[] = [
  { id: "1D", x: 38, w: 40 },
  { id: "1W", x: 82, w: 44 },
  { id: "1M", x: 128.5, w: 36 },
  { id: "1Y", x: 180, w: 40 },
  { id: "All time", x: 222, w: 68 },
];

function SelectionPlate({
  x,
  y,
  w,
  h,
  viewHeight,
  className,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  viewHeight: number;
  className: string;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute ${className}`}
      style={boxStyle(x, y, w, h, viewHeight)}
    />
  );
}

export function PriceStrategiesOverlay({
  selectedStrategy,
  onSelectStrategy,
}: {
  selectedStrategy: StrategyIndex;
  onSelectStrategy: (index: StrategyIndex) => void;
}) {
  const height = 151;

  return (
    <>
      {STRATEGY_BOUNDS.map((bounds, index) => {
        const isSelected = selectedStrategy === index;

        return (
          <div key={index}>
            {isSelected && selectedStrategy !== 0 ? (
              <SelectionPlate
                x={bounds.x}
                y={0}
                w={bounds.w}
                h={height}
                viewHeight={height}
                className="rounded-[20px] bg-accent"
              />
            ) : null}
            {index === 0 && selectedStrategy !== 0 ? (
              <SelectionPlate
                x={bounds.x}
                y={0}
                w={bounds.w}
                h={height}
                viewHeight={height}
                className="rounded-[20px] bg-card"
              />
            ) : null}
            <Hotspot
              x={bounds.x}
              y={0}
              w={bounds.w}
              h={height}
              viewHeight={height}
              aria-pressed={isSelected}
              aria-label={`Select strategy ${index + 1}`}
              onClick={() => onSelectStrategy(index as StrategyIndex)}
            />
          </div>
        );
      })}
    </>
  );
}

export function PriceRangeOverlay({
  minPrice,
  maxPrice,
  onMinPriceChange,
  onMaxPriceChange,
  onAdjustMin,
  onAdjustMax,
}: {
  minPrice: string;
  maxPrice: string;
  onMinPriceChange: (value: string) => void;
  onMaxPriceChange: (value: string) => void;
  onAdjustMin: (direction: "up" | "down") => void;
  onAdjustMax: (direction: "up" | "down") => void;
}) {
  const height = 157;

  return (
    <>
      <OverlayField
        x={24}
        y={62}
        w={300}
        h={36}
        viewHeight={height}
        value={minPrice}
        onChange={onMinPriceChange}
        transparent
        className="text-[clamp(1.25rem,3vw,2rem)] font-semibold"
      />
      <OverlayField
        x={441}
        y={62}
        w={300}
        h={36}
        viewHeight={height}
        value={maxPrice}
        onChange={onMaxPriceChange}
        transparent
        className="text-[clamp(1.25rem,3vw,2rem)] font-semibold"
      />
      <Hotspot
        x={347}
        y={37}
        w={30}
        h={30}
        viewHeight={height}
        aria-label="Increase min price"
        onClick={() => onAdjustMin("up")}
      />
      <Hotspot
        x={347}
        y={90}
        w={30}
        h={30}
        viewHeight={height}
        aria-label="Decrease min price"
        onClick={() => onAdjustMin("down")}
      />
      <Hotspot
        x={764}
        y={37}
        w={30}
        h={30}
        viewHeight={height}
        aria-label="Increase max price"
        onClick={() => onAdjustMax("up")}
      />
      <Hotspot
        x={764}
        y={90}
        w={30}
        h={30}
        viewHeight={height}
        aria-label="Decrease max price"
        onClick={() => onAdjustMax("down")}
      />
    </>
  );
}

export function DepositTokensOverlay({
  deposit0,
  deposit1,
  onDeposit0Change,
  onDeposit1Change,
}: {
  deposit0: string;
  deposit1: string;
  onDeposit0Change: (value: string) => void;
  onDeposit1Change: (value: string) => void;
}) {
  const height = 262;

  return (
    <>
      <OverlayField
        x={20}
        y={28}
        w={620}
        h={70}
        viewHeight={height}
        value={deposit0}
        onChange={onDeposit0Change}
        transparent
        className="text-[clamp(1.5rem,4vw,2.25rem)] font-light"
      />
      <OverlayField
        x={20}
        y={164}
        w={620}
        h={70}
        viewHeight={height}
        value={deposit1}
        onChange={onDeposit1Change}
        transparent
        className="text-[clamp(1.5rem,4vw,2.25rem)] font-light"
      />
    </>
  );
}

export function TokenApprovalOverlay({
  token0,
  token1,
  approved0,
  approved1,
  onApprove0,
  onApprove1,
}: {
  token0: SwapTokenSymbol;
  token1: SwapTokenSymbol;
  approved0: boolean;
  approved1: boolean;
  onApprove0: () => void;
  onApprove1: () => void;
}) {
  const height = 182;

  return (
    <>
      <Hotspot
        x={0}
        y={128}
        w={407}
        h={54}
        viewHeight={height}
        aria-label={approved0 ? `${token0} approved` : `Approve ${token0}`}
        disabled={approved0}
        onClick={onApprove0}
        className={approved0 ? "cursor-default" : "hover:opacity-90"}
      />
      <Hotspot
        x={417}
        y={128}
        w={407}
        h={54}
        viewHeight={height}
        aria-label={approved1 ? `${token1} approved` : `Approve ${token1}`}
        disabled={approved1}
        onClick={onApprove1}
        className={approved1 ? "cursor-default" : "hover:opacity-90"}
      />
    </>
  );
}

export function PriceChartOverlay({
  token0,
  token1,
  quoteToken,
  onQuoteTokenChange,
  selectedTimeframe,
  onTimeframeChange,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  token0: SwapTokenSymbol;
  token1: SwapTokenSymbol;
  quoteToken: SwapTokenSymbol;
  onQuoteTokenChange: (token: SwapTokenSymbol) => void;
  selectedTimeframe: ChartTimeframe;
  onTimeframeChange: (timeframe: ChartTimeframe) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  const height = 438;
  const timeframeY = 376;
  const timeframeH = 28;
  const activeTimeframe = TIMEFRAME_BOUNDS.find(
    (item) => item.id === selectedTimeframe,
  );

  return (
    <>
      <Hotspot
        x={605}
        y={34}
        w={84}
        h={28}
        viewHeight={height}
        aria-pressed={quoteToken === token0}
        aria-label={`Quote ${token0}`}
        onClick={() => onQuoteTokenChange(token0)}
      />
      <Hotspot
        x={689}
        y={34}
        w={84}
        h={28}
        viewHeight={height}
        aria-pressed={quoteToken === token1}
        aria-label={`Quote ${token1}`}
        onClick={() => onQuoteTokenChange(token1)}
      />

      {selectedTimeframe !== "1M" ? (
        <SelectionPlate
          x={128.5}
          y={timeframeY}
          w={36}
          h={timeframeH}
          viewHeight={height}
          className="rounded-[14px] bg-secondary"
        />
      ) : null}

      {activeTimeframe && selectedTimeframe !== "1M" ? (
        <SelectionPlate
          x={activeTimeframe.x}
          y={timeframeY}
          w={activeTimeframe.w}
          h={timeframeH}
          viewHeight={height}
          className="rounded-[14px] bg-accent"
        />
      ) : null}

      {TIMEFRAME_BOUNDS.map((timeframe) => (
        <Hotspot
          key={timeframe.id}
          x={timeframe.x}
          y={timeframeY}
          w={timeframe.w}
          h={timeframeH}
          viewHeight={height}
          aria-pressed={selectedTimeframe === timeframe.id}
          aria-label={`${timeframe.id} timeframe`}
          onClick={() => onTimeframeChange(timeframe.id)}
        />
      ))}

      <Hotspot
        x={318}
        y={372}
        w={48}
        h={36}
        viewHeight={height}
        aria-label="Zoom out"
        onClick={onZoomOut}
      />
      <Hotspot
        x={378}
        y={372}
        w={48}
        h={36}
        viewHeight={height}
        aria-label="Zoom in"
        onClick={onZoomIn}
      />
      <Hotspot
        x={727}
        y={371}
        w={67}
        h={37}
        viewHeight={height}
        aria-label="Reset chart"
        onClick={onReset}
      />
    </>
  );
}
