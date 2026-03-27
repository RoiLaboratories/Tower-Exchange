import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, getContract, erc20Abi } from "viem";

export async function POST(request: NextRequest) {
  try {
    const { address, chainId, rpcUrl } = await request.json();

    if (!address || !chainId || !rpcUrl) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Create public client for the chain
    const publicClient = createPublicClient({
      transport: http(rpcUrl),
    });

    // Get USDC contract address for the chain
    const usdcAddress = getUSDCAddressForChain(chainId);
    if (!usdcAddress) {
      return NextResponse.json(
        { balance: "0.00", error: "USDC not supported on this chain" },
        { status: 200 }
      );
    }

    // Get the contract
    const contract = getContract({
      address: usdcAddress as `0x${string}`,
      abi: erc20Abi,
      client: publicClient,
    });

    // Fetch balance
    const balance = (await contract.read.balanceOf([
      address as `0x${string}`,
    ])) as bigint;

    // Fetch decimals
    const decimals = (await contract.read.decimals()) as number;

    // Convert to readable format
    const formattedBalance = (
      Number(balance) /
      Math.pow(10, decimals)
    ).toFixed(6);

    return NextResponse.json({ balance: formattedBalance });
  } catch (error) {
    console.error("Error fetching wallet balance:", error);
    return NextResponse.json(
      { balance: "0.00", error: "Failed to fetch balance" },
      { status: 200 }
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
    "unichain-sepolia": "0x31d0220469e10c4E71834a79b1f276d740d3768F",
  };

  return addressMap[chainId] || null;
}
