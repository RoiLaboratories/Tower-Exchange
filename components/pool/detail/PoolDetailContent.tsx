"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpDown, ChevronRight, Copy } from "lucide-react";
import TokenPairIcon from "@/components/pool/TokenPairIcon";
import arcBadge from "@/public/assets/ARCSvg.svg";
import fullscreenIcon from "@/public/assets/fullscreen_icon.svg";
import type { PoolDetail } from "@/lib/pool/types";
import { buildNewPositionStep1Path } from "@/lib/pool/newPosition";
import { buildSwapPath, type SwapTokenSymbol } from "@/lib/swapTokens";

type ChartTimeframe = "1D" | "1W" | "1M" | "1Y" | "All time";

interface PoolDetailContentProps {
  pool: PoolDetail;
}

function MockPriceChart() {
  return (
    <svg
      viewBox="0 0 640 220"
      className="h-full w-full"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d="M0 170 C40 165, 70 150, 100 145 C140 138, 170 155, 210 120 C250 85, 290 95, 330 75 C370 55, 410 90, 450 70 C490 50, 530 40, 570 55 C600 65, 620 45, 640 35"
        fill="none"
        stroke="#7BB8FF"
        strokeWidth="2.5"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M0 170 C40 165, 70 150, 100 145 C140 138, 170 155, 210 120 C250 85, 290 95, 330 75 C370 55, 410 90, 450 70 C490 50, 530 40, 570 55 C600 65, 620 45, 640 35 L640 220 L0 220 Z"
        fill="url(#poolChartFill)"
        opacity="0.25"
      />
      <defs>
        <linearGradient id="poolChartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7BB8FF" />
          <stop offset="100%" stopColor="#7BB8FF" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function PoolDetailContent({ pool }: PoolDetailContentProps) {
  const router = useRouter();
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("All time");
  const [copied, setCopied] = useState(false);

  const timeframes: ChartTimeframe[] = ["1D", "1W", "1M", "1Y", "All time"];

  const createPath = useMemo(
    () =>
      buildNewPositionStep1Path({
        token0: pool.token0 as SwapTokenSymbol,
        token1: pool.token1 as SwapTokenSymbol,
      }),
    [pool.token0, pool.token1],
  );

  const swapPath = useMemo(
    () =>
      buildSwapPath({
        from: pool.token0,
        to: pool.token1,
      }),
    [pool.token0, pool.token1],
  );

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(pool.address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/pool" className="transition-colors hover:text-foreground">
          Pool
        </Link>
        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
        <span className="text-foreground">{pool.pair}</span>
      </div>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="rounded-2xl border border-border/60 bg-card px-4 py-3.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <TokenPairIcon
                token0={pool.token0}
                token1={pool.token1}
                size="md"
              />
              <span className="text-base font-medium text-foreground">
                {pool.pair}
              </span>
              <span className="rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-light text-muted-foreground">
                {pool.feeTier}
              </span>
              <button
                type="button"
                aria-label="Flip pair display"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={handleCopyAddress}
              className="mt-2 inline-flex max-w-full items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <span className="max-w-[180px] truncate sm:max-w-[280px] md:max-w-none">
                {pool.address}
              </span>
              {copied ? (
                <span className="text-foreground">Copied</span>
              ) : (
                <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden />
              )}
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl bg-card">
            <div className="flex items-start justify-between gap-3 px-5 pt-5">
              <div>
                <p className="text-sm font-medium text-foreground">Price</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {pool.pastDayVolume}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">Past Day</p>
              </div>
            </div>

            <div className="relative mx-5 mt-4 mb-5 flex min-h-[380px] flex-col overflow-hidden rounded-[30px] bg-muted">
              <div className="px-5 pt-4">
                <p className="text-xs text-muted-foreground">
                  Current price{" "}
                  <span className="text-foreground">{pool.priceLabel}</span>{" "}
                  <span className="text-muted-foreground">({pool.priceUsdLabel})</span>
                </p>
              </div>

              <div className="min-h-0 flex-1 px-2 pt-2">
                <MockPriceChart />
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2 px-3 pb-5 pt-3 sm:gap-3 sm:px-5">
                <div className="inline-flex h-[28px] max-w-full flex-wrap items-center gap-1 rounded-full border border-border px-1.5">
                  {timeframes.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setTimeframe(item)}
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
                    aria-label="Zoom out"
                    className="inline-flex flex-1 items-center justify-center text-foreground hover:text-foreground"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M4.5 7H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                  <span
                    className="w-px self-center bg-muted"
                    style={{ height: 22 }}
                    aria-hidden
                  />
                  <button
                    type="button"
                    aria-label="Fullscreen"
                    className="inline-flex flex-1 items-center justify-center text-foreground hover:text-foreground"
                  >
                    <Image
                      src={fullscreenIcon}
                      alt=""
                      width={13}
                      height={13}
                      aria-hidden
                    />
                  </button>
                  <span
                    className="w-px self-center bg-muted"
                    style={{ height: 22 }}
                    aria-hidden
                  />
                  <button
                    type="button"
                    aria-label="Zoom in"
                    className="inline-flex flex-1 items-center justify-center text-foreground hover:text-foreground"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M4.5 7H9.5M7 4.5V9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl bg-card">
            <div className="border-b border-border px-5 py-4">
              <h3 className="text-sm font-medium text-foreground">Transactions</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Time</th>
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-5 py-3 font-medium">USD</th>
                    <th className="px-5 py-3 font-medium">{pool.token0}</th>
                    <th className="px-5 py-3 font-medium">{pool.token1}</th>
                    <th className="px-5 py-3 font-medium">Wallet</th>
                  </tr>
                </thead>
                <tbody>
                  {pool.transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="border-b border-border/60 last:border-b-0"
                    >
                      <td className="px-5 py-3.5 text-sm text-muted-foreground">
                        {tx.time}
                      </td>
                      <td
                        className={`px-5 py-3.5 text-sm font-medium ${
                          tx.type === "Add" ? "text-[#4ADE80]" : "text-[#F87171]"
                        }`}
                      >
                        {tx.type}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground">
                        {tx.usd}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground">
                        {tx.amount0}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground">
                        {tx.amount1}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground">
                        {tx.wallet}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-4 xl:w-[360px]">
          <div className="rounded-2xl bg-card p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push(swapPath)}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-full bg-primary/21 px-4 text-xs font-medium text-primary transition-colors hover:bg-primary/30"
              >
                Swap
              </button>
              <button
                type="button"
                onClick={() => router.push(createPath)}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-full bg-primary/21 px-4 text-xs font-medium text-primary transition-colors hover:bg-primary/30"
              >
                Add Liquidity
              </button>
            </div>

            <div className="mt-5">
              <h3 className="text-sm font-medium text-foreground">Stats</h3>

              <p className="mt-4 text-xs text-muted-foreground">Pool balance</p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">{pool.balance0}</div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${pool.balance0Share}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">{pool.balance1}</div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${pool.balance1Share}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">Total APR</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">
                    {pool.totalApr}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">TVL</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{pool.tvl}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">24H Volume</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {pool.volume24h}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">24H Fees</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {pool.fees24h}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-card p-4 sm:p-5">
            <h3 className="text-sm font-medium text-foreground">Links</h3>
            <ul className="mt-4 space-y-3">
              {pool.links.map((link) => (
                <li key={link.id}>
                  <Link
                    href={`/pool/${link.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-3 transition-colors hover:border-[#3a3a3a]"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <TokenPairIcon
                        token0={link.token0}
                        token1={link.token1}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-foreground">
                          {link.pair}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {link.address}
                        </p>
                      </div>
                    </div>
                    <Image
                      src={arcBadge}
                      alt=""
                      width={18}
                      height={18}
                      className="h-[18px] w-[18px] shrink-0 rounded-full"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
