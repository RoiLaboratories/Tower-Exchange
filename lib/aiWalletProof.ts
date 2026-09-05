"use client";

import { signBrowserWalletMessage } from "@/lib/browser-wallet";

export type AiWalletProof = {
  address: string;
  signature: string;
  timestamp: string;
};

const STORAGE_KEY_PREFIX = "tower-ai-wallet-proof:";
/** Resign before the backend's 24h window so in-flight chat calls don't expire. */
const MAX_PROOF_AGE_MS = 23 * 60 * 60 * 1000;

let memoryProof: AiWalletProof | null = null;
let inFlightProof: Promise<AiWalletProof | null> | null = null;
const declinedAddresses = new Set<string>();

export function canonicalizeAiWalletAddress(walletAddress: string) {
  return walletAddress.trim().toLowerCase();
}

export function buildAiWalletAuthorizationMessage(
  walletAddress: string,
  timestamp: string,
) {
  return `Tower Exchange: authorize wallet actions for ${walletAddress}\nTimestamp: ${timestamp}`;
}

const storageKey = (address: string) => `${STORAGE_KEY_PREFIX}${address}`;

const isFreshProof = (proof: AiWalletProof, address: string) => {
  if (proof.address !== address || !proof.signature || !proof.timestamp) {
    return false;
  }

  const signedAt = Date.parse(proof.timestamp);
  if (!Number.isFinite(signedAt)) {
    return false;
  }

  return Date.now() - signedAt < MAX_PROOF_AGE_MS;
};

const readStoredProof = (address: string): AiWalletProof | null => {
  if (memoryProof && isFreshProof(memoryProof, address)) {
    return memoryProof;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey(address));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<AiWalletProof>;
    if (
      typeof parsed.address !== "string" ||
      typeof parsed.signature !== "string" ||
      typeof parsed.timestamp !== "string"
    ) {
      return null;
    }

    const proof: AiWalletProof = {
      address: parsed.address,
      signature: parsed.signature,
      timestamp: parsed.timestamp,
    };

    if (!isFreshProof(proof, address)) {
      window.localStorage.removeItem(storageKey(address));
      return null;
    }

    memoryProof = proof;
    return proof;
  } catch {
    return null;
  }
};

const persistProof = (proof: AiWalletProof) => {
  memoryProof = proof;
  declinedAddresses.delete(proof.address);

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey(proof.address), JSON.stringify(proof));
  } catch {
    // Private mode / quota — memory cache still covers this tab.
  }
};

export function clearAiWalletProof(walletAddress?: string) {
  const address = walletAddress
    ? canonicalizeAiWalletAddress(walletAddress)
    : memoryProof?.address;

  memoryProof = null;
  inFlightProof = null;

  if (address) {
    declinedAddresses.delete(address);
  } else {
    declinedAddresses.clear();
  }

  if (address && typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(storageKey(address));
    } catch {
      // ignore
    }
  }
}

async function createAiWalletProof(address: string): Promise<AiWalletProof> {
  const timestamp = new Date().toISOString();
  const message = buildAiWalletAuthorizationMessage(address, timestamp);
  const signature = await signBrowserWalletMessage(message, address);

  const proof: AiWalletProof = {
    address,
    signature,
    timestamp,
  };
  persistProof(proof);
  return proof;
}

/**
 * Gasless personal_sign proving the connected wallet. Cached for ~23h per address.
 * Returns null if the user declines so normal chat can still proceed.
 */
export async function ensureAiWalletProof(
  walletAddress: string,
): Promise<AiWalletProof | null> {
  const address = canonicalizeAiWalletAddress(walletAddress);
  if (!address) {
    return null;
  }

  const cached = readStoredProof(address);
  if (cached) {
    return cached;
  }

  if (declinedAddresses.has(address)) {
    return null;
  }

  if (!inFlightProof) {
    inFlightProof = createAiWalletProof(address)
      .catch((error) => {
        declinedAddresses.add(address);
        console.warn("AI wallet authorization signature unavailable:", error);
        return null;
      })
      .finally(() => {
        inFlightProof = null;
      });
  }

  return inFlightProof;
}
