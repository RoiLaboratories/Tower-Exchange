import { NextRequest, NextResponse } from "next/server";
import { createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";

import {
  getSolanaUsdcAssociatedTokenAddress,
  isValidSolanaAddress,
  normalizeSolanaAddress,
  SOLANA_DEVNET_USDC_MINT,
} from "@/lib/solanaUsdcAccounts";

export const dynamic = "force-dynamic";

const SOLANA_COMMITMENT = "confirmed" as const;
const SOLANA_DEFAULT_RPC_URL = "https://api.devnet.solana.com";

const getSolanaRpcUrl = () =>
  process.env.SOLANA_DEVNET_RPC_URL ||
  process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL ||
  process.env.SOLANA_RPC_URL ||
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  SOLANA_DEFAULT_RPC_URL;

const parseSponsorSecretKey = (rawValue: string) => {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    throw new Error("Solana ATA sponsor key is empty.");
  }

  if (trimmed.startsWith("[")) {
    return Uint8Array.from(JSON.parse(trimmed) as number[]);
  }

  if (trimmed.includes(",")) {
    return Uint8Array.from(
      trimmed.split(",").map((value) => {
        const parsed = Number.parseInt(value.trim(), 10);
        if (!Number.isFinite(parsed)) {
          throw new Error("Invalid Solana ATA sponsor key byte.");
        }
        return parsed;
      }),
    );
  }

  return Uint8Array.from(Buffer.from(trimmed, "base64"));
};

const getSponsorKeypair = () => {
  const secretKey =
    process.env.SOLANA_ATA_SPONSOR_SECRET_KEY ||
    process.env.SOLANA_DEVNET_ATA_SPONSOR_SECRET_KEY ||
    "";

  if (!secretKey.trim()) {
    return null;
  }

  try {
    return Keypair.fromSecretKey(parseSponsorSecretKey(secretKey));
  } catch (error) {
    console.error("Invalid Solana ATA sponsor secret key:", error);
    return null;
  }
};

const getConnection = () =>
  new Connection(getSolanaRpcUrl(), {
    commitment: SOLANA_COMMITMENT,
    confirmTransactionInitialTimeout: 120000,
    disableRetryOnRateLimit: false,
  });

const ensureRecipientUsdcAccount = async (ownerAddress: string) => {
  const normalizedOwnerAddress = normalizeSolanaAddress(ownerAddress);
  const ataAddress = getSolanaUsdcAssociatedTokenAddress(normalizedOwnerAddress);
  const connection = getConnection();
  const ataPublicKey = new PublicKey(ataAddress);

  const existingAccount = await connection.getAccountInfo(
    ataPublicKey,
    SOLANA_COMMITMENT,
  );

  if (existingAccount) {
    return {
      ownerAddress: normalizedOwnerAddress,
      ataAddress,
      created: false,
      sponsored: false,
    };
  }

  const sponsor = getSponsorKeypair();
  if (!sponsor) {
    throw new Error(
      "This Solana wallet is not ready to receive bridged USDC yet. Configure SOLANA_ATA_SPONSOR_SECRET_KEY so Tower can initialize the recipient USDC account automatically.",
    );
  }

  const ownerPublicKey = new PublicKey(normalizedOwnerAddress);
  const mintPublicKey = new PublicKey(SOLANA_DEVNET_USDC_MINT);

  const transaction = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      sponsor.publicKey,
      ataPublicKey,
      ownerPublicKey,
      mintPublicKey,
    ),
  );

  transaction.feePayer = sponsor.publicKey;

  const latestBlockhash = await connection.getLatestBlockhash(SOLANA_COMMITMENT);
  transaction.recentBlockhash = latestBlockhash.blockhash;
  transaction.sign(sponsor);

  try {
    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      {
        skipPreflight: false,
        maxRetries: 5,
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
  } catch (error) {
    const postCreateAccount = await connection.getAccountInfo(
      ataPublicKey,
      SOLANA_COMMITMENT,
    );

    if (!postCreateAccount) {
      throw error;
    }
  }

  return {
    ownerAddress: normalizedOwnerAddress,
    ataAddress,
    created: true,
    sponsored: true,
  };
};

export async function POST(request: NextRequest) {
  try {
    const { walletAddress } = (await request.json().catch(() => ({}))) as {
      walletAddress?: string;
    };

    const normalizedWalletAddress =
      typeof walletAddress === "string"
        ? normalizeSolanaAddress(walletAddress)
        : "";

    if (!normalizedWalletAddress || !isValidSolanaAddress(normalizedWalletAddress)) {
      return NextResponse.json(
        { success: false, error: "A valid Solana wallet address is required." },
        { status: 400 },
      );
    }

    const preparedRecipient = await ensureRecipientUsdcAccount(
      normalizedWalletAddress,
    );

    return NextResponse.json({
      success: true,
      ownerAddress: preparedRecipient.ownerAddress,
      ataAddress: preparedRecipient.ataAddress,
      created: preparedRecipient.created,
      sponsored: preparedRecipient.sponsored,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to prepare the Solana receiving wallet right now.";

    console.error("Failed to prepare Solana bridge recipient:", error);

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}