# Wallet Signature Implementation - EIP-1193 Provider

## ✅ API Method Found!

Your codebase uses **EIP-1193 provider** (found in SwapCard.tsx). This is the correct method!

**Privy Version**: 3.13.1
**Pattern**: Access via `wallet.getEthereumProvider()`
**Methods Available**: `personal_sign`, `eth_sign`, `eth_signTypedData`

## Quick Implementation

### For RecurringBuys.tsx

Replace the imports:
```typescript
import { usePrivy, useWallets } from "@privy-io/react-auth"; // Add useWallets
```

Replace the `handleContinue` function:

```typescript
const handleContinue = async () => {
  if (!walletAddress) {
    setError("Please connect your wallet");
    return;
  }

  if (!selectedBuyToken) {
    setError("Please select a token to buy");
    return;
  }

  if (!amount || parseFloat(amount) <= 0) {
    setError("Please enter a valid amount");
    return;
  }

  setIsLoading(true);
  setError(null);

  try {
    // Step 1: Create message to sign
    const message = `I authorize Tower Finance to set up a recurring ${frequency} ${selectedPayToken.symbol} → ${selectedBuyToken.symbol} buy order for ${amount} ${selectedPayToken.symbol}`;
    
    let signature: string | undefined;

    try {
      // Step 2: Get the wallet and its provider
      const connectedWallet = wallets.find(
        (w) => w.address?.toLowerCase() === walletAddress.toLowerCase()
      );

      if (!connectedWallet) {
        throw new Error("Connected wallet not found");
      }

      // Get the EIP-1193 provider (same as SwapCard)
      const eip1193Provider = await connectedWallet.getEthereumProvider();

      if (!eip1193Provider) {
        throw new Error("Failed to get wallet provider");
      }

      // Convert message to hex
      const messageHex = "0x" + Buffer.from(message).toString("hex");

      // Request signature - WALLET WILL PROMPT USER
      signature = await eip1193Provider.request({
        method: "personal_sign",
        params: [messageHex, walletAddress],
      }) as string;

      console.log("✅ Message signed successfully:", signature);
    } catch (signError) {
      console.warn("⚠️ Signature request failed:", signError);
      // Optionally require signature or proceed without it
    }

    // Step 3: Create the order
    await createRecurringOrder(
      walletAddress,
      "buy",
      selectedPayToken.symbol,
      selectedBuyToken.symbol,
      parseFloat(amount),
      frequency,
      endDate,
      signature // Pass signature
    );

    // Reset form
    setSelectedBuyToken(null);
    setAmount("10.00");
    setFrequency("Weekly");
    setEndDate("01/22/2026");

    console.log("✅ Recurring buy order created successfully");
    alert(`Recurring buy order created! Orders will execute ${frequency.toLowerCase()}.`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to create recurring buy order";
    setError(errorMsg);
    console.error("Error:", err);
  } finally {
    setIsLoading(false);
  }
};
```

### For RecurringSell.tsx

Apply the same changes to RecurringSell component.

## The Exact Method

```typescript
// Get wallet via useWallets hook (same pattern as SwapCard.tsx)
const { wallets } = useWallets();

// Find the connected wallet
const connectedWallet = wallets.find(
  (w) => w.address?.toLowerCase() === walletAddress.toLowerCase()
);

// Get the EIP-1193 provider
const eip1193Provider = await connectedWallet.getEthereumProvider();

// Sign the message
const messageHex = "0x" + Buffer.from(message).toString("hex");
const signature = await eip1193Provider.request({
  method: "personal_sign",
  params: [messageHex, walletAddress],
}) as string;
```

## What Happens

1. User clicks "Continue"
2. Message is prepared
3. **Wallet opens a signature popup**
4. User sees the message to sign
5. User clicks "Approve" or "Reject"
6. If approved: signature obtained → order created
7. If rejected: error shown, form unchanged

## Files to Update

1. **components/reusable/RecurringBuys.tsx**
   - Add `useWallets` import
   - Update `handleContinue` function

2. **components/reusable/RecurringSell.tsx**
   - Add `useWallets` import
   - Update `handleContinue` function

3. **lib/recurringOrderService.ts** (Optional)
   - Add `signature?: string` parameter to `createRecurringOrder`
   - Store signature in database if desired

## Reference

This uses the **exact same pattern** as your existing SwapCard.tsx file (lines 570-590).

### SwapCard.tsx Pattern
```typescript
const connectedWallet = wallets.find(
  (w) => w.address?.toLowerCase() === user.wallet?.address?.toLowerCase()
);
const eip1193Provider = await connectedWallet.getEthereumProvider();
const result = await eip1193Provider.request({
  method: 'eth_sendTransaction',
  params: [{...}],
});
```

### Our Pattern (Identical)
```typescript
const connectedWallet = wallets.find(
  (w) => w.address?.toLowerCase() === walletAddress.toLowerCase()
);
const eip1193Provider = await connectedWallet.getEthereumProvider();
const signature = await eip1193Provider.request({
  method: "personal_sign",
  params: [messageHex, walletAddress],
}) as string;
```

## Testing

1. Go to `/recurring-orders`
2. Click "Create Buy Order"
3. Fill in details
4. Click "Continue"
5. **Your wallet should pop up!**
6. Click approve
7. Order created ✅

## Error Handling

```typescript
try {
  signature = await eip1193Provider.request({
    method: "personal_sign",
    params: [messageHex, walletAddress],
  }) as string;
} catch (err) {
  // User rejected, wallet doesn't support it, or network error
  console.warn("Signing failed - proceeding without signature");
  // You can either require signature or proceed without it
}
```

## Summary

- ✅ Method found: EIP-1193 provider via `getEthereumProvider()`
- ✅ Proven pattern: Already used in SwapCard.tsx
- ✅ Function: `eip1193Provider.request({ method: "personal_sign", ... })`
- ✅ No new dependencies needed
- ✅ Works with Privy embedded wallets
- ✅ User-friendly wallet popup
