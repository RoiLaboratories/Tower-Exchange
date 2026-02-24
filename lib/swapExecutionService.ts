/**
 * Swap Execution Service - Handles transaction signing, broadcasting, and confirmation
 */

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

/**
 * Arc testnet RPC endpoint
 */
const ARC_RPC_URL = "https://rpc.testnet.arc.network";

/**
 * Sign and send a transaction using Privy's embedded wallet
 * This uses window.ethereum provider which Privy injects
 */
export const signTransactionWithPrivy = async (
  transaction: TransactionData,
  walletAddress: string
): Promise<SignTransactionResult> => {
  try {
    if (!walletAddress) {
      throw new Error("Wallet address not available");
    }

    // Get the ethereum provider from window (injected by Privy)
    const provider = (window as any).ethereum;
    if (!provider) {
      throw new Error("Ethereum provider not available. Please ensure Privy wallet is connected.");
    }

    console.log("Signing transaction with Privy wallet:", {
      to: transaction.to,
      from: transaction.from,
      value: transaction.value,
    });

    // Prepare the transaction object
    const txObject = {
      to: transaction.to,
      from: walletAddress,
      data: transaction.data,
      value: transaction.value,
      gasLimit: transaction.gasLimit,
    };

    // Sign the transaction via eth_sendTransaction (Privy handles the UI)
    // This will show Privy's wallet confirmation screen
    const transactionHash = await provider.request({
      method: "eth_sendTransaction",
      params: [txObject],
    });

    console.log("Transaction sent successfully:", transactionHash);

    return {
      signedTx: transactionHash,
      transactionHash,
    };
  } catch (error) {
    console.error("Error signing transaction with Privy:", error);
    throw new Error(
      `Failed to sign transaction: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};

/**
 * Broadcast transaction to Arc network (if needed - Privy usually handles this)
 * If we have a transaction hash from Privy, we can skip this and go straight to polling
 */
export const broadcastTransaction = async (
  signedTx: string
): Promise<BroadcastResult> => {
  try {
    // If signedTx is already a transaction hash (from Privy), we're done
    if (signedTx.startsWith("0x") && signedTx.length === 66) {
      console.log("Transaction already broadcasted by Privy:", signedTx);
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
): Promise<any | null> => {
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
  onStatusChange: (status: string, details?: any) => void,
  onError: (error: string) => void
): Promise<ConfirmationResult | null> => {
  try {
    // Step 1: Sign transaction
    onStatusChange("signing", { message: "Requesting wallet signature..." });
    const signResult = await signTransactionWithPrivy(transaction, walletAddress);

    // Step 2: Broadcast transaction (may be skipped if already broadcasted by Privy)
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
