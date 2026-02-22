# Fee Collection Bug Fix - Critical Accumulation Issue

## Problem Identified
The FeeCollector contract had a critical bug where fees were replacing previous balances instead of accumulating correctly. When multiple swap transactions occurred, the accounting failed, causing:
- Previous accumulated fees to become untraceable on-chain
- New fees overwriting historical records
- Loss of audit trail for fee collection

## Root Cause
The `splitFeesInPlace()` function relied on the **contract's current balance** to calculate fees, rather than the **actual swap output amount**:

```solidity
// OLD (BUGGY) - Uses current balance instead of swap amount
uint256 totalAmount = tokenContract.balanceOf(address(this));
uint256 feeAmount = (totalAmount * feeBps) / 10000;
```

**Why this fails:**
1. Swap output is routed to FeeCollector contract
2. `splitFeesInPlace()` checks the entire contract balance
3. If timing issues occur or balance fluctuates, fee calculation becomes incorrect
4. Previous accumulated balance tracking gets corrupted

## Solution Implemented

### 1. **Updated FeeCollector.sol** 
Modified `splitFeesInPlace()` function signature to include the actual swap amount:

```solidity
// NEW (FIXED) - Takes exact swap amount as parameter
function splitFeesInPlace(
    address token,
    uint256 totalAmount,          // NEW: Actual swap output amount
    uint256 feeBps,
    address recipient
) external nonReentrant {
    // ... validations ...
    
    // Verify contract has the expected amount
    uint256 contractBalance = tokenContract.balanceOf(address(this));
    require(contractBalance >= totalAmount, "Insufficient tokens in contract");
    
    // Calculate fee from EXACT swap amount, not entire balance
    uint256 feeAmount = (totalAmount * feeBps) / 10000;
    uint256 userAmount = totalAmount - feeAmount;
    
    // Accumulate fee separately (preserves previous balances)
    accumulatedFees[token] += feeAmount;
    
    // Send user portion only
    tokenContract.safeTransfer(recipient, userAmount);
}
```

**Key improvements:**
- ✅ Takes explicit `totalAmount` parameter (exact swap output)
- ✅ Validates contract has sufficient tokens
- ✅ Calculates fees from precise swap amount (not entire balance)
- ✅ Properly accumulates fees: `accumulatedFees[token] += feeAmount`
- ✅ Preserves previous fee records in mapping

### 2. **Updated FeeCollectionService.ts**
Modified the service to pass the `totalAmount` parameter:

```typescript
// Updated ABI
'function splitFeesInPlace(address token, uint256 totalAmount, uint256 feeBps, address recipient) external'

// Updated function call
const splitFeeTx = await feeCollector.splitFeesInPlace(
  outputToken,
  totalAmountBN,    // NEW: Pass actual swap amount
  feeBps,
  userAddress
);
```

## How It Works Now (Correct Flow)

### Scenario: Multiple Consecutive Swaps

**Swap 1:**
- User swaps 1000 USDC → 10 ETH
- Expected output: 10 ETH
- Fee (0.25%): 0.025 ETH
- User receives: 9.975 ETH
- Contract state:
  - `accumulatedFees[ETH]` = 0.025 ✓
  - Contract balance: 0.025 ETH (fees only)

**Swap 2 (before fees withdrawn):**
- User swaps 500 USDC → 5 ETH  
- Expected output: 5 ETH
- Fee (0.25%): 0.0125 ETH
- User receives: 4.9875 ETH
- Contract state:
  - `accumulatedFees[ETH]` = 0.0375 ✓ (0.025 + 0.0125)
  - Contract balance: 0.0375 ETH
  - **Previous 0.025 ETH still tracked AND added to new fee**

**Treasury Withdrawal:**
- Calls `withdrawAllToTreasury()`
- Transfers 0.0375 ETH (all accumulated fees) ✓
- On-chain audit trail is complete and traceable ✓

## Verification Steps

After deploying the updated contracts, verify the fix with:

```typescript
// 1. Check accumulated fees for a token
const fees = await feeCollector.getAccumulatedFees(tokenAddress);
console.log('Accumulated fees:', fees.toString());

// 2. Check fee tokens tracked
const tokens = await feeCollector.getFeeTokens();
console.log('Tracked tokens:', tokens);

// 3. Withdraw fees to treasury
await feeCollector.withdrawAllToTreasury();

// 4. Verify fees were cleared
const feesAfter = await feeCollector.getAccumulatedFees(tokenAddress);
console.log('Fees after withdrawal:', feesAfter.toString()); // Should be 0
```

## Files Modified
1. **[contracts/contracts/FeeCollector.sol](contracts/contracts/FeeCollector.sol)** - Updated `splitFeesInPlace()` signature
2. **[backend/src/services/FeeCollectionService.ts](backend/src/services/FeeCollectionService.ts)** - Updated ABI and function call

## Deployment Notes
- **Breaking Change**: The `splitFeesInPlace()` function signature has changed
- Must redeploy FeeCollector contract with new code
- Update all frontend/backend code calling this function (already done)
- Existing accumulated fees in old contract cannot be migrated automatically
- Recommend clearing old contract state before new deployment

## Security Considerations
- Fee calculations now use explicit amounts (prevents accidental over/under-calculation)
- Contract balance validation ensures sufficient tokens exist
- On-chain fee records are now complete and auditable
- Mapping-based accumulation is atomic and reentrant-protected
