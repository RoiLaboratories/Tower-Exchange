import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";

import type { SolanaWalletProvider } from "@/lib/solanaWalletStore";

export const SOLANA_DEVNET_USDC_MINT =
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

const SOLANA_DEVNET_RPC_URL = "https://api.devnet.solana.com";
const SOLANA_RPC_PROXY_PATH = "/api/rpc/solana";
const SOLANA_COMMITMENT = "confirmed" as const;

const getSolanaRpcUrl = () => {
  if (typeof window === "undefined") {
    return SOLANA_DEVNET_RPC_URL;
  }

  return new URL(SOLANA_RPC_PROXY_PATH, window.location.origin).toString();
};

const getSolanaConnection = (rpcUrl?: string) =>
  new Connection(rpcUrl || getSolanaRpcUrl(), SOLANA_COMMITMENT);

const normalizeSolanaAddress = (address: string) => address.trim();

export const getSolanaUsdcAssociatedTokenAddress = (ownerAddress: string) => {
  const owner = new PublicKey(normalizeSolanaAddress(ownerAddress));
  const mint = new PublicKey(SOLANA_DEVNET_USDC_MINT);

  return getAssociatedTokenAddressSync(mint, owner, false).toBase58();
};

export const getSolanaUsdcRecipientAccountStatus = async (
  ownerAddress: string,
  rpcUrl?: string,
) => {
  const ataAddress = getSolanaUsdcAssociatedTokenAddress(ownerAddress);
  const connection = getSolanaConnection(rpcUrl);
  const accountInfo = await connection.getAccountInfo(
    new PublicKey(ataAddress),
    SOLANA_COMMITMENT,
  );

  return {
    ataAddress,
    exists: Boolean(accountInfo),
  };
};

const createSolanaUsdcAssociatedTokenAccount = async (
  ownerAddress: string,
  provider: SolanaWalletProvider,
  rpcUrl?: string,
) => {
  const normalizedOwnerAddress = normalizeSolanaAddress(ownerAddress);
  const connection = getSolanaConnection(rpcUrl);
  const payer = new PublicKey(normalizedOwnerAddress);
  const mint = new PublicKey(SOLANA_DEVNET_USDC_MINT);
  const ataAddress = getAssociatedTokenAddressSync(mint, payer, false);

  const existingAccount = await connection.getAccountInfo(
    ataAddress,
    SOLANA_COMMITMENT,
  );
  if (existingAccount) {
    return ataAddress.toBase58();
  }

  const transaction = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      payer,
      ataAddress,
      payer,
      mint,
    ),
  );

  transaction.feePayer = payer;

  const latestBlockhash = await connection.getLatestBlockhash(SOLANA_COMMITMENT);
  transaction.recentBlockhash = latestBlockhash.blockhash;

  const signedTransaction = (await provider.signTransaction(
    transaction,
  )) as Transaction;

  if (!signedTransaction || typeof signedTransaction.serialize !== "function") {
    throw new Error(
      "The connected Solana wallet could not sign the USDC account initialization transaction.",
    );
  }

  const signature = await connection.sendRawTransaction(
    signedTransaction.serialize(),
    {
      skipPreflight: false,
      maxRetries: 3,
    },
  );

  await connection.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    SOLANA_COMMITMENT,
  );

  return ataAddress.toBase58();
};

export type SolanaUsdcRecipientReadyResult = {
  ready: boolean;
  ataAddress: string;
  initialized: boolean;
  requiresWalletConnection?: boolean;
  requiresMatchingWallet?: boolean;
  error?: string;
};

export const ensureSolanaUsdcRecipientReady = async ({
  recipientAddress,
  connectedWalletAddress,
  provider,
  rpcUrl,
}: {
  recipientAddress: string;
  connectedWalletAddress?: string | null;
  provider?: SolanaWalletProvider | null;
  rpcUrl?: string;
}): Promise<SolanaUsdcRecipientReadyResult> => {
  const normalizedRecipientAddress = normalizeSolanaAddress(recipientAddress);
  const normalizedConnectedWalletAddress = connectedWalletAddress
    ? normalizeSolanaAddress(connectedWalletAddress)
    : "";

  const { ataAddress, exists } = await getSolanaUsdcRecipientAccountStatus(
    normalizedRecipientAddress,
    rpcUrl,
  );

  if (exists) {
    return {
      ready: true,
      ataAddress,
      initialized: false,
    };
  }

  if (!provider || !normalizedConnectedWalletAddress) {
    return {
      ready: false,
      ataAddress,
      initialized: false,
      requiresWalletConnection: true,
      error:
        "This Solana address is not ready to receive devnet USDC yet. Connect that Solana wallet once to initialize its USDC token account, then retry the bridge.",
    };
  }

  if (normalizedConnectedWalletAddress !== normalizedRecipientAddress) {
    return {
      ready: false,
      ataAddress,
      initialized: false,
      requiresMatchingWallet: true,
      error:
        "This Solana address is not ready to receive devnet USDC yet. Connect the recipient Solana wallet to initialize its USDC token account, then retry the bridge.",
    };
  }

  try {
    await createSolanaUsdcAssociatedTokenAccount(
      normalizedRecipientAddress,
      provider,
      rpcUrl,
    );

    return {
      ready: true,
      ataAddress,
      initialized: true,
    };
  } catch (error) {
    const postInitStatus = await getSolanaUsdcRecipientAccountStatus(
      normalizedRecipientAddress,
      rpcUrl,
    );

    if (postInitStatus.exists) {
      return {
        ready: true,
        ataAddress: postInitStatus.ataAddress,
        initialized: true,
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    const normalizedMessage = message.toLowerCase();

    if (
      normalizedMessage.includes("insufficient") ||
      normalizedMessage.includes("lamport") ||
      normalizedMessage.includes("fee")
    ) {
      return {
        ready: false,
        ataAddress,
        initialized: false,
        error:
          "The recipient Solana wallet needs a small amount of devnet SOL to initialize its USDC token account before it can receive bridged USDC.",
      };
    }

    return {
      ready: false,
      ataAddress,
      initialized: false,
      error:
        message ||
        "Unable to initialize the recipient Solana USDC token account right now. Please try again.",
    };
  }
};
