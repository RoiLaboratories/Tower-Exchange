"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import type { PoolPosition, PoolPositionStatus } from "@/lib/pool/types";
import TokenPairIcon from "@/components/pool/TokenPairIcon";

const STATUS_OPTIONS: Array<{
  value: PoolPositionStatus;
  label: string;
  dotClass: string;
}> = [
  {
    value: "in-range",
    label: "In range",
    dotClass: "bg-[#07D54F]",
  },
  {
    value: "out-of-range",
    label: "Out of range",
    dotClass: "bg-[#FF5A5F]",
  },
  {
    value: "closed",
    label: "Closed",
    dotClass: "bg-[#B3B3B3]",
  },
];

const STATUS_LABELS: Record<PoolPositionStatus, string> = {
  "in-range": "In Range",
  "out-of-range": "Out of Range",
  closed: "Closed",
};

const STATUS_STYLES: Record<PoolPositionStatus, string> = {
  "in-range": "text-[#07D54F]",
  "out-of-range": "text-[#FF5A5F]",
  closed: "text-muted-foreground",
};

const PRIMARY_PILL_CLASS =
  "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-sm font-bold text-black transition-colors hover:bg-primary/90";

const DEFAULT_SELECTED_STATUSES: PoolPositionStatus[] = [
  "in-range",
  "out-of-range",
];

interface PoolPositionsTableProps {
  positions: PoolPosition[];
  onManagePosition?: (position: PoolPosition) => void;
  onCreatePosition?: () => void;
}

export default function PoolPositionsTable({
  positions,
  onManagePosition,
  onCreatePosition,
}: PoolPositionsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<PoolPositionStatus[]>(
    DEFAULT_SELECTED_STATUSES,
  );
  const statusMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!statusMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (
        statusMenuRef.current &&
        !statusMenuRef.current.contains(event.target as Node)
      ) {
        setStatusMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [statusMenuOpen]);

  const toggleStatus = (status: PoolPositionStatus) => {
    setSelectedStatuses((current) =>
      current.includes(status)
        ? current.filter((value) => value !== status)
        : [...current, status],
    );
  };

  const filteredPositions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const selected = new Set(selectedStatuses);

    return positions.filter((position) => {
      const matchesQuery =
        !query ||
        position.pool.toLowerCase().includes(query) ||
        position.token0.toLowerCase().includes(query) ||
        position.token1.toLowerCase().includes(query);
      const matchesStatus = selected.has(position.status);

      return matchesQuery && matchesStatus;
    });
  }, [positions, searchQuery, selectedStatuses]);

  return (
    <div className="overflow-hidden rounded-[20px] border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3.5 sm:px-5">
        <button
          type="button"
          onClick={onCreatePosition}
          className={PRIMARY_PILL_CLASS}
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          New
        </button>

        <div className="relative shrink-0" ref={statusMenuRef}>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={statusMenuOpen}
            onClick={() => setStatusMenuOpen((open) => !open)}
            className={`${PRIMARY_PILL_CLASS} min-w-[118px] justify-between`}
          >
            <span>Status</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                statusMenuOpen ? "rotate-180" : ""
              }`}
              strokeWidth={2.5}
            />
          </button>

          {statusMenuOpen ? (
            <div
              role="listbox"
              aria-label="Filter by status"
              className="absolute left-0 top-[calc(100%+8px)] z-30 w-[220px] rounded-[10px] border border-border bg-card px-4 py-3 shadow-lg"
            >
              <ul className="space-y-3">
                {STATUS_OPTIONS.map((option) => {
                  const checked = selectedStatuses.includes(option.value);

                  return (
                    <li key={option.value}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={checked}
                        onClick={() => toggleStatus(option.value)}
                        className="flex w-full items-center gap-2.5 text-left"
                      >
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${option.dotClass}`}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
                          {option.label}
                        </span>
                        <span
                          className={`inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] ${
                            checked
                              ? "bg-primary"
                              : "border border-border bg-transparent"
                          }`}
                          aria-hidden
                        >
                          {checked ? (
                            <Check
                              className="h-3 w-3 text-[#0C0C0D]"
                              strokeWidth={3}
                            />
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="relative min-w-0 flex-1 basis-full sm:min-w-[160px] sm:basis-auto">
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

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-border text-left text-sm font-medium text-muted-foreground">
              <th className="px-4 py-3 font-medium sm:px-5">#</th>
              <th className="px-4 py-3 font-medium sm:px-5">Pool</th>
              <th className="px-4 py-3 font-medium sm:px-5">Liquidity</th>
              <th className="px-4 py-3 font-medium sm:px-5">Fee</th>
              <th className="px-4 py-3 font-medium sm:px-5">Status</th>
              <th className="px-4 py-3 font-medium sm:px-5">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredPositions.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-muted-foreground sm:px-5"
                >
                  No positions match your filters.
                </td>
              </tr>
            ) : (
              filteredPositions.map((position, index) => (
                <tr
                  key={position.id}
                  className="border-b border-border/70 last:border-b-0"
                >
                  <td className="px-4 py-3.5 text-sm font-light text-muted-foreground sm:px-5">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3.5 sm:px-5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <TokenPairIcon
                        token0={position.token0}
                        token1={position.token1}
                      />
                      <span className="truncate text-sm font-light text-foreground">
                        {position.pool}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm font-light text-foreground sm:px-5">
                    {position.liquidity}
                  </td>
                  <td className="px-4 py-3.5 text-sm font-light text-foreground sm:px-5">
                    {position.fee}
                  </td>
                  <td
                    className={`px-4 py-3.5 text-sm font-light sm:px-5 ${STATUS_STYLES[position.status]}`}
                  >
                    {STATUS_LABELS[position.status]}
                  </td>
                  <td className="px-4 py-3.5 sm:px-5">
                    <button
                      type="button"
                      onClick={() => onManagePosition?.(position)}
                      className="inline-flex h-8 items-center justify-center rounded-full bg-[rgba(123,184,255,0.18)] px-4 text-sm font-medium text-primary transition-colors hover:bg-[rgba(123,184,255,0.28)]"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
