import { ethers } from 'ethers';
import { FeeCollectionResult, ArcTestnetConfig } from '../types';

/**
 * FeeCollectionService
 * Submits platform fees to FeeCollector contract after native USDC swaps
 *
 * Flow:
 * 1. Backend detects native USDC input in swap
 * 2. Swap builds with calculated platform fee (0.25% of output)
 * 3. User executes swap on chain
 * 4. FeeCollectionService.submitFee() is called
 * 5. Backend wallet submits collectFee() transaction to FeeCollector
 * 6. Fee is accumulated in FeeCollector for later treasury withdrawal
 */
export class FeeCollectionService {
  private config: ArcTestnetConfig;
  private provider: ethers.providers.Provider;
  private backendWallet: ethers.Wallet | null = null;

  // FeeCollector ABI for collectFee function
  private readonly FEE_COLLECTOR_ABI = [
    'function collectFee(address token, uint256 amount) external',
    'function getAccumulatedFees(address token) view returns (uint256)',
  ];

  constructor(config: ArcTestnetConfig, provider: ethers.providers.Provider) {
    this.config = config;
    this.provider = provider;

    // Initialize backend wallet if private key is available
    const backendPrivateKey = process.env.BACKEND_PRIVATE_KEY;
    if (backendPrivateKey) {
      this.backendWallet = new ethers.Wallet(backendPrivateKey, provider);
      console.log('[FeeCollectionService] Backend wallet initialized:', this.backendWallet.address);
    } else {
      console.warn('[FeeCollectionService] BACKEND_PRIVATE_KEY not set - fee collection will be unavailable');
    }
  }

  /**
   * Check if fee collection is available
   */
  isAvailable(): boolean {
    return this.backendWallet !== null && this.config.feeCollectorAddress !== undefined;
  }

  /**
   * Get backend wallet address
   */
  getBackendAddress(): string | null {
    return this.backendWallet?.address || null;
  }

  /**
   * Submit platform fee to FeeCollector contract
   *
   * @param outputToken Address of the output token (where fee is paid from)
   * @param feeAmount Fee amount in native token decimals
   * @returns FeeCollectionResult with transaction details
   */
  async submitFee(
    outputToken: string,
    feeAmount: string
  ): Promise<FeeCollectionResult> {
    try {
      // Validate inputs
      if (!this.backendWallet) {
        throw new Error('Backend wallet not initialized. Set BACKEND_PRIVATE_KEY in environment.');
      }

      if (!this.config.feeCollectorAddress) {
        throw new Error('FeeCollector address not configured. Set FEE_COLLECTOR_ADDRESS in config.');
      }

      if (!ethers.utils.isAddress(outputToken)) {
        throw new Error(`Invalid output token address: ${outputToken}`);
      }

      if (!feeAmount || ethers.BigNumber.from(feeAmount).isZero()) {
        throw new Error('Fee amount must be greater than 0');
      }

      console.log('[FeeCollectionService] Submitting fee:', {
        outputToken,
        feeAmount,
        feeCollectorAddress: this.config.feeCollectorAddress,
        backendAddress: this.backendWallet.address,
      });

      // Create FeeCollector contract instance
      const feeCollector = new ethers.Contract(
        this.config.feeCollectorAddress,
        this.FEE_COLLECTOR_ABI,
        this.backendWallet
      );

      // First, check if we need to approve the fee token to FeeCollector
      // (FeeCollector.collectFee uses safeTransferFrom)
      const IERC20_APPROVE_ABI = ['function approve(address spender, uint256 amount) returns (bool)'];
      const tokenContract = new ethers.Contract(outputToken, IERC20_APPROVE_ABI, this.backendWallet);

      const feeAmountBN = ethers.BigNumber.from(feeAmount);
      const maxUint256 = ethers.constants.MaxUint256;

      console.log('[FeeCollectionService] Checking approval...');
      // Approve FeeCollector to spend the output token
      const approveTx = await tokenContract.approve(this.config.feeCollectorAddress, maxUint256);
      console.log('[FeeCollectionService] Approval transaction sent:', approveTx.hash);
      await approveTx.wait();
      console.log('[FeeCollectionService] Approval confirmed');

      // Submit the fee collection transaction
      console.log('[FeeCollectionService] Submitting collectFee transaction...');
      const collectFeeTx = await feeCollector.collectFee(outputToken, feeAmountBN);
      console.log('[FeeCollectionService] collectFee transaction sent:', collectFeeTx.hash);

      // Wait for confirmation
      const receipt = await collectFeeTx.wait();

      if (!receipt || receipt.status !== 1) {
        throw new Error('Fee collection transaction failed');
      }

      console.log('[FeeCollectionService] Fee collected successfully:', {
        transactionHash: collectFeeTx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      });

      return {
        success: true,
        transactionHash: collectFeeTx.hash,
        outputToken,
        feeAmount,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[FeeCollectionService] Fee submission failed:', errorMessage);

      return {
        success: false,
        outputToken,
        feeAmount,
        error: errorMessage,
      };
    }
  }

  /**
   * Get accumulated fees for a token from FeeCollector
   *
   * @param token Address of the token
   * @returns Accumulated fee amount in native token decimals
   */
  async getAccumulatedFees(token: string): Promise<string> {
    try {
      if (!this.config.feeCollectorAddress) {
        throw new Error('FeeCollector address not configured');
      }

      const feeCollector = new ethers.Contract(
        this.config.feeCollectorAddress,
        this.FEE_COLLECTOR_ABI,
        this.provider
      );

      const accumulated = await feeCollector.getAccumulatedFees(token);
      return accumulated.toString();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[FeeCollectionService] Failed to get accumulated fees:', errorMessage);
      return '0';
    }
  }

  /**
   * Build a fee submission request (for manual submission later)
   * Useful for queuing fees and batch submitting
   *
   * @param outputToken Address of the output token
   * @param feeAmount Fee amount in native token decimals
   * @returns Object ready to be submitted later
   */
  buildFeeRequest(outputToken: string, feeAmount: string) {
    return {
      timestamp: new Date().toISOString(),
      outputToken,
      feeAmount,
      backendAddress: this.backendWallet?.address,
      feeCollectorAddress: this.config.feeCollectorAddress,
      chainId: this.config.chainId,
    };
  }
}
