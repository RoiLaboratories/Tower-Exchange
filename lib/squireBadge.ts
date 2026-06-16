"use client";

export const SQUIRE_BADGE_ID = "squire" as const;

export type SquireBadgeStatus = {
  walletAddress: string;
  badgeId: typeof SQUIRE_BADGE_ID;
  volumeUsd: number;
  bridgeCount: number;
  swapCount: number;
  recurringOrdersCount: number;
  aiMessagesSentCount: number;
  criteriaMetCount: number;
  isEligible: boolean;
  isClaimed: boolean;
};

export type SquireBadgeApiResponse = {
  success?: boolean;
  message?: string;
  debug?: string;
  badge?: SquireBadgeStatus;
};

export const getBadgeErrorLabel = (
  message?: string | null,
  debug?: string | null,
) => {
  const normalized = debug?.trim() || message?.trim();

  if (!normalized) {
    return "Unable to update badge.";
  }

  return normalized.length <= 96 ? normalized : "Unable to update badge.";
};

export const fetchSquireBadgeStatus = async (walletAddress: string) => {
  const response = await fetch(
    `/api/badges/squire?walletAddress=${encodeURIComponent(walletAddress)}`,
    { cache: "no-store" },
  );
  const result = (await response.json()) as SquireBadgeApiResponse;

  return { response, result };
};

export const claimSquireBadge = async (walletAddress: string) => {
  const response = await fetch("/api/badges/squire", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      walletAddress,
    }),
  });
  const result = (await response.json()) as SquireBadgeApiResponse;

  return { response, result };
};
