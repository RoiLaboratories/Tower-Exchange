"use client";

import { useCallback, useEffect, useState } from "react";
import { userApiFetch } from "@/lib/userApi";
import type { PoolPosition, PoolSummary } from "@/lib/pool/types";

interface PoolPositionsResponse {
  positions: PoolPosition[];
  summary: PoolSummary | null;
}

interface UsePoolPositionsResult {
  positions: PoolPosition[];
  summary: PoolSummary | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePoolPositions(
  walletAddress?: string | null,
): UsePoolPositionsResult {
  const [positions, setPositions] = useState<PoolPosition[]>([]);
  const [summary, setSummary] = useState<PoolSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    if (!walletAddress) {
      setPositions([]);
      setSummary(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ wallet: walletAddress });

      if (
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("demo") === "positions"
      ) {
        params.set("demo", "positions");
      }

      const result = await userApiFetch<PoolPositionsResponse>(
        `/api/pool/positions?${params.toString()}`,
        { walletAddress },
      );

      if (!result.ok) {
        throw new Error(result.error || "Failed to load pool positions");
      }

      const data = result.data;
      setPositions(data?.positions ?? []);
      setSummary(data?.summary ?? null);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load pool positions";
      setError(message);
      setPositions([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    void fetchPositions();
  }, [fetchPositions]);

  return {
    positions,
    summary,
    loading,
    error,
    refetch: fetchPositions,
  };
}

export default usePoolPositions;