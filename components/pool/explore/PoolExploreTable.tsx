"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import TokenPairIcon from "@/components/pool/TokenPairIcon";
import type { ExplorePoolRow } from "@/lib/pool/types";
import { buildManagePositionPath } from "@/lib/pool/increaseLiquidity";
import { buildNewPositionStep1Path } from "@/lib/pool/newPosition";
import type { SwapTokenSymbol } from "@/lib/swapTokens";

interface PoolExploreTableProps {
  pools: ExplorePoolRow[];
  onCreatePosition?: () => void;
}

export default function PoolExploreTable({
  pools,
  onCreatePosition,
}: PoolExploreTableProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredPools = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return pools;
    }

    return pools.filter(
      (pool) =>
        pool.pair.toLowerCase().includes(query) ||
        pool.token0.toLowerCase().includes(query) ||
        pool.token1.toLowerCase().includes(query),
    );
  }, [pools, searchQuery]);

  return (
    <div className="overflow-hidden rounded-[20px] border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3.5 sm:px-5">
        <button
          type="button"
          onClick={onCreatePosition}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-sm font-bold text-black transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          New
        </button>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search Pools"
            className="h-10 w-full rounded-[10px] border border-border bg-transparent py-2 pl-10 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50"
          />
        </div>
      </div>

      <div className="overflow-x-auto px-3 pb-3 pt-3 sm:px-4">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left">
          <thead>
            <tr className="text-sm font-medium text-muted-foreground">
              <th className="rounded-l-[222px] bg-secondary px-4 py-3 font-medium sm:px-5">
                #
              </th>
              <th className="bg-secondary px-4 py-3 font-medium sm:px-5">
                Pool
              </th>
              <th className="bg-secondary px-4 py-3 font-medium sm:px-5">
                Fee tier
              </th>
              <th className="bg-secondary px-4 py-3 font-medium sm:px-5">
                ↑ TVL
              </th>
              <th className="bg-secondary px-4 py-3 font-medium sm:px-5">
                Pool APR
              </th>
              <th className="bg-secondary px-4 py-3 font-medium sm:px-5">
                1D vol
              </th>
              <th className="bg-secondary px-4 py-3 font-medium sm:px-5">
                30D vol
              </th>
              <th className="rounded-r-[222px] bg-secondary px-4 py-3 font-medium sm:px-5">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredPools.map((pool, index) => (
              <tr key={pool.id}>
                <td className="px-4 py-4 text-sm font-light text-muted-foreground sm:px-5">
                  {index + 1}
                </td>
                <td className="px-4 py-4 sm:px-5">
                  <Link
                    href={`/pool/${pool.id}`}
                    className="inline-flex items-center gap-2.5 transition-opacity hover:opacity-80"
                  >
                    <TokenPairIcon
                      token0={pool.token0}
                      token1={pool.token1}
                      size="md"
                    />
                    <span className="max-w-[140px] truncate text-sm font-light text-foreground sm:max-w-none">
                      {pool.pair}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-4 text-sm font-light text-foreground sm:px-5">
                  {pool.feeTier}
                </td>
                <td className="px-4 py-4 text-sm font-light text-foreground sm:px-5">
                  {pool.tvl}
                </td>
                <td className="px-4 py-4 text-sm font-light text-foreground sm:px-5">
                  {pool.poolApr}
                </td>
                <td className="px-4 py-4 text-sm font-light text-foreground sm:px-5">
                  {pool.volume1d}
                </td>
                <td className="px-4 py-4 text-sm font-light text-foreground sm:px-5">
                  {pool.volume30d}
                </td>
                <td className="px-4 py-4 sm:px-5">
                  {pool.hasPosition ? (
                    <Link
                      href={buildManagePositionPath(pool.positionId ?? pool.id)}
                      className="inline-flex items-center justify-center rounded-full bg-primary/15 px-4 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/25"
                    >
                      Manage
                    </Link>
                  ) : (
                    <Link
                      href={buildNewPositionStep1Path({
                        token0: pool.token0 as SwapTokenSymbol,
                        token1: pool.token1 as SwapTokenSymbol,
                      })}
                      className="inline-flex items-center justify-center gap-1 rounded-full bg-muted px-4 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
