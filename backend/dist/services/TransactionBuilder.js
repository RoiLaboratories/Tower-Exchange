"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionBuilder = void 0;
const ethers_1 = require("ethers");
const helpers_1 = require("../utils/helpers");
const tokenRegistry_1 = require("../utils/tokenRegistry");
const platformFeeConfig_1 = require("../config/platformFeeConfig");
// ERC20 ABI for allowance and approval
const ERC20_ABI = [
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
];
/**
 * TransactionBuilder
 * Builds executable transactions for swaps on Arc testnet
 */
class TransactionBuilder {
    constructor(config, provider) {
        this.config = config;
        this.provider = provider;
    }
    /**
     * Build swap transaction from a quote
     */
    async buildSwapTransaction(quote, userAddress) {
        try {
            helpers_1.AddressUtils.toChecksum(userAddress);
            const deadline = Math.floor(Date.now() / 1000) + 30 * 60; // 30 minutes
            // Convert amounts from 18 decimals to native token decimals
            const inputTokenInfo = (0, tokenRegistry_1.getTokenByAddress)(quote.inputToken);
            const outputTokenInfo = (0, tokenRegistry_1.getTokenByAddress)(quote.outputToken);
            const inputDecimals = inputTokenInfo?.decimals || 18;
            const outputDecimals = outputTokenInfo?.decimals || 18;
            // Convert inputAmount from 18 decimals to native decimals
            const inputAmountBN = ethers_1.ethers.BigNumber.from(quote.inputAmount);
            const decimalsMultiplierIn = 18 - inputDecimals;
            const nativeInputAmount = decimalsMultiplierIn > 0
                ? inputAmountBN.div(ethers_1.ethers.BigNumber.from(10).pow(decimalsMultiplierIn)).toString()
                : inputAmountBN.mul(ethers_1.ethers.BigNumber.from(10).pow(-decimalsMultiplierIn)).toString();
            // Convert minOut from 18 decimals to native decimals
            const minOutBN = ethers_1.ethers.BigNumber.from(quote.minOut);
            const decimalsMultiplierOut = 18 - outputDecimals;
            const nativeMinOut = decimalsMultiplierOut > 0
                ? minOutBN.div(ethers_1.ethers.BigNumber.from(10).pow(decimalsMultiplierOut)).toString()
                : minOutBN.mul(ethers_1.ethers.BigNumber.from(10).pow(-decimalsMultiplierOut)).toString();
            console.log('[TransactionBuilder] Converted amounts to native decimals:', {
                inputToken: quote.inputToken,
                inputDecimals,
                inputAmount18: quote.inputAmount,
                inputAmountNative: nativeInputAmount,
                outputToken: quote.outputToken,
                outputDecimals,
                minOut18: quote.minOut,
                minOutNative: nativeMinOut,
            });
            // Encode the swap call based on route type
            let data;
            let targetAddress;
            let platformFeeAmount;
            let expectedUserOutput;
            // Check if input is native USDC - requires direct DEX call (no TowerRouter intermediary)
            const NATIVE_USDC = '0x3600000000000000000000000000000000000000';
            const isNativeUSDC = quote.inputToken.toLowerCase() === NATIVE_USDC.toLowerCase();
            if (quote.route.type === 'single' || quote.route.type === 'multi') {
                const hopData = quote.route.hops[0];
                if (!hopData) {
                    throw new Error('No hops found in route');
                }
                console.log('[TransactionBuilder] Building swap transaction:', {
                    dexName: hopData.dexName,
                    dexRouter: hopData.dexRouter,
                    inputToken: quote.inputToken,
                    outputToken: quote.outputToken,
                    route_type: quote.route.type,
                    isNativeUSDC,
                });
                if (isNativeUSDC) {
                    // For native USDC: encode direct DEX router call (user approved DEX router directly)
                    // Platform fee is collected from output after swap executes
                    console.log('[TransactionBuilder] Native USDC detected - calling DEX router directly (no TowerRouter)');
                    // Calculate platform fee based on configured fee percentage (default 0.25%)
                    const expectedOutputBN = ethers_1.ethers.BigNumber.from(quote.outputAmount);
                    const platformFeeBps = (0, platformFeeConfig_1.getPlatformFeeBps)();
                    const platformFee18 = expectedOutputBN.mul(platformFeeBps).div(10000);
                    // Convert fee to native decimals for tracking
                    platformFeeAmount = decimalsMultiplierOut > 0
                        ? platformFee18.div(ethers_1.ethers.BigNumber.from(10).pow(decimalsMultiplierOut)).toString()
                        : platformFee18.toString();
                    // Calculate expected user output after fee (in 18 decimals)
                    const expectedUserOutput18 = expectedOutputBN.sub(platformFee18);
                    // Convert to native decimals
                    expectedUserOutput = decimalsMultiplierOut > 0
                        ? expectedUserOutput18.div(ethers_1.ethers.BigNumber.from(10).pow(decimalsMultiplierOut)).toString()
                        : expectedUserOutput18.toString();
                    // For DEX router calls, encode based on DEX type
                    const path = quote.route.hops.map(h => h.path).flat();
                    targetAddress = hopData.dexRouter;
                    // XyloNet uses tuple-based swap interface: swap(tuple(address, address, uint256, uint256, address, uint256))
                    const isXyloNet = hopData.dexName?.toLowerCase().includes('xylonet') ||
                        targetAddress.toLowerCase() === '0x73742278c31a76dBb0D2587d03ef92E6E2141023'.toLowerCase();
                    if (isXyloNet) {
                        console.log('[TransactionBuilder] Detected XyloNet - using tuple-based swap encoding');
                        data = helpers_1.EncodingUtils.encodeXyloRouterSwap(path[0], // tokenIn
                        path[path.length - 1], // tokenOut
                        nativeInputAmount, nativeMinOut, userAddress, deadline);
                    }
                    else {
                        // Other DEXes use standard IDexRouter interface: swap(address, address, uint256, uint256, address, uint256)
                        data = helpers_1.EncodingUtils.encodeIDexRouterSwap(path[0], // tokenIn
                        path[path.length - 1], // tokenOut
                        nativeInputAmount, nativeMinOut, userAddress, deadline);
                    }
                    // Store fee info to be included in transaction return
                    console.log('[TransactionBuilder] Native USDC platform fee:', {
                        expectedOutput18: quote.outputAmount,
                        expectedOutputNative: nativeMinOut,
                        platformFee18: platformFee18.toString(),
                        platformFeeAmount,
                        expectedUserOutput18: expectedUserOutput18.toString(),
                        expectedUserOutput,
                    });
                }
                else {
                    // For other tokens: route through TowerRouter for fee collection
                    console.log('[TransactionBuilder] Routing through TowerRouter for fee collection');
                    data = helpers_1.EncodingUtils.encodeTowerRouterSwap(nativeInputAmount, nativeMinOut, quote.route.hops.map(h => h.path).flat(), // Flattened path
                    userAddress, deadline, hopData.dexRouter // Pass the actual DEX router to TowerRouter
                    );
                    targetAddress = this.config.towerRouterAddress;
                }
            }
            else {
                // Split route handling
                console.log('[TransactionBuilder] Using split route encoding');
                data = this._encodeSplitSwap(quote, userAddress, deadline);
                targetAddress = this.config.towerRouterAddress;
            }
            // Always send to determined target address
            // For native USDC: this is the DEX router
            // For others: this is TowerRouter
            // Estimate gas based on CORRECT target router
            const gasEstimate = await this._estimateGas(targetAddress, data);
            const tx = {
                to: targetAddress,
                data,
                value: '0',
                from: userAddress,
                gasLimit: gasEstimate.toString(),
                chainId: this.config.chainId,
                ...(platformFeeAmount && { platformFeeAmount }),
                ...(expectedUserOutput && { expectedUserOutput }),
            };
            console.log('[TransactionBuilder] Built swap transaction:', {
                to: tx.to,
                from: tx.from,
                dataLength: tx.data?.length || 0,
                value: tx.value,
                gasLimit: tx.gasLimit,
            });
            return tx;
        }
        catch (error) {
            console.error('Error building swap transaction:', error);
            throw error;
        }
    }
    /**
     * Build approval transaction for a token
     */
    buildApprovalTransaction(tokenAddress, spenderAddress, amount, userAddress) {
        try {
            const data = helpers_1.EncodingUtils.encodeApprove(spenderAddress, amount);
            return {
                to: tokenAddress,
                data,
                from: userAddress,
                gasLimit: '100000',
            };
        }
        catch (error) {
            console.error('Error building approval transaction:', error);
            throw error;
        }
    }
    /**
     * Build approval transaction with unlimited allowance
     */
    buildUnlimitedApprovalTransaction(tokenAddress, spenderAddress, userAddress) {
        const maxUint256 = ethers_1.ethers.constants.MaxUint256.toString();
        return this.buildApprovalTransaction(tokenAddress, spenderAddress, maxUint256, userAddress);
    }
    /**
     * Build approval transactions for all tokens in path
     */
    buildPathApprovals(path, spenderAddress, _amount, userAddress) {
        const approvals = [];
        // Only approve the first token (input token)
        if (path.length > 0) {
            approvals.push(this.buildUnlimitedApprovalTransaction(path[0], spenderAddress, userAddress));
        }
        return approvals;
    }
    /**
     * Check if approval is needed
     */
    async needsApproval(tokenAddress, spenderAddress, userAddress, requiredAmount) {
        try {
            const erc20 = new ethers_1.ethers.Contract(tokenAddress, ['function allowance(address owner, address spender) view returns (uint256)'], this.provider);
            const allowance = await erc20.allowance(userAddress, spenderAddress);
            return ethers_1.ethers.BigNumber.from(allowance).lt(ethers_1.ethers.BigNumber.from(requiredAmount));
        }
        catch (error) {
            console.error('Error checking approval:', error);
            return true; // Default to true if we can't check
        }
    }
    /**
     * Encode split swap transaction
     */
    _encodeSplitSwap(quote, userAddress, deadline) {
        // For split swaps, we encode a special call to TowerRouter.swapWithSplit
        const iface = new ethers_1.ethers.utils.Interface([
            `function swapWithSplit(
        tuple(address[] path, uint256 amountIn, uint256 minAmountOut, address router)[] splits,
        address tokenOut,
        uint256 minAmountOut,
        address to,
        uint256 deadline
      ) returns (uint256)`,
        ]);
        const splits = quote.route.hops.map((hop) => ({
            path: hop.path,
            amountIn: hop.amountIn,
            minAmountOut: ethers_1.ethers.BigNumber.from(hop.amountOut)
                .mul(9750) // 2.5% slippage
                .div(10000)
                .toString(),
            router: hop.dexRouter,
        }));
        return iface.encodeFunctionData('swapWithSplit', [
            splits,
            quote.outputToken,
            quote.minOut,
            userAddress,
            deadline,
        ]);
    }
    /**
     * Estimate gas for a transaction
     */
    async _estimateGas(to, data) {
        try {
            const gasEstimate = await this.provider.estimateGas({
                to,
                data,
                value: '0',
            });
            // Add 20% buffer for safety
            return gasEstimate.mul(120).div(100).toString();
        }
        catch (error) {
            console.warn('Gas estimation failed, using default:', error);
            // Return sensible default based on transaction complexity
            return '500000';
        }
    }
    /**
     * Decode revert reason from failed transaction
     */
    async decodeRevertReason(txHash) {
        try {
            const response = await this.provider.call({
                to: txHash,
                data: '',
            });
            // Parse error message from response
            const errorSig = response.slice(0, 10);
            if (errorSig === '0x08c379a0') {
                // Standard 'Error(string)' encoding
                const decodedParams = ethers_1.ethers.utils.defaultAbiCoder.decode(['string'], '0x' + response.slice(10));
                return decodedParams[0];
            }
            return null;
        }
        catch (error) {
            console.error('Error decoding revert reason:', error);
            return null;
        }
    }
    /**
     * Validate transaction before submission
     */
    validateTransaction(tx) {
        const errors = [];
        if (!ethers_1.ethers.utils.isAddress(tx.to)) {
            errors.push('Invalid recipient address');
        }
        if (!ethers_1.ethers.utils.isAddress(tx.from)) {
            errors.push('Invalid sender address');
        }
        if (!tx.data.startsWith('0x')) {
            errors.push('Invalid transaction data (must start with 0x)');
        }
        if (tx.chainId !== this.config.chainId) {
            errors.push(`Invalid chain ID. Expected ${this.config.chainId}, got ${tx.chainId}`);
        }
        try {
            ethers_1.ethers.BigNumber.from(tx.gasLimit);
        }
        catch {
            errors.push('Invalid gas limit');
        }
        return {
            valid: errors.length === 0,
            errors,
        };
    }
    /**
     * Get current gas price
     */
    async getGasPrice() {
        try {
            const feeData = await this.provider.getFeeData();
            return {
                standard: feeData.gasPrice?.mul(100).div(100).toString() || '0',
                fast: feeData.gasPrice?.mul(120).div(100).toString() || '0',
                instant: feeData.gasPrice?.mul(150).div(100).toString() || '0',
            };
        }
        catch (error) {
            console.warn('Error getting gas price:', error);
            return {
                standard: '0',
                fast: '0',
                instant: '0',
            };
        }
    }
    /**
     * Check current allowance for a token
     */
    async _checkAllowance(tokenAddress, ownerAddress, spenderAddress) {
        try {
            const token = new ethers_1.ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
            const allowance = await token.allowance(ownerAddress, spenderAddress);
            return allowance.toString();
        }
        catch (error) {
            console.error(`Error checking allowance for ${tokenAddress}:`, error);
            return '0';
        }
    }
    /**
     * Build an approval transaction
     */
    _buildApprovalTransaction(tokenAddress, spenderAddress, userAddress, amount = ethers_1.ethers.constants.MaxUint256.toString()) {
        const iface = new ethers_1.ethers.utils.Interface(ERC20_ABI);
        const data = iface.encodeFunctionData('approve', [spenderAddress, amount]);
        return {
            to: tokenAddress,
            data,
            from: userAddress,
            gasLimit: '100000', // Standard approval gas limit
        };
    }
    /**
     * Build swap transaction with automatic approval if needed
     */
    async buildSwapTransactionWithApproval(quote, userAddress) {
        // Check if input is native USDC - requires special handling
        const NATIVE_USDC = '0x3600000000000000000000000000000000000000';
        const isNativeUSDC = quote.inputToken.toLowerCase() === NATIVE_USDC.toLowerCase();
        // Determine spender address
        // For native USDC: approve the DEX router directly (not TowerRouter)
        // For other tokens: approve TowerRouter which will handle the transfer
        let spenderAddress = this.config.towerRouterAddress;
        if (isNativeUSDC) {
            // For native USDC, approve the DEX router directly
            const hopData = quote.route.hops[0];
            if (!hopData) {
                throw new Error('No routing information for native USDC swap');
            }
            spenderAddress = hopData.dexRouter;
            console.log('[TransactionBuilder] Native USDC detected - approving DEX router instead of TowerRouter:', {
                inputToken: quote.inputToken,
                dexRouter: spenderAddress,
            });
        }
        // Check current allowance FIRST, before attempting gas estimation
        const currentAllowance = await this._checkAllowance(quote.inputToken, userAddress, spenderAddress);
        // Convert quote.inputAmount from 18 decimals to native decimals for comparison
        const inputTokenInfo = (0, tokenRegistry_1.getTokenByAddress)(quote.inputToken);
        const inputDecimals = inputTokenInfo?.decimals || 18;
        const inputAmountBN = ethers_1.ethers.BigNumber.from(quote.inputAmount);
        const decimalsMultiplier = 18 - inputDecimals;
        const nativeInputAmount = decimalsMultiplier > 0
            ? inputAmountBN.div(ethers_1.ethers.BigNumber.from(10).pow(decimalsMultiplier)).toString()
            : inputAmountBN.mul(ethers_1.ethers.BigNumber.from(10).pow(-decimalsMultiplier)).toString();
        const needsApproval = ethers_1.ethers.BigNumber.from(currentAllowance).lt(nativeInputAmount);
        console.log(`[TransactionBuilder] Checking allowance for ${quote.inputToken}:`, {
            owner: userAddress,
            spender: spenderAddress,
            currentAllowance,
            requiredAmountNative: nativeInputAmount,
            requiredAmount18: quote.inputAmount,
            needsApproval,
        });
        // Build the swap transaction - skip gas estimation if approval is needed
        // (Gas estimation will fail without approval, so we use a default)
        let swapTx;
        if (needsApproval) {
            console.log(`[TransactionBuilder] Approval needed - skipping gas estimation, using default`);
            swapTx = await this._buildSwapTransactionWithoutGasEstimation(quote, userAddress);
        }
        else {
            console.log(`[TransactionBuilder] Approval exists - performing gas estimation`);
            swapTx = await this.buildSwapTransaction(quote, userAddress);
        }
        // If allowance is insufficient, build approval transaction
        if (needsApproval) {
            console.log(`[TransactionBuilder] Building approval transaction for ${quote.inputToken}`);
            const approvalTx = this._buildApprovalTransaction(quote.inputToken, spenderAddress, userAddress, ethers_1.ethers.constants.MaxUint256.toString() // Approve unlimited for convenience
            );
            return {
                approval: approvalTx,
                swap: swapTx,
            };
        }
        // No approval needed
        console.log(`[TransactionBuilder] No approval needed, sufficient allowance exists`);
        return {
            swap: swapTx,
        };
    }
    /**
     * Build swap transaction without gas estimation (used when approval is needed)
     */
    async _buildSwapTransactionWithoutGasEstimation(quote, userAddress) {
        try {
            helpers_1.AddressUtils.toChecksum(userAddress);
            const deadline = Math.floor(Date.now() / 1000) + 30 * 60; // 30 minutes
            // Convert amounts from 18 decimals to native token decimals
            const inputTokenInfo = (0, tokenRegistry_1.getTokenByAddress)(quote.inputToken);
            const outputTokenInfo = (0, tokenRegistry_1.getTokenByAddress)(quote.outputToken);
            const inputDecimals = inputTokenInfo?.decimals || 18;
            const outputDecimals = outputTokenInfo?.decimals || 18;
            // Convert inputAmount from 18 decimals to native decimals
            const inputAmountBN = ethers_1.ethers.BigNumber.from(quote.inputAmount);
            const decimalsMultiplierIn = 18 - inputDecimals;
            const nativeInputAmount = decimalsMultiplierIn > 0
                ? inputAmountBN.div(ethers_1.ethers.BigNumber.from(10).pow(decimalsMultiplierIn)).toString()
                : inputAmountBN.mul(ethers_1.ethers.BigNumber.from(10).pow(-decimalsMultiplierIn)).toString();
            // Convert minOut from 18 decimals to native decimals
            const minOutBN = ethers_1.ethers.BigNumber.from(quote.minOut);
            const decimalsMultiplierOut = 18 - outputDecimals;
            const nativeMinOut = decimalsMultiplierOut > 0
                ? minOutBN.div(ethers_1.ethers.BigNumber.from(10).pow(decimalsMultiplierOut)).toString()
                : minOutBN.mul(ethers_1.ethers.BigNumber.from(10).pow(-decimalsMultiplierOut)).toString();
            // Encode the swap call based on route type
            let data;
            if (quote.route.type === 'single' || quote.route.type === 'multi') {
                const hopData = quote.route.hops[0];
                if (!hopData) {
                    throw new Error('No hops found in route');
                }
                // All swaps route through TowerRouter for fee collection
                data = helpers_1.EncodingUtils.encodeTowerRouterSwap(nativeInputAmount, nativeMinOut, quote.route.hops.map(h => h.path).flat(), userAddress, deadline, hopData.dexRouter // Pass the actual DEX router to TowerRouter
                );
            }
            else {
                data = this._encodeSplitSwap(quote, userAddress, deadline);
            }
            // Always send to TowerRouter for fee collection
            const DEFAULT_SWAP_GAS = '500000';
            const tx = {
                to: this.config.towerRouterAddress,
                data,
                value: '0',
                from: userAddress,
                gasLimit: DEFAULT_SWAP_GAS,
                chainId: this.config.chainId,
            };
            console.log('[TransactionBuilder] Built swap transaction (no gas estimate):', {
                to: tx.to,
                from: tx.from,
                dataLength: tx.data?.length || 0,
                value: tx.value,
                gasLimit: tx.gasLimit,
                reason: 'approval pending',
            });
            return tx;
        }
        catch (error) {
            console.error('Error building swap transaction:', error);
            throw error;
        }
    }
}
exports.TransactionBuilder = TransactionBuilder;
//# sourceMappingURL=TransactionBuilder.js.map