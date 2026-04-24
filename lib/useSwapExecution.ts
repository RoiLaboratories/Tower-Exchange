/**
 * useSwapExecution Hook - Manages the complete swap execution flow
 */

import { useState, useCallback } from "react";
import {
  executeSwapFlow,
  notifyBackendConfirmation,
  TransactionData,
  ConfirmationResult,
} from "./swapExecutionService";
import { useRainbowKitAuth } from "./use-rainbowkit-auth";

export interface SwapExecutionState {
  status: "idle" | "signing" | "broadcasting" | "confirming" | "confirmed" | "error";
  loading: boolean;
  error: string | null;
  transactionHash?: string;
  blockNumber?: number;
  statusMessage?: string;
}

export const useSwapExecution = () => {
  const { user } = useRainbowKitAuth();
  const [state, setState] = useState<SwapExecutionState>({
    status: "idle",
    loading: false,
    error: null,
  });

  const executeSwap = useCallback(
    async (
      transaction: TransactionData,
      walletAddress: string,
      sessionId: string,
      onComplete?: (confirmation: ConfirmationResult) => void
    ) => {
      try {
        setState({ status: "idle", loading: true, error: null });

        if (!user?.wallet?.address) {
          throw new Error("Wallet not connected");
        }

        // Execute the complete swap flow
        const confirmation = await executeSwapFlow(
          transaction,
          walletAddress,
          (status, details) => {
            console.log("Swap status update:", status, details);
            setState({
              status: status as any,
              loading: true,
              error: null,
              transactionHash: details?.transactionHash,
              blockNumber: details?.blockNumber,
              statusMessage: details?.message,
            });
          },
          (error) => {
            console.error("Swap execution error:", error);
            setState({
              status: "error",
              loading: false,
              error,
            });
          }
        );

        // Notify backend of successful confirmation
        if (confirmation) {
          await notifyBackendConfirmation(
            walletAddress,
            sessionId,
            confirmation.transactionHash,
            confirmation
          );

          setState({
            status: "confirmed",
            loading: false,
            error: null,
            transactionHash: confirmation.transactionHash,
            blockNumber: confirmation.blockNumber,
            statusMessage: "Swap completed successfully!",
          });

          onComplete?.(confirmation);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        setState({
          status: "error",
          loading: false,
          error: errorMessage,
        });
      }
    },
    [user?.wallet?.address]
  );

  const resetState = useCallback(() => {
    setState({
      status: "idle",
      loading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    executeSwap,
    resetState,
  };
};
