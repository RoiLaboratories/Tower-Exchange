import { NextRequest, NextResponse } from "next/server";
import {
  type PublicClient,
  createPublicClient,
  http,
  getContract,
  erc20Abi,
  formatUnits,
} from "viem";
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { ARC_RPC_ENDPOINTS } from "@/lib/arcRpc";

const ARC_TESTNET_CHAIN_ID = "arc-testnet";
const ARC_NATIVE_USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
const ARC_NATIVE_USDC_DECIMALS = 18;
const SOLANA_DEVNET_CHAIN_ID = "solana";
const SOLANA_DEVNET_RPC_URL = "https://api.devnet.solana.com";
const SOLANA_DEVNET_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

const RPC_URL_FALLBACKS: Record<string, string[]> = {
  [ARC_TESTNET_CHAIN_ID]: [...ARC_RPC_ENDPOINTS],
  "421614": [
    "https://sepolia-rollup.arbitrum.io/rpc",
    "https://arbitrum-sepolia-rpc.publicnode.com",
    "https://arbitrum-sepolia.drpc.org",
  ],
  "arbitrum-sepolia": [
    "https://sepolia-rollup.arbitrum.io/rpc",
    "https://arbitrum-sepolia-rpc.publicnode.com",
    "https://arbitrum-sepolia.drpc.org",
  ],
};

const getRpcUrlsForChain = (chainId: string, rpcUrl: string) => {
  const configuredFallbacks =
    RPC_URL_FALLBACKS[String(chainId).toLowerCase()] ?? [];

  return Array.from(new Set([...configuredFallbacks, rpcUrl].filter(Boolean)));
};

const readWithRpcFallback = async <T,>(
  chainId: string,
  rpcUrl: string,
  read: (publicClient: PublicClient) => Promise<T>,
) => {
  let lastError: unknown = null;

  for (const candidateRpcUrl of getRpcUrlsForChain(chainId, rpcUrl)) {
    try {
      const publicClient = createPublicClient({
        transport: http(candidateRpcUrl),
      });

      return await read(publicClient);
    } catch (error) {
      lastError = error;
      console.warn(
        `Wallet balance RPC failed for ${chainId} using ${candidateRpcUrl}:`,
        error,
      );
    }
  }

  throw lastError ?? new Error("No RPC endpoints available");
};

const isValidSolanaAddress = (address: string) => {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
};

const getSolanaConnection = (rpcUrl?: string) =>
  new Connection(rpcUrl || SOLANA_DEVNET_RPC_URL, "confirmed");

const readSolanaTokenBalance = async (
  address: string,
  rpcUrl: string,
  mintAddress: string,
) => {
  const connection = getSolanaConnection(rpcUrl);
  const owner = new PublicKey(address);
  const mint = new PublicKey(mintAddress);
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, {
    mint,
  });

  const total = tokenAccounts.value.reduce((sum, tokenAccount) => {
    const parsed = tokenAccount.account.data.parsed.info.tokenAmount;
    const uiAmount = Number(parsed.uiAmountString ?? parsed.uiAmount ?? 0);
    return sum + uiAmount;
  }, 0);

  return total.toFixed(6);
};

export async function POST(request: NextRequest) {
  try {
    const { address, chainId, rpcUrl, tokenAddress, balanceType } =
      await request.json();
    const normalizedChainId = String(chainId).toLowerCase();

    if (!address || !chainId || !rpcUrl) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 },
      );
    }

    if (normalizedChainId === SOLANA_DEVNET_CHAIN_ID) {
      if (!isValidSolanaAddress(address)) {
        return NextResponse.json({ balance: "0.00" });
      }

      if (balanceType === "native") {
        const connection = getSolanaConnection(rpcUrl);
        const lamports = await connection.getBalance(new PublicKey(address));

        return NextResponse.json({
          balance: (lamports / LAMPORTS_PER_SOL).toFixed(6),
        });
      }

      const mintAddress = tokenAddress || getUSDCAddressForChain(normalizedChainId);
      if (!mintAddress) {
        return NextResponse.json(
          { balance: "0.00", error: "Token not supported on this chain" },
          { status: 200 },
        );
      }

      const formattedBalance = await readSolanaTokenBalance(
        address,
        rpcUrl,
        mintAddress,
      );

      return NextResponse.json({ balance: formattedBalance });
    }

    if (balanceType === "native") {
      const formattedBalance = await readWithRpcFallback(
        normalizedChainId,
        rpcUrl,
        async (publicClient) => {
          const balance = await publicClient.getBalance({
            address: address as `0x${string}`,
          });

          return Number(formatUnits(balance, ARC_NATIVE_USDC_DECIMALS)).toFixed(
            6,
          );
        },
      );

      return NextResponse.json({
        balance: formattedBalance,
      });
    }

    const contractAddress =
      tokenAddress || getUSDCAddressForChain(String(chainId));
    if (!contractAddress) {
      return NextResponse.json(
        { balance: "0.00", error: "Token not supported on this chain" },
        { status: 200 },
      );
    }

    if (
      normalizedChainId === ARC_TESTNET_CHAIN_ID &&
      contractAddress.toLowerCase() === ARC_NATIVE_USDC_ADDRESS
    ) {
      const formattedBalance = await readWithRpcFallback(
        normalizedChainId,
        rpcUrl,
        async (publicClient) => {
          const balance = await publicClient.getBalance({
            address: address as `0x${string}`,
          });

          return Number(formatUnits(balance, ARC_NATIVE_USDC_DECIMALS)).toFixed(
            6,
          );
        },
      );

      return NextResponse.json({
        balance: formattedBalance,
      });
    }

    const formattedBalance = await readWithRpcFallback(
      normalizedChainId,
      rpcUrl,
      async (publicClient) => {
        const contract = getContract({
          address: contractAddress as `0x${string}`,
          abi: erc20Abi,
          client: publicClient,
        });

        const balance = (await contract.read.balanceOf([
          address as `0x${string}`,
        ])) as bigint;

        const decimals = (await contract.read.decimals()) as number;

        return Number(formatUnits(balance, decimals)).toFixed(6);
      },
    );

    return NextResponse.json({ balance: formattedBalance });
  } catch (error) {
    console.error("Error fetching wallet balance:", error);
    return NextResponse.json(
      { balance: "0.00", error: "Failed to fetch balance" },
      { status: 200 },
    );
  }
}

function getUSDCAddressForChain(chainId: string): string | null {
  const addressMap: { [key: string]: string } = {
    "arc-testnet": "0x3600000000000000000000000000000000000000",
    "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "optimism-sepolia": "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
    "avalanche-fuji": "0x5425890298aed601595a70ab815c96711a31bc65",
    "arbitrum-sepolia": "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    "ethereum-sepolia": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    "linea-sepolia": "0xfece4462d57bd51a6a552365a011b95f0e16d9b7",
    "polygon-amoy": "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582",
    "sonic-testnet": "0x0BA304580ee7c9a980CF72e55f5Ed2E9fd30Bc51",
    solana: SOLANA_DEVNET_USDC_MINT,
    "unichain-sepolia": "0x31d0220469e10c4E71834a79b1f276d740d3768F",
  };

  return addressMap[chainId] || null;
}
