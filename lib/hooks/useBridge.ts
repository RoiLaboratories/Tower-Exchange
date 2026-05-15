/**
 * useBridge Hook
 * 
 * Manages bridge state and execution for the bridge component
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import {
  bridgeTokens,
  isBridgeRouteSupported,
  estimateBridgeTime,
  getBridgeFees,
  BridgeRequest,
  BridgeResponse,
  SUPPORTED_CHAINS,
  formatBridgeAmount,
  isValidAddress,
} from "@/lib/bridgeService";

export interface BridgeState {
  isLoading: boolean;
  isBridging: boolean;
  error: string | null;
  success: boolean;
  estimatedFee: string;
  estimatedTime: string;
  transactionHash?: string;
  status?: string; // "pending" or "completed"
  message?: string; // Additional info message for pending status
  forwarded?: boolean;
}

export function useBridge() {
  const [state, setState] = useState<BridgeState>({
    isLoading: false,
    isBridging: false,
    error: null,
    success: false,
    estimatedFee: "0.00",
    estimatedTime: "2-5 minutes",
  });

  /**
   * Validate bridge inputs
   */
  const validateBridgeInputs = useCallback(
    (
      fromChain: string | null,
      toChain: string | null,
      amount: string,
      toAddress: string
    ): string | null => {
      if (!fromChain) return "Please select a source chain";
      if (!toChain) return "Please select a destination chain";
      if (!amount || parseFloat(amount) <= 0) return "Please enter a valid amount";
      if (!toAddress) return "Please enter a destination address";

      // Validate route is supported
      if (!isBridgeRouteSupported(fromChain, toChain)) {
        return "This bridge route is not supported";
      }

      // Validate destination address
      const toChainConfig = SUPPORTED_CHAINS[toChain as keyof typeof SUPPORTED_CHAINS];
      const chainType = toChain === "solana" ? "solana" : "evm";
      
      if (!isValidAddress(toAddress, chainType)) {
        return `Invalid ${toChainConfig?.name} address format`;
      }

      return null;
    },
    []
  );

  /**
   * Calculate bridge fees and estimated time
   */
  const calculateBridgeDetails = useCallback(
    async (fromChain: string, toChain: string, amount: string, tokenSymbol: string = "USDC") => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        const fees = await getBridgeFees(fromChain, toChain, amount, tokenSymbol);
        const time = estimateBridgeTime(fromChain, toChain);

        setState((prev) => ({
          ...prev,
          isLoading: false,
          estimatedFee: fees.circleFee,
          estimatedTime: time,
        }));
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to calculate bridge details";
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
      }
    },
    []
  );

  /**
   * Execute a bridge transaction
   */
  const executeBridge = useCallback(
    async (request: BridgeRequest): Promise<BridgeResponse> => {
      // Validate inputs first
      const validationError = validateBridgeInputs(
        request.fromChain,
        request.toChain,
        request.amount,
        request.toAddress || ""
      );

      if (validationError) {
        setState((prev) => ({
          ...prev,
          error: validationError,
          isBridging: false,
        }));
        return {
          success: false,
          error: validationError,
        };
      }

      try {
        setState((prev) => ({
          ...prev,
          isBridging: true,
          error: null,
          success: false,
        }));

        // Format amount properly
        const formattedAmount = formatBridgeAmount(request.amount, 6);

        // Execute the bridge
        const result = await bridgeTokens({
          ...request,
          amount: formattedAmount,
        });

        if (result.success) {
          setState((prev) => ({
            ...prev,
            isBridging: false,
            success: true,
            transactionHash: result.transactionHash,
            status: result.status,
            message: result.message,
            forwarded: result.forwarded,
            error: null,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            isBridging: false,
            success: false,
            error: result.error || "Bridge transaction failed",
          }));
        }

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Bridge transaction failed";
        setState((prev) => ({
          ...prev,
          isBridging: false,
          success: false,
          error: errorMessage,
        }));

        return {
          success: false,
          error: errorMessage,
        };
      }
    },
    [validateBridgeInputs]
  );

  /**
   * Reset bridge state
   */
  const resetBridgeState = useCallback(() => {
    setState({
      isLoading: false,
      isBridging: false,
      error: null,
      success: false,
      estimatedFee: "0.00",
      estimatedTime: "2-5 minutes",
      status: undefined,
      message: undefined,
      forwarded: undefined,
    });
  }, []);

  /**
   * Clear error message
   */
  const clearError = useCallback(() => {
    setState((prev) => ({
      ...prev,
      error: null,
    }));
  }, []);

  return {
    ...state,
    executeBridge,
    validateBridgeInputs,
    calculateBridgeDetails,
    resetBridgeState,
    clearError,
  };
}

export default useBridge;
