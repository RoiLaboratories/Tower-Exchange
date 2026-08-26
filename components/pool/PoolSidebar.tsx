"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { LIQUIDITY_FAQ, TOP_POOLS_BY_TVL } from "@/lib/pool/data";
import TokenPairIcon from "@/components/pool/TokenPairIcon";

interface PoolSidebarProps {
  onAccessMorePools?: () => void;
  compact?: boolean;
}

export default function PoolSidebar({
  onAccessMorePools,
  compact = false,
}: PoolSidebarProps) {
  const [learnMoreOpen, setLearnMoreOpen] = useState(false);
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);

  const toggleFaq = (id: string) => {
    setOpenFaqId((current) => (current === id ? null : id));
  };

  return (
    <aside
      className={`flex w-full flex-col xl:shrink-0 ${
        compact
          ? "gap-4 xl:w-[min(100%,400px)]"
          : "gap-4 xl:w-[min(100%,481px)]"
      }`}
    >
      <div
        className={`bg-card ${
          compact ? "rounded-[1.5rem] p-5 sm:p-6" : "rounded-[1.875rem] p-6 sm:p-7"
        }`}
      >
        <h3 className="text-base font-semibold text-foreground">Tower pool pairs</h3>

        <ul className={compact ? "mt-5 space-y-4" : "mt-6 space-y-[26px]"}>
          {TOP_POOLS_BY_TVL.map((pool) => (
            <li key={pool.id}>
              <Link
                href={`/pool/${pool.id}`}
                className={`flex items-center justify-between gap-4 border border-border transition-colors hover:border-[#3a3a3a] ${
                  compact
                    ? "h-[70px] rounded-[18px] px-4"
                    : "h-[76px] rounded-[19.5px] px-5"
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <TokenPairIcon
                    token0={pool.token0}
                    token1={pool.token1}
                    size="md"
                  />
                  <span className="truncate text-sm font-medium text-foreground">
                    {pool.pair}
                  </span>
                </div>
                <span className="shrink-0 text-sm font-light tabular-nums text-foreground">
                  {pool.metricLabel}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onAccessMorePools}
          className={`inline-flex items-center gap-2 font-medium text-foreground transition-opacity hover:opacity-80 ${
            compact ? "mt-5 text-sm" : "mt-6 text-sm"
          }`}
        >
          Explore all pools
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div
        className={`bg-card ${
          compact ? "rounded-[1.5rem]" : "rounded-[1.875rem]"
        }`}
      >
        <button
          type="button"
          onClick={() => setLearnMoreOpen((open) => !open)}
          className={`flex w-full items-center justify-between gap-3 text-left ${
            compact ? "px-5 py-4 sm:px-6" : "px-6 py-4 sm:px-7"
          }`}
        >
          <span className="min-w-0 text-sm font-medium leading-snug text-foreground">
            Learn more about Liquidity provision
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-foreground transition-transform ${
              learnMoreOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {learnMoreOpen ? (
          <div
            className={`space-y-4 ${
              compact ? "px-5 pb-5 sm:px-6" : "px-6 pb-5 sm:px-7 sm:pb-6"
            }`}
          >
            {LIQUIDITY_FAQ.map((item, index) => {
              const isOpen = openFaqId === item.id;

              return (
                <div key={item.id}>
                  <button
                    type="button"
                    onClick={() => toggleFaq(item.id)}
                    className="flex w-full items-start justify-between gap-4 text-left"
                  >
                    <span className="text-sm leading-snug text-foreground">
                      {index + 1}. {item.question}
                    </span>
                    <ChevronDown
                      className={`mt-0.5 h-4 w-4 shrink-0 text-foreground transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen ? (
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {item.answer}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
