import { ethers } from 'ethers';
import { Quote, SwapTransaction, ApprovalTransaction, ArcTestnetConfig } from '../types';
/**
 * TransactionBuilder
 * Builds executable transactions for swaps on Arc testnet
 */
export declare class TransactionBuilder {
    private config;
    private provider;
    constructor(config: ArcTestnetConfig, provider: ethers.providers.Provider);
    /**
     * Build swap transaction from a quote
     */
    buildSwapTransaction(quote: Quote, userAddress: string): Promise<SwapTransaction>;
    /**
     * Build approval transaction for a token
     */
    buildApprovalTransaction(tokenAddress: string, spenderAddress: string, amount: string, userAddress: string): ApprovalTransaction;
    /**
     * Build approval transaction with unlimited allowance
     */
    buildUnlimitedApprovalTransaction(tokenAddress: string, spenderAddress: string, userAddress: string): ApprovalTransaction;
    /**
     * Build approval transactions for all tokens in path
     */
    buildPathApprovals(path: string[], spenderAddress: string, _amount: string, userAddress: string): ApprovalTransaction[];
    /**
     * Check if approval is needed
     */
    needsApproval(tokenAddress: string, spenderAddress: string, userAddress: string, requiredAmount: string): Promise<boolean>;
    /**
     * Encode split swap transaction
     */
    private _encodeSplitSwap;
    /**
     * Estimate gas for a transaction
     */
    private _estimateGas;
    /**
     * Decode revert reason from failed transaction
     */
    decodeRevertReason(txHash: string): Promise<string | null>;
    /**
     * Validate transaction before submission
     */
    validateTransaction(tx: SwapTransaction): {
        valid: boolean;
        errors: string[];
    };
    /**
     * Get current gas price
     */
    getGasPrice(): Promise<{
        standard: string;
        fast: string;
        instant: string;
    }>;
    /**
     * Check current allowance for a token
     */
    private _checkAllowance;
    /**
     * Build an approval transaction
     */
    private _buildApprovalTransaction;
    /**
     * Build swap transaction with automatic approval if needed
     */
    buildSwapTransactionWithApproval(quote: Quote, userAddress: string): Promise<{
        approval?: ApprovalTransaction;
        swap: SwapTransaction;
    }>;
    /**
     * Build swap transaction without gas estimation (used when approval is needed)
     */
    private _buildSwapTransactionWithoutGasEstimation;
}
//# sourceMappingURL=TransactionBuilder.d.ts.map