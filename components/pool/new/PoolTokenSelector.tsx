"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import arcBadge from "@/public/assets/ARCSvg.svg";
import type { SwapToken } from "@/lib/swapTokens";

interface PoolTokenSelectorProps {
  selected: SwapToken | null;
  onSelect: (token: SwapToken) => void;
  options: SwapToken[];
  placeholder?: string;
  compact?: boolean;
}

function TokenIconWithArcBadge({
  token,
  compact,
}: {
  token: SwapToken;
  compact: boolean;
}) {
  const outer = compact ? 28 : 32;
  const badge = compact ? 11 : 12;

  return (
    <span
      className="relative inline-flex shrink-0"
      style={{ width: outer, height: outer }}
    >
      <span
        className="inline-flex items-center justify-center overflow-hidden rounded-full bg-card"
        style={{ width: outer, height: outer }}
      >
        <Image
          src={token.icon}
          alt={token.symbol}
          width={outer}
          height={outer}
          className="h-full w-full object-contain"
        />
      </span>
      <span
        className="absolute inline-flex items-center justify-center overflow-hidden rounded-full border border-[#191A1C] bg-card"
        style={{
          width: badge,
          height: badge,
          right: -1,
          bottom: -1,
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

export default function PoolTokenSelector({
  selected,
  onSelect,
  options,
  placeholder = "Choose token",
  compact = false,
}: PoolTokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const iconSize = compact ? 28 : 32;
  const iconClass = compact ? "h-7 w-7" : "h-8 w-8";

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className={`flex w-full items-center justify-between gap-2.5 border border-border bg-card px-3.5 text-left transition-colors hover:border-[#3a3a3a] ${
          compact ? "h-11 rounded-[10px]" : "h-14 rounded-[10px] px-4"
        }`}
      >
        {selected ? (
          <span className="flex min-w-0 items-center gap-2.5">
            <TokenIconWithArcBadge token={selected} compact={compact} />
            <span
              className={`truncate font-medium text-foreground ${
                compact ? "text-xs sm:text-sm" : "text-sm"
              }`}
            >
              {selected.symbol}
            </span>
          </span>
        ) : (
          <span className={compact ? "text-xs text-muted-foreground" : "text-sm text-muted-foreground"}>
            {placeholder}
          </span>
        )}
        <ChevronDown
          className={`shrink-0 text-foreground transition-transform ${
            compact ? "h-3.5 w-3.5" : "h-4 w-4"
          } ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen ? (
        <div
          className={`absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-60 overflow-y-auto rounded-[10px] border border-border bg-card py-1 shadow-xl`}
        >
          {options.map((token) => (
            <button
              key={token.symbol}
              type="button"
              onClick={() => {
                onSelect(token);
                setIsOpen(false);
              }}
              className={`flex w-full items-center gap-2.5 text-left transition-colors hover:bg-white/[0.04] ${
                compact ? "px-3.5 py-2.5" : "gap-3 px-4 py-3"
              }`}
            >
              <span
                className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-card ${iconClass}`}
              >
                <Image
                  src={token.icon}
                  alt={token.symbol}
                  width={iconSize}
                  height={iconSize}
                  className={`${iconClass} object-contain`}
                />
              </span>
              <span
                className={`font-medium text-foreground ${
                  compact ? "text-xs sm:text-sm" : "text-sm"
                }`}
              >
                {token.symbol}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
