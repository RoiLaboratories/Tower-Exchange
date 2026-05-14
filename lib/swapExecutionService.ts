/**
 * Swap Execution Service - Handles transaction signing, broadcasting, and confirmation
 */

import { getBrowserWalletProvider } from "@/lib/browser-wallet";

export interface TransactionData {
  to: string;
  data: string;
  value: string;
  from: string;
  gasLimit: string;
  chainId: number;
}

export interface SignTransactionResult {
  signedTx: string;
  transactionHash?: string;
}

export interface BroadcastResult {
  transactionHash: string;
  status: "pending" | "success" | "failed";
}

export interface ConfirmationResult {
  transactionHash: string;
  blockNumber: number;
  status: "success" | "failed";
  gasUsed: string;
}

export interface SwapStatusDetails {
  message?: string;
  transactionHash?: string;
  blockNumber?: number;
}

interface RpcTransactionReceipt {
  blockNumber: string;
  gasUsed: string;
  status: string;
  [key: string]: unknown;
}

/**
 * Arc testnet RPC endpoint
 */
const ARC_RPC_URL = "/api/rpc/5042002";

export const FEE_COLLECTOR_ADDRESS = "0xE71e5baDb9528647F0dd42298bC543D493FC9E40";

type JsonRpcResponse<T> = {
  result?: T;
  error?: {
    message?: string;
  };
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
    throw new Error(data.error.message || `Arc RPC ${method} failed`);
  }

  return data.result as T;
};

const getArcFeeParams = async () => {
  const [latestBlock, priorityFee] = await Promise.all([
    callArcRpc<{ baseFeePerGas?: string }>("eth_getBlockByNumber", [
      "latest",
      false,
    ]),
    callArcRpc<string>("eth_maxPriorityFeePerGas", []).catch(
      () => "0x59682f00",
    ),
  ]);
  const baseFee = BigInt(latestBlock?.baseFeePerGas || "0x0");
  const priority = BigInt(priorityFee || "0x59682f00");
  const minimumPriority = 1500000000n;
  const maxPriorityFeePerGas =
    priority > minimumPriority ? priority : minimumPriority;
  const maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas;

  return {
    maxFeePerGas: `0x${maxFeePerGas.toString(16)}`,
    maxPriorityFeePerGas: `0x${maxPriorityFeePerGas.toString(16)}`,
  };
};

const applyGasBuffer = (gasEstimate: string) =>
  `0x${((BigInt(gasEstimate) * 13n) / 10n).toString(16)}`;

const encodeBalanceOfCall = (walletAddress: string) => {
  const normalizedAddress = walletAddress.toLowerCase().replace(/^0x/, "");

  if (normalizedAddress.length !== 40) {
    throw new Error(`Invalid balance owner address: ${walletAddress}`);
  }

  return `0x70a08231${normalizedAddress.padStart(64, "0")}`;
};

export const getErc20TokenBalance = async (
  tokenAddress: string,
  walletAddress: string,
): Promise<bigint> => {
  if (!tokenAddress.startsWith("0x") || tokenAddress.length !== 42) {
    throw new Error(`Invalid token address: ${tokenAddress}`);
  }

  const response = await fetch(ARC_RPC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_call",
      params: [
        {
          to: tokenAddress,
          data: encodeBalanceOfCall(walletAddress),
        },
        "latest",
      ],
      id: 1,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch token balance: HTTP ${response.status}`);
  }

  const result = await response.json();

  if (result.error) {
    throw new Error(`Failed to fetch token balance: ${result.error.message}`);
  }

  return BigInt(result.result ?? "0x0");
};

export const waitForTokenBalanceIncrease = async (
  tokenAddress: string,
  walletAddress: string,
  previousBalance: bigint,
  attempts: number = 8,
  pollInterval: number = 1000,
): Promise<bigint> => {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const nextBalance = await getErc20TokenBalance(tokenAddress, walletAddress);

    if (nextBalance > previousBalance) {
      return nextBalance - previousBalance;
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  return 0n;
};

/**
 * Validate transaction object before signing
 */
const validateTransaction = (transaction: TransactionData, walletAddress: string): void => {
  if (!transaction) {
    throw new Error("Transaction object is missing");
  }

  if (!transaction.to || typeof transaction.to !== "string") {
    throw new Error(`Invalid or missing 'to' address: ${transaction.to}. Expected hexadecimal address starting with 0x`);
  }

  if (!transaction.to.startsWith("0x") || transaction.to.length !== 42) {
    throw new Error(`'to' address must be a valid 20-byte hex address (42 characters including 0x). Received: ${transaction.to}`);
  }

  if (!transaction.data || typeof transaction.data !== "string") {
    throw new Error(`Invalid or missing 'data' field: ${transaction.data}. Expected hex string starting with 0x`);
  }

  if (!transaction.data.startsWith("0x")) {
    throw new Error(`'data' field must start with 0x. Received: ${transaction.data.substring(0, 50)}...`);
  }

  if (typeof transaction.value !== "string") {
    throw new Error(`Invalid 'value' field: ${transaction.value}. Expected string (wei amount)`);
  }

  if (!transaction.gasLimit || typeof transaction.gasLimit !== "string") {
    throw new Error(`Invalid or missing 'gasLimit': ${transaction.gasLimit}. Expected string (wei amount)`);
  }

  if (!walletAddress || typeof walletAddress !== "string") {
    throw new Error(`Invalid wallet address: ${walletAddress}`);
  }

  if (!walletAddress.startsWith("0x") || walletAddress.length !== 42) {
    throw new Error(`Wallet address must be a valid 20-byte hex address. Received: ${walletAddress}`);
  }
};

const getWalletErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const errorRecord = error as Record<string, unknown>;
    const message =
      typeof errorRecord.message === "string"
        ? errorRecord.message
        : typeof errorRecord.reason === "string"
          ? errorRecord.reason
          : null;

    if (message) {
      return message;
    }

    for (const nestedKey of ["error", "cause", "data"]) {
      const nestedMessage = getWalletErrorMessage(errorRecord[nestedKey]);

      if (nestedMessage !== "Unknown wallet error") {
        return nestedMessage;
      }
    }

    try {
      return JSON.stringify(errorRecord);
    } catch {
      return String(error);
    }
  }

  return typeof error === "string" ? error : "Unknown wallet error";
};

/**
 * Sign and send a transaction using the connected browser wallet
 * This uses the active injected provider exposed at window.ethereum
 */
export const signTransactionWithPrivy = async (
  transaction: TransactionData,
  walletAddress: string
): Promise<SignTransactionResult> => {
  try {
    // Validate transaction object
    validateTransaction(transaction, walletAddress);

    // Get the active injected wallet provider from the browser
    const provider = getBrowserWalletProvider();

    console.log("Validated transaction. Attempting to sign with browser wallet:", {
      to: transaction.to,
      from: walletAddress,
      data: `${transaction.data.substring(0, 66)}...`,
      value: transaction.value,
      gasLimit: transaction.gasLimit,
    });

    const preflightTx = {
      from: walletAddress,
      to: transaction.to,
      data: transaction.data,
      value: transaction.value,
    };
    const gasEstimate = await callArcRpc<string>("eth_estimateGas", [
      preflightTx,
    ]);
    const feeParams = await getArcFeeParams().catch((feeError) => {
      console.warn(
        "Could not load Arc EIP-1559 fee params; wallet will choose fees",
        feeError,
      );
      return null;
    });

    // Prepare the transaction object for the connected wallet
    const txObject = {
      to: transaction.to,
      from: walletAddress,
      data: transaction.data,
      value: transaction.value,
      gas: applyGasBuffer(gasEstimate),
      ...(feeParams || {}),
    };

    // Sign the transaction via eth_sendTransaction
    console.log("Sending transaction to wallet for signing...");
    const transactionHash = await provider.request({
      method: "eth_sendTransaction",
      params: [txObject],
    });

    if (!transactionHash) {
      throw new Error("No transaction hash returned from wallet. Transaction may have been rejected.");
    }

    if (typeof transactionHash !== "string" || !transactionHash.startsWith("0x")) {
      throw new Error(`Invalid transaction hash returned: ${transactionHash}`);
    }

    console.log("✓ Transaction signed and sent successfully:", transactionHash);

    return {
      signedTx: transactionHash,
      transactionHash,
    };
  } catch (error) {
    console.error("Error sending transaction with browser wallet:", error);
    
    const walletErrorMessage = getWalletErrorMessage(error);
    const normalizedMessage = walletErrorMessage.toLowerCase();
    let detailedMessage = walletErrorMessage || "Failed to send transaction";

    // Check for common wallet error patterns
    if (walletErrorMessage.includes("Invalid \"to\" address")) {
      detailedMessage = `Transaction rejected: Invalid router address. This may indicate the DEX router address is not properly configured on Arc testnet.`;
    } else if (normalizedMessage.includes("txpool is full")) {
      detailedMessage =
        "Arc RPC transaction pool is full. Please wait a minute and try again, or switch MetaMask to another Arc RPC endpoint if you have one configured.";
    } else if (normalizedMessage.includes("insufficient funds")) {
      detailedMessage = "Insufficient funds in wallet to pay for gas.";
    } else if (
      normalizedMessage.includes("user rejected") ||
      normalizedMessage.includes("user denied")
    ) {
      detailedMessage = "Transaction signing was cancelled by user.";
    }
    
    throw new Error(detailedMessage);
  }
};

/**
 * Broadcast transaction to Arc network if the wallet returned a signed payload
 * If we already have a transaction hash from the wallet, we can skip straight to polling
 */
export const broadcastTransaction = async (
  signedTx: string
): Promise<BroadcastResult> => {
  try {
    // If signedTx is already a transaction hash, we're done
    if (signedTx.startsWith("0x") && signedTx.length === 66) {
      console.log("Transaction already broadcasted by wallet:", signedTx);
      return {
        transactionHash: signedTx,
        status: "pending",
      };
    }

    console.log("Broadcasting transaction to Arc network");

    const response = await fetch(ARC_RPC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_sendRawTransaction",
        params: [signedTx],
        id: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(`RPC error: ${result.error.message}`);
    }

    const transactionHash = result.result;

    console.log("Transaction broadcasted successfully:", transactionHash);

    return {
      transactionHash,
      status: "pending",
    };
  } catch (error) {
    console.error("Error broadcasting transaction:", error);
    throw new Error(
      `Failed to broadcast transaction: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};

/**
 * Poll for transaction confirmation on Arc network
 */
export const pollTransactionConfirmation = async (
  transactionHash: string,
  maxAttempts: number = 30,
  pollInterval: number = 1000
): Promise<ConfirmationResult> => {
  try {
    console.log(`Polling for transaction confirmation: ${transactionHash}`);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const receipt = await getTransactionReceipt(transactionHash);

      if (receipt) {
        const status = receipt.status === "0x1" ? "success" : "failed";

        console.log(`Transaction confirmed: ${status}`, {
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed,
        });

        return {
          transactionHash,
          blockNumber: parseInt(receipt.blockNumber, 16),
          status,
          gasUsed: receipt.gasUsed,
        };
      }

      // Wait before next attempt
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(
      `Transaction confirmation timeout after ${maxAttempts} attempts`
    );
  } catch (error) {
    console.error("Error polling transaction confirmation:", error);
    throw new Error(
      `Failed to confirm transaction: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};

/**
 * Get transaction receipt from Arc RPC
 */
const getTransactionReceipt = async (
  transactionHash: string
): Promise<RpcTransactionReceipt | null> => {
  try {
    const response = await fetch(ARC_RPC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getTransactionReceipt",
        params: [transactionHash],
        id: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.error) {
      console.warn(`RPC error: ${result.error.message}`);
      return null;
    }

    return result.result;
  } catch (error) {
    console.error("Error getting transaction receipt:", error);
    return null;
  }
};

/**
 * Complete swap execution flow: sign → broadcast → confirm → notify backend
 */
export const executeSwapFlow = async (
  transaction: TransactionData,
  walletAddress: string,
  onStatusChange: (status: string, details?: SwapStatusDetails) => void,
  onError: (error: string) => void
): Promise<ConfirmationResult | null> => {
  try {
    // Step 1: Sign transaction
    onStatusChange("signing", { message: "Requesting wallet signature..." });
    const signResult = await signTransactionWithPrivy(transaction, walletAddress);

    // Step 2: Broadcast transaction (may be skipped if already broadcasted by wallet)
    onStatusChange("broadcasting", {
      message: "Broadcasting transaction to Arc network...",
    });
    const broadcastResult = await broadcastTransaction(signResult.signedTx);

    // Step 3: Poll for confirmation
    onStatusChange("confirming", {
      message: "Waiting for blockchain confirmation...",
      transactionHash: broadcastResult.transactionHash,
    });
    const confirmation = await pollTransactionConfirmation(
      broadcastResult.transactionHash
    );

    // Step 4: Return confirmation
    onStatusChange("confirmed", {
      message: "Swap completed successfully!",
      transactionHash: confirmation.transactionHash,
      blockNumber: confirmation.blockNumber,
    });

    return confirmation;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    onError(errorMessage);
    throw error;
  }
};

/**
 * Notify backend that transaction has been confirmed
 */
export const notifyBackendConfirmation = async (
  walletAddress: string,
  sessionId: string,
  transactionHash: string,
  confirmation: ConfirmationResult
): Promise<boolean> => {
  try {
    const response = await fetch("/api/ai/confirm-transaction", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        wallet_address: walletAddress,
        session_id: sessionId,
        transaction_hash: transactionHash,
        block_number: confirmation.blockNumber,
        status: confirmation.status,
        gas_used: confirmation.gasUsed,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log("Backend confirmation notification sent:", result);
    return true;
  } catch (error) {
    console.error("Error notifying backend of confirmation:", error);
    // Don't throw - confirmation was successful on-chain, backend notification is secondary
    return false;
  }
};

/**
 * Submit platform fee to FeeCollector for distribution after swap confirms
 * CRITICAL: Must be called AFTER swap transaction is confirmed on-chain
 * This triggers FeeCollector to atomically deduct fee and send remainder to user wallet
 */
export interface SwapFeeSettlementValidation {
  swapTransactionHash?: string;
  feeCollectorBalanceBefore?: string;
  inputToken?: string;
  inputAmount?: string;
}

export const submitSwapFee = async (
  outputToken: string,
  outputAmount: string,
  userAddress: string,
  feeBps: number = 25,
  settlementValidation: SwapFeeSettlementValidation = {}
): Promise<boolean> => {
  try {
    console.log("=== FEE SUBMISSION START ===");
    console.log("submitSwapFee called with:", {
      outputToken,
      outputAmount,
      userAddress,
      feeBps,
      settlementValidation,
    });

    // Ensure we have all required parameters
    if (!outputToken || !outputAmount || !userAddress) {
      console.error("Missing required fee submission parameters:", {
        outputToken: !!outputToken,
        outputAmount: !!outputAmount,
        userAddress: !!userAddress,
      });
      return false;
    }

    // Validate token address format (should be 42 chars: 0x + 40 hex chars)
    if (outputToken.length !== 42 || !outputToken.startsWith("0x")) {
      console.error("Invalid token address format:", {
        address: outputToken,
        length: outputToken.length,
        startsWithOx: outputToken.startsWith("0x"),
      });
      return false;
    }

    // Validate user address format
    if (userAddress.length !== 42 || !userAddress.startsWith("0x")) {
      console.error("Invalid user address format:", {
        address: userAddress,
        length: userAddress.length,
        startsWithOx: userAddress.startsWith("0x"),
      });
      return false;
    }

    // Validate output amount is a valid number
    if (isNaN(Number(outputAmount)) || Number(outputAmount) <= 0) {
      console.error("Invalid output amount:", {
        amount: outputAmount,
        parsedAsNumber: Number(outputAmount),
      });
      return false;
    }

    const payload = {
      outputToken,
      totalAmount: outputAmount,
      userAddress,
      feeBps,
      ...settlementValidation,
    };

    console.log("FEE SUBMISSION PAYLOAD:", JSON.stringify(payload, null, 2));

    const response = await fetch("/api/swap/submit-fee", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log("Fee submission response status:", response.status);
    const result = await response.json();
    console.log("Fee submission response body:", JSON.stringify(result, null, 2));

    if (!response.ok) {
      console.error(`Fee submission HTTP error! status: ${response.status}`, result);
      return false;
    }

    if (result.error) {
      console.error("Fee submission returned error:", result.error, result.details);
      return false;
    }

    console.log("✅ Platform fee submitted successfully!", result.data);
    const feeDistributionTxHash =
      result.data?.transactionHash || result.transactionHash;

    if (feeDistributionTxHash) {
      console.log("Waiting for fee distribution confirmation:", feeDistributionTxHash);
      const confirmation = await pollTransactionConfirmation(feeDistributionTxHash);

      if (confirmation.status !== "success") {
        console.error("Fee distribution transaction failed:", confirmation);
        return false;
      }

      console.log("Fee distribution confirmed:", {
        transactionHash: confirmation.transactionHash,
        blockNumber: confirmation.blockNumber,
      });
    }

    console.log("=== FEE SUBMISSION SUCCESS ===");
    return true;
  } catch (error) {
    console.error("❌ Error submitting platform fee:", error);
    console.log("=== FEE SUBMISSION FAILED ===");
    // Log but don't throw - if fee submission fails, the user has their tokens in FeeCollector
    // and manual distribution can be triggered later
    return false;
  }
};
