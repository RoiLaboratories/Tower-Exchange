import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

export const SOLANA_DEVNET_USDC_MINT =
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

export const normalizeSolanaAddress = (address: string) => address.trim();

export const isValidSolanaAddress = (address: string) => {
  try {
    new PublicKey(normalizeSolanaAddress(address));
    return true;
  } catch {
    return false;
  }
};

export const getSolanaUsdcAssociatedTokenAddress = (ownerAddress: string) => {
  const owner = new PublicKey(normalizeSolanaAddress(ownerAddress));
  const mint = new PublicKey(SOLANA_DEVNET_USDC_MINT);

  return getAssociatedTokenAddressSync(mint, owner, false).toBase58();
};