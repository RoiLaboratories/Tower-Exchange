import squireBadgeClaimAllowlist from "@/data/squire-badge-claim-allowlist.json";

const normalizeWalletAddress = (walletAddress: string) =>
  walletAddress.trim().toLowerCase();

const cachedAllowlist = new Set(
  squireBadgeClaimAllowlist
    .map((walletAddress) => normalizeWalletAddress(walletAddress))
    .filter(Boolean),
);

export const hasSquireBadgeClaimAllowlist = () =>
  cachedAllowlist.size > 0;

export const isSquireBadgeClaimAllowlisted = (walletAddress: string) =>
  cachedAllowlist.has(normalizeWalletAddress(walletAddress));
