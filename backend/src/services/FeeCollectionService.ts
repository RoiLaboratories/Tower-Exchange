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

  // FeeCollector ABI for fee collection and distribution
  private readonly FEE_COLLECTOR_ABI = [
    'function collectFeeAndDistribute(address token, uint256 totalAmount, uint256 feeBps, address recipient) external',
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
   * Submit platform fee with atomic distribution using collectFeeAndDistribute
   * Called after swap completes: routes full output through FeeCollector
   * FeeCollector splits fee and sends remainder to user atomically
   *
   * @param outputToken Address of the output token
   * @param totalAmount Full swap output amount (before fee deduction)
   * @param feeBps Fee in basis points (e.g., 25 = 0.25%)
   * @param userAddress User wallet to receive (totalAmount - fee)
   * @returns FeeCollectionResult with transaction details
   */
  async submitFee(
    outputToken: string,
    totalAmount: string,
    feeBps: number = 25,  // Default 0.25%
    userAddress?: string  // Optional: if provided, uses collectFeeAndDistribute
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

      if (!totalAmount || ethers.BigNumber.from(totalAmount).isZero()) {
        throw new Error('Total amount must be greater than 0');
      }

      if (feeBps < 0 || feeBps > 10000) {
        throw new Error('Fee basis points must be between 0 and 10000');
      }

      const totalAmountBN = ethers.BigNumber.from(totalAmount);

      // Create FeeCollector contract instance
      const feeCollector = new ethers.Contract(
        this.config.feeCollectorAddress,
        this.FEE_COLLECTOR_ABI,
        this.backendWallet
      );

      // If userAddress is provided, use atomic collectFeeAndDistribute
      if (userAddress && ethers.utils.isAddress(userAddress)) {
        console.log('[FeeCollectionService] Using atomic collectFeeAndDistribute:', {
          outputToken,
          totalAmount,
          feeBps,
          userAddress,
          feeCollectorAddress: this.config.feeCollectorAddress,
          backendAddress: this.backendWallet.address,
        });

        // Calculate expected fee amount for logging
        const feeAmountBN = totalAmountBN.mul(feeBps).div(10000);
        const userAmountBN = totalAmountBN.sub(feeAmountBN);

        console.log('[FeeCollectionService] Fee breakdown:', {
          totalAmount: totalAmountBN.toString(),
          feeAmount: feeAmountBN.toString(),
          userAmount: userAmountBN.toString(),
          feePercentage: (feeBps / 100).toFixed(2) + '%',
        });

        // Submit atomic fee collection and distribution
        console.log('[FeeCollectionService] Submitting collectFeeAndDistribute transaction...');
        const collectFeeTx = await feeCollector.collectFeeAndDistribute(
          outputToken,
          totalAmountBN,
          feeBps,
          userAddress
        );
        console.log('[FeeCollectionService] collectFeeAndDistribute transaction sent:', collectFeeTx.hash);

        // Wait for confirmation
        const receipt = await collectFeeTx.wait();

        if (!receipt || receipt.status !== 1) {
          throw new Error('Fee collection and distribution transaction failed');
        }

        console.log('[FeeCollectionService] Atomic fee collection successful:', {
          transactionHash: collectFeeTx.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          feeAmount: feeAmountBN.toString(),
        });

        return {
          success: true,
          transactionHash: collectFeeTx.hash,
          outputToken,
          feeAmount: feeAmountBN.toString(),
          blockNumber: receipt.blockNumber,
        };
      } else {
        // Fallback to old collectFee method for backward compatibility
        console.log('[FeeCollectionService] Using legacy collectFee (backward compatibility):', {
          outputToken,
          totalAmount,
          feeCollectorAddress: this.config.feeCollectorAddress,
        });

        // Calculate fee amount from total
        const feeAmountBN = totalAmountBN.mul(feeBps).div(10000);

        // First, approve FeeCollector to pull tokens
        const IERC20_APPROVE_ABI = ['function approve(address spender, uint256 amount) returns (bool)'];
        const tokenContract = new ethers.Contract(outputToken, IERC20_APPROVE_ABI, this.backendWallet);
        const maxUint256 = ethers.constants.MaxUint256;

        console.log('[FeeCollectionService] Checking approval...');
        const approveTx = await tokenContract.approve(this.config.feeCollectorAddress, maxUint256);
        console.log('[FeeCollectionService] Approval transaction sent:', approveTx.hash);
        await approveTx.wait();
        console.log('[FeeCollectionService] Approval confirmed');

        // Submit the legacy fee collection transaction
        console.log('[FeeCollectionService] Submitting collectFee transaction...');
        const collectFeeTx = await feeCollector.collectFee(outputToken, feeAmountBN);
        console.log('[FeeCollectionService] collectFee transaction sent:', collectFeeTx.hash);

        // Wait for confirmation
        const receipt = await collectFeeTx.wait();

        if (!receipt || receipt.status !== 1) {
          throw new Error('Fee collection transaction failed');
        }

        console.log('[FeeCollectionService] Fee collected successfully (legacy mode):', {
          transactionHash: collectFeeTx.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
        });

        return {
          success: true,
          transactionHash: collectFeeTx.hash,
          outputToken,
          feeAmount: feeAmountBN.toString(),
          blockNumber: receipt.blockNumber,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[FeeCollectionService] Fee submission failed:', errorMessage);

      const feeAmountBN = ethers.BigNumber.from(totalAmount).mul(feeBps).div(10000);
      return {
        success: false,
        outputToken,
        feeAmount: feeAmountBN.toString(),
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
