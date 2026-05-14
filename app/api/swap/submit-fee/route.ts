/**
 * Next.js API Route: POST /api/swap/submit-fee
 * 
 * Proxies fee submission requests to Tower-Backend
 * After swap completes on-chain, frontend calls this route to trigger fee collection
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveSwapBackendUrl } from "@/lib/resolveSwapBackendUrl";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

const BACKEND_URL = resolveSwapBackendUrl();
const ARC_RPC_URL = "https://rpc.testnet.arc.network";
const FEE_COLLECTOR_ADDRESS = "0xE71e5baDb9528647F0dd42298bC543D493FC9E40";
const NATIVE_USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
const BALANCE_OF_SELECTOR = "0x70a08231";
const ERC20_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

type JsonRpcResponse<T> = {
  result?: T;
  error?: {
    code?: number;
    message?: string;
    data?: unknown;
  };
};

type TransactionLog = {
  address: string;
  topics: string[];
  data: string;
};

type TransactionReceipt = {
  status?: string;
  from?: string;
  logs?: TransactionLog[];
};

const normalizeAddress = (address: string) => address.toLowerCase();

const topicAddress = (address: string) =>
  `0x${address.replace(/^0x/i, "").toLowerCase().padStart(64, "0")}`;

const encodeBalanceOf = (ownerAddress: string) =>
  `${BALANCE_OF_SELECTOR}${ownerAddress
    .replace(/^0x/i, "")
    .toLowerCase()
    .padStart(64, "0")}`;

const parseAmount = (value: unknown, label: string): bigint => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a string amount`);
  }

  try {
    return BigInt(value);
  } catch {
    throw new Error(`${label} is not a valid bigint amount`);
  }
};

const callArcRpc = async <T,>(
  method: string,
  params: unknown[],
): Promise<T> => {
  const response = await fetch(ARC_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method,
      params,
      id: Date.now(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Arc RPC ${method} failed with status ${response.status}`);
  }

  const data = (await response.json()) as JsonRpcResponse<T>;
  if (data.error) {
    throw new Error(data.error.message || `Arc RPC ${method} returned an error`);
  }

  return data.result as T;
};

const getTransactionReceipt = (transactionHash: string) =>
  callArcRpc<TransactionReceipt | null>("eth_getTransactionReceipt", [
    transactionHash,
  ]);

const getTokenBalance = async (tokenAddress: string, ownerAddress: string) => {
  const rawBalance = await callArcRpc<string>("eth_call", [
    {
      to: tokenAddress,
      data: encodeBalanceOf(ownerAddress),
    },
    "latest",
  ]);

  return BigInt(rawBalance || "0x0");
};

const sumTransferAmount = (
  receipt: TransactionReceipt,
  tokenAddress: string,
  filters: {
    from?: string;
    to?: string;
  },
) => {
  const token = normalizeAddress(tokenAddress);
  const fromTopic = filters.from ? topicAddress(filters.from) : null;
  const toTopic = filters.to ? topicAddress(filters.to) : null;

  return (receipt.logs || []).reduce((total, log) => {
    const [eventTopic, from, to] = log.topics || [];
    if (normalizeAddress(log.address) !== token) {
      return total;
    }
    if (normalizeAddress(eventTopic || "") !== ERC20_TRANSFER_TOPIC) {
      return total;
    }
    if (fromTopic && normalizeAddress(from || "") !== fromTopic) {
      return total;
    }
    if (toTopic && normalizeAddress(to || "") !== toTopic) {
      return total;
    }

    return total + BigInt(log.data && log.data !== "0x" ? log.data : "0x0");
  }, 0n);
};

const validateSwapSettlement = async (body: Record<string, unknown>) => {
  const swapTransactionHash = body.swapTransactionHash;
  const outputToken = body.outputToken;
  const userAddress = body.userAddress;
  const inputToken = body.inputToken;
  const inputAmount = body.inputAmount;

  if (typeof swapTransactionHash !== "string" || !swapTransactionHash) {
    return {
      ok: false,
      status: 400,
      payload: {
        error: "Missing swap transaction hash",
        details:
          "Fee distribution requires a confirmed swap transaction hash before the FeeCollector can be split.",
      },
    };
  }

  if (typeof outputToken !== "string" || typeof userAddress !== "string") {
    return {
      ok: false,
      status: 400,
      payload: {
        error: "Missing settlement validation fields",
        details: "outputToken and userAddress are required for settlement checks.",
      },
    };
  }

  const totalAmount = parseAmount(body.totalAmount, "totalAmount");
  const receipt = await getTransactionReceipt(swapTransactionHash);

  if (!receipt) {
    return {
      ok: false,
      status: 409,
      payload: {
        error: "Swap transaction is not confirmed",
        details:
          "Fee distribution was stopped because the swap receipt is not available yet.",
      },
    };
  }

  if (receipt.status !== "0x1") {
    return {
      ok: false,
      status: 409,
      payload: {
        error: "Swap transaction failed",
        details:
          "Fee distribution was stopped because the swap did not succeed on-chain.",
      },
    };
  }

  if (
    receipt.from &&
    normalizeAddress(receipt.from) !== normalizeAddress(userAddress)
  ) {
    return {
      ok: false,
      status: 409,
      payload: {
        error: "Swap sender mismatch",
        details:
          "Fee distribution was stopped because the confirmed swap was not sent by the requested user wallet.",
      },
    };
  }

  let currentFeeCollectorBalance: bigint | null = null;
  let balanceBefore: bigint | null = null;
  let feeCollectorBalanceIncreased = false;

  if (typeof body.feeCollectorBalanceBefore === "string") {
    balanceBefore = parseAmount(
      body.feeCollectorBalanceBefore,
      "feeCollectorBalanceBefore",
    );
    currentFeeCollectorBalance = await getTokenBalance(
      outputToken,
      FEE_COLLECTOR_ADDRESS,
    );
    feeCollectorBalanceIncreased =
      currentFeeCollectorBalance >= balanceBefore + totalAmount;
  }

  const outputReceived = sumTransferAmount(receipt, outputToken, {
    to: FEE_COLLECTOR_ADDRESS,
  });
  const receiptShowsFeeCollectorOutput = outputReceived >= totalAmount;

  if (!receiptShowsFeeCollectorOutput && !feeCollectorBalanceIncreased) {
    return {
      ok: false,
      status: 409,
      payload: {
        error: "FeeCollector output was not received",
        details:
          "Fee distribution was stopped because the swap receipt does not show the expected output token transfer into the FeeCollector, and the FeeCollector balance did not increase by the expected amount.",
        expectedAmount: totalAmount.toString(),
        receivedAmount: outputReceived.toString(),
      },
    };
  }

  if (typeof inputToken !== "string" || typeof inputAmount !== "string") {
    return {
      ok: false,
      status: 400,
      payload: {
        error: "Missing input settlement fields",
        details:
          "inputToken and inputAmount are required so the API can verify the user's swap input was actually spent.",
      },
    };
  }

  if (normalizeAddress(inputToken) !== normalizeAddress(NATIVE_USDC_ADDRESS)) {
    const expectedInputAmount = parseAmount(inputAmount, "inputAmount");
    const inputSpent = sumTransferAmount(receipt, inputToken, {
      from: userAddress,
    });

    if (inputSpent < expectedInputAmount) {
      return {
        ok: false,
        status: 409,
        payload: {
          error: "Swap input was not spent",
          details:
            "Fee distribution was stopped because the swap receipt does not show the expected input token transfer from the user wallet.",
          expectedAmount: expectedInputAmount.toString(),
          spentAmount: inputSpent.toString(),
        },
      };
    }
  }

  if (!receiptShowsFeeCollectorOutput && currentFeeCollectorBalance === null) {
    currentFeeCollectorBalance = await getTokenBalance(
      outputToken,
      FEE_COLLECTOR_ADDRESS,
    );
  }

  if (
    !receiptShowsFeeCollectorOutput &&
    balanceBefore !== null &&
    currentFeeCollectorBalance !== null
  ) {
    const requiredBalance = balanceBefore + totalAmount;

    if (currentFeeCollectorBalance < requiredBalance) {
      return {
        ok: false,
        status: 409,
        payload: {
          error: "FeeCollector balance did not increase",
          details:
            "Fee distribution was stopped because the FeeCollector balance did not increase by the expected swap output amount.",
          balanceBefore: balanceBefore.toString(),
          currentBalance: currentFeeCollectorBalance.toString(),
          requiredBalance: requiredBalance.toString(),
        },
      };
    }
  } else if (
    !receiptShowsFeeCollectorOutput &&
    currentFeeCollectorBalance !== null &&
    currentFeeCollectorBalance < totalAmount
  ) {
    return {
      ok: false,
      status: 409,
      payload: {
        error: "Insufficient FeeCollector output balance",
        details:
          "Fee distribution was stopped because the FeeCollector does not currently hold the expected output amount.",
        currentBalance: currentFeeCollectorBalance.toString(),
        requiredBalance: totalAmount.toString(),
      },
    };
  }

  return { ok: true, status: 200, payload: null };
};

export async function POST(request: NextRequest) {
  try {
    console.log("[FeeSubmit API] Received fee submission request");

    // Parse request body
    const body = await request.json();
    console.log("[FeeSubmit API] Request body:", {
      outputToken: body.outputToken?.substring(0, 6) + "...",
      totalAmount: body.totalAmount,
      userAddress: body.userAddress?.substring(0, 6) + "...",
      feeBps: body.feeBps,
      swapTransactionHash: body.swapTransactionHash,
    });

    // Validate required fields
    if (!body.outputToken || !body.totalAmount || !body.userAddress || body.feeBps === undefined) {
      console.error("[FeeSubmit API] Missing required fields");
      return NextResponse.json(
        { error: "Missing required fields: outputToken, totalAmount, userAddress, feeBps" },
        { status: 400 }
      );
    }

    const validation = await validateSwapSettlement(body);
    if (!validation.ok) {
      console.error("[FeeSubmit API] Settlement validation failed:", validation.payload);
      return NextResponse.json(validation.payload, { status: validation.status });
    }

    // Forward to Tower-Backend
    const backendUrl = `${BACKEND_URL}/api/swap/submit-fee`;
    console.log("[FeeSubmit API] Forwarding to Tower-Backend:", backendUrl);

    const response = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        outputToken: body.outputToken,
        totalAmount: body.totalAmount,
        userAddress: body.userAddress,
        feeBps: body.feeBps,
        swapTransactionHash: body.swapTransactionHash,
      }),
    });

    const responseText = await response.text();
    let responseData: unknown;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { error: responseText || "Non-JSON backend response" };
    }
    console.log("[FeeSubmit API] Tower-Backend response status:", response.status);
    console.log("[FeeSubmit API] Tower-Backend response:", responseData);

    if (!response.ok) {
      console.error("[FeeSubmit API] Tower-Backend returned error:", responseData);
      return NextResponse.json(responseData, { status: response.status });
    }

    console.log("[FeeSubmit API] Fee submission successful!");
    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error("[FeeSubmit API] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to submit fee", details: errorMessage },
      { status: 500 }
    );
  }
}
