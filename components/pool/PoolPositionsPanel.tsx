"use client";

import { useState } from "react";
import { Plus, Search } from "lucide-react";
import ThemeAwareImage from "@/components/ThemeAwareImage";

export type PoolPositionsView = "disconnected" | "empty" | "loading";

interface PoolPositionsPanelProps {
  view: PoolPositionsView;
  onExplorePools?: () => void;
  onCreatePosition?: () => void;
  compact?: boolean;
}

function EmptyStateIcon({ compact }: { compact: boolean }) {
  const size = compact ? 80 : 88;

  return (
    <ThemeAwareImage
      darkSrc="/assets/empty state icon.svg"
      lightSrc="/assets/empty-state-icon-light.svg"
      alt=""
      width={size}
      height={size}
      className={`opacity-90 ${compact ? "mb-5 h-20 w-20" : "mb-5 h-[88px] w-[88px]"}`}
    />
  );
}

export default function PoolPositionsPanel({
  view,
  onExplorePools,
  onCreatePosition,
  compact = false,
}: PoolPositionsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const cardClass = "rounded-2xl border border-border/70 bg-card/60";

  if (view === "loading") {
    return (
      <div className={`${cardClass} px-4 py-12 sm:px-5`}>
        <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading your positions...</p>
        </div>
      </div>
    );
  }

  if (view === "disconnected") {
    return (
      <div
        className={`${cardClass} px-4 ${
          compact ? "py-12 sm:px-5 sm:py-14" : "py-14 sm:px-5 sm:py-16"
        }`}
      >
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <EmptyStateIcon compact={compact} />
          <h3
            className={`font-semibold text-foreground ${
              compact ? "text-lg" : "text-xl"
            }`}
          >
            No wallet Connected
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            To view your position and rewards you must connect your wallet
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cardClass}>
      <div
        className={`flex items-center gap-3 border-b border-border/60 px-4 py-4 sm:px-5`}
      >
        <button
          type="button"
          onClick={onCreatePosition}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-black transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New
        </button>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search Pools"
            className="w-full rounded-full border border-border bg-secondary/50 py-2 pl-9 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50"
          />
        </div>
      </div>

      <div
        className={`flex flex-col items-center px-4 text-center sm:px-5 ${
          compact ? "py-12 sm:py-14" : "py-14 sm:py-16"
        }`}
      >
        <EmptyStateIcon compact={compact} />
        <h3
          className={`font-semibold text-foreground ${
            compact ? "text-lg" : "text-xl"
          }`}
        >
          No Positions
        </h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          You don&apos;t have any liquidity positions. Create a new position to
          start earning on eligible pools.
        </p>
        <button
          type="button"
          onClick={onExplorePools}
          className={`inline-flex items-center justify-center rounded-full bg-primary font-bold text-black transition-colors hover:bg-primary/90 ${
            compact ? "mt-5 px-6 py-2.5 text-sm" : "mt-6 px-6 py-2.5 text-sm"
          }`}
        >
          Explore pools
        </button>
      </div>
    </div>
  );
}
