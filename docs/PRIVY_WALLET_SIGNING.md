# Implementing Wallet Signature with Privy

## Current Status
The recurring orders feature is set up and working, but the wallet signature prompt is **not yet integrated**. The message is prepared and logged, but the user's wallet is not prompted to sign.

## How to Access Recurring Orders

Navigate to the page using one of these methods:

### 1. Via Header Navigation
- Click **"Recurring Orders"** in the top navigation menu
- URL: `/recurring-orders`

### 2. Direct URL
- Type in address bar: `http://localhost:3000/recurring-orders`

### 3. Programmatic Navigation
```typescript
import { useRouter } from "next/navigation";
const router = useRouter();
router.push("/recurring-orders");
```

## Implementing Wallet Signing

### Step 1: Check Privy's Current API

First, check what signing methods are available in your version of Privy:

```typescript
import { usePrivy } from "@privy-io/react-auth";

const MyComponent = () => {
  const privy = usePrivy();
  
  // Log all available methods
  console.log("Privy methods:", Object.keys(privy));
};
```

Look for methods like:
- `signMessage()` - Sign arbitrary messages
- `getEmbeddedWallet()` - Access embedded wallet methods
- `sendTransaction()` - Sign and send transactions

### Step 2: Add Signing to RecurringBuys.tsx

Update the `handleContinue` function:

```typescript
import { usePrivy } from "@privy-io/react-auth";

export const RecurringBuys = () => {
  const { user } = usePrivy();
  const privy = usePrivy(); // Get full Privy object

  const handleContinue = async () => {
    // ... validation code ...

    try {
      const message = `I authorize Tower Finance to set up a recurring ${frequency} 
${selectedPayToken.symbol} → ${selectedBuyToken.symbol} buy order for ${amount} 
${selectedPayToken.symbol}`;

      let signature: string | undefined;

      // Option 1: Using signMessage (if available)
      if (privy.signMessage) {
        try {
          signature = await privy.signMessage(message);
          console.log("✅ Message signed by wallet:", signature);
        } catch (signError) {
          console.warn("Signing failed:", signError);
          // Proceed without signature or throw error
        }
      }

      // Option 2: Using embedded wallet (if signMessage not available)
      if (!signature && privy.getEmbeddedWallet) {
        try {
          const wallet = await privy.getEmbeddedWallet();
          if (wallet.signMessage) {
            signature = await wallet.signMessage(message);
            console.log("✅ Message signed by embedded wallet:", signature);
          }
        } catch (err) {
          console.warn("Embedded wallet signing failed:", err);
        }
      }

      // Step 2: Create the order
      const order = await createRecurringOrder(
        walletAddress,
        "buy",
        selectedPayToken.symbol,
        selectedBuyToken.symbol,
        parseFloat(amount),
        frequency,
        endDate,
        signature // Pass signature if available
      );

      // Reset form and show success
      setSelectedBuyToken(null);
      setAmount("10.00");
      setFrequency("Weekly");
      setEndDate("01/22/2026");

      alert(`Recurring buy order created! Orders will execute ${frequency.toLowerCase()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create recurring buy order");
    } finally {
      setIsLoading(false);
    }
  };
};
```

### Step 3: Update Service to Store Signature

Update `lib/recurringOrderService.ts`:

```typescript
export const createRecurringOrder = async (
  walletAddress: string,
  orderType: "buy" | "sell",
  sourceToken: string,
  targetToken: string,
  amount: number,
  frequency: string,
  endDate?: string,
  signature?: string // Add signature parameter
): Promise<RecurringOrder> => {
  const { data, error } = await supabase
    .from("recurring_orders")
    .insert({
      wallet_address: walletAddress,
      order_type: orderType,
      source_token: sourceToken,
      target_token: targetToken,
      amount,
      frequency,
      start_date: new Date().toISOString(),
      end_date: endDate ? new Date(endDate).toISOString() : null,
      next_execution_date: calculateNextExecutionDate(frequency),
      is_active: true,
      signature, // Store if provided
      authorized_at: signature ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    const errorMessage = error?.message || JSON.stringify(error) || "Unknown error";
    throw new Error(`Failed to create recurring order: ${errorMessage}`);
  }

  if (!data) {
    throw new Error("Failed to create recurring order: No data returned from database");
  }

  return data;
};
```

### Step 4: Update Database Schema (Optional)

Add signature fields to recurring_orders table in Supabase:

```sql
ALTER TABLE recurring_orders 
ADD COLUMN signature TEXT,
ADD COLUMN authorized_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_recurring_signature ON recurring_orders(signature);
```

## Wallet Signing Flow

```
User Creates Order
       ↓
Message Prepared (e.g., "I authorize Tower Finance...")
       ↓
"Continue" Button Clicked
       ↓
[WALLET PROMPTS USER TO SIGN] ← This is what we're implementing
       ↓
User Approves/Rejects in Wallet
       ↓
If Approved:
  - Signature obtained
  - Order saved with signature
  - Form resets
  - Success message shown
       ↓
If Rejected:
  - Error shown to user
  - Form remains intact
```

## Testing Without Wallet Signing

The feature currently **works without wallet signatures**. This is useful for testing:

1. Create a recurring order
2. Check it appears in "View Orders" tab
3. Click to see details
4. Try canceling it

Once Privy signing is integrated, the wallet will prompt before step 2.

## Debugging Wallet Signing

If you implement signing and it doesn't work:

```typescript
// Add logging to see what's available
const privy = usePrivy();
console.log("Privy object keys:", Object.keys(privy));
console.log("User:", privy.user);
console.log("Authenticated:", privy.authenticated);
console.log("Has signMessage?", typeof privy.signMessage);

// Test signing
if (privy.signMessage) {
  try {
    const sig = await privy.signMessage("Test message");
    console.log("✅ Signing works! Signature:", sig);
  } catch (err) {
    console.error("❌ Signing failed:", err);
  }
}
```

## Expected Behavior After Implementation

1. User creates order
2. Clicks "Continue"
3. **Wallet opens signature request**
4. User approves (or rejects)
5. If approved:
   - Order saved with signature
   - Success message shown
   - Form resets
   - Order appears in dashboard
6. If rejected:
   - Error message shown
   - Form unchanged

## References

- [Privy Documentation](https://docs.privy.io/)
- [Sign Message Guide](https://docs.privy.io/guide/applications/embedded-wallets/signing-data)
- [Recurring Orders Components](../components/reusable/RecurringBuys.tsx)
- [Recurring Orders Service](../lib/recurringOrderService.ts)

## Next Steps

1. Check Privy docs for available signing methods
2. Implement signing in both RecurringBuys and RecurringSell
3. Test with your wallet
4. (Optional) Add signature storage to database

The core feature works without signatures - this just adds wallet confirmation!
