# Recurring Orders - Wallet Signing & Dashboard

## Overview

This guide covers the two new features for recurring orders:
1. **Wallet Signing** - Users confirm orders by signing with their wallet
2. **Recurring Orders Dashboard** - View, manage, and cancel existing orders

## New Components

### 1. RecurringOrdersDashboard Component
**File:** [components/RecurringOrdersDashboard.tsx](../components/RecurringOrdersDashboard.tsx)

**Features:**
- View all recurring orders in a table
- Click to see detailed order information
- View execution history with status and transaction hashes
- Cancel orders before end date
- Real-time status indicators
- Color-coded frequency and status badges

**Key Functionality:**
```typescript
// Load user's recurring orders
const orders = await getRecurringOrders(walletAddress, false);

// Cancel an order
await cancelRecurringOrder(orderId);

// View execution history
const executions = await getOrderExecutions(orderId);
```

### 2. Recurring Orders Page
**File:** [app/recurring-orders/page.tsx](../app/recurring-orders/page.tsx)

**Tabs:**
- **View Orders** - Dashboard showing all recurring orders
- **Create Buy Order** - Form to create recurring buy order
- **Create Sell Order** - Form to create recurring sell order

## Wallet Signing Implementation

### Current State
The components prepare a signing message when the user clicks "Continue":

```typescript
const message = `I authorize Tower Finance to set up a recurring ${frequency} 
${selectedPayToken.symbol} → ${selectedBuyToken.symbol} buy order for ${amount} 
${selectedPayToken.symbol}`;
```

### Integration with Privy

To complete the wallet signing feature, you need to integrate Privy's signing capabilities:

**Step 1: Check Privy Documentation**
Privy provides several ways to get user signatures:
- `signMessage()` - Sign an arbitrary message
- `signTransaction()` - Sign a transaction
- `sendTransaction()` - Sign and broadcast a transaction

**Step 2: Update RecurringBuys.tsx**

Replace the signature section in `handleContinue`:

```typescript
import { usePrivy } from "@privy-io/react-auth";

export const RecurringBuys = () => {
  const { user, signMessage } = usePrivy(); // Import signMessage if available

  const handleContinue = async () => {
    // ... validation code ...

    try {
      // Step 1: Create message for signature
      const message = `I authorize Tower Finance to set up a recurring ${frequency} 
${selectedPayToken.symbol} → ${selectedBuyToken.symbol} buy order for ${amount} 
${selectedPayToken.symbol}`;

      // Step 2: Request wallet signature (if Privy supports it)
      if (signMessage) {
        const signature = await signMessage(message);
        console.log("Order authorized with signature:", signature);
      } else {
        console.warn("Wallet signing not available, proceeding without signature");
      }

      // Step 3: Create the order
      await createRecurringOrder(/* ... */);
    } catch (err) {
      // Handle errors
    }
  };
};
```

**Step 3: Update Recurring Orders Service**

Optionally store the signature in the database:

```typescript
// Add signature field to RecurringOrder interface
export interface RecurringOrder {
  // ... existing fields ...
  signature?: string; // Authorization signature from wallet
  authorized_at?: string; // When user authorized it
}

// Update createRecurringOrder to accept signature
export const createRecurringOrder = async (
  walletAddress: string,
  orderType: "buy" | "sell",
  sourceToken: string,
  targetToken: string,
  amount: number,
  frequency: string,
  endDate?: string,
  signature?: string // New parameter
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
      signature, // Store signature
      authorized_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    const errorMessage = error?.message || JSON.stringify(error) || "Unknown error";
    throw new Error(`Failed to create recurring order: ${errorMessage}`);
  }

  return data;
};
```

## Dashboard Features

### View Orders
The main dashboard displays all your recurring orders in a table with:
- **Order Type**: BUY or SELL badge (green/red)
- **Trading Pair**: e.g., USDC → ETH
- **Amount**: Amount per execution
- **Frequency**: Daily, Weekly, Bi-weekly, Monthly
- **Next Execution**: When the order will run next
- **Status**: Active or Cancelled
- **Action**: Cancel button for active orders

### Order Details Panel
Click any order to see detailed information:
- Complete order configuration
- Next execution date
- End date (or "Ongoing" if no end date)
- Total number of executions so far
- Cancel button

### Execution History
View all past and future executions:
- **Status**: Pending, Successful, or Failed
- **Date/Time**: When the order executed
- **Amount**: Tokens involved
- **Transaction Hash**: Link to Arc Testnet explorer
- **Error Message**: If execution failed

## Database Schema Updates (If Adding Signature)

Add these fields to `recurring_orders` table in `supabase/schema.sql`:

```sql
ALTER TABLE recurring_orders 
ADD COLUMN signature TEXT,
ADD COLUMN authorized_at TIMESTAMPTZ;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_recurring_signature ON recurring_orders(signature);
```

## Flow Diagram

```
User Action Flow:

1. User navigates to /recurring-orders
   ↓
2. Views existing orders in dashboard (tab: "View Orders")
   ↓
3. Clicks to create new order (tab: "Create Buy Order" or "Create Sell Order")
   ↓
4. Fills in order details
   ↓
5. Clicks "Continue"
   ↓
6. [WALLET SIGNING STEP]
   - Message is prepared
   - Wallet prompts user to sign
   - Signature is obtained
   ↓
7. Order is saved to Supabase database
   - createRecurringOrder() is called
   - Order appears in dashboard
   ↓
8. User can view order details and cancel anytime
   ↓
9. System executes orders automatically on schedule
   - (Backend job not yet implemented)
```

## Usage Examples

### View User's Orders
```typescript
import { getRecurringOrders } from "@/lib/recurringOrderService";

const orders = await getRecurringOrders(walletAddress, false); // All orders
const activeOrders = await getRecurringOrders(walletAddress, true); // Active only
```

### Cancel an Order
```typescript
import { cancelRecurringOrder } from "@/lib/recurringOrderService";

await cancelRecurringOrder(orderId);
```

### Get Execution History
```typescript
import { getOrderExecutions } from "@/lib/recurringOrderService";

const executions = await getOrderExecutions(orderId);
executions.forEach(exec => {
  console.log(`${exec.status} at ${exec.execution_date}`);
});
```

## Navigation

Add a link to the recurring orders page in your Header or navigation:

```tsx
<Link href="/recurring-orders">
  Recurring Orders
</Link>
```

## Next Steps

1. **Complete Wallet Signing** - Integrate Privy's signMessage API
2. **Add Signature Storage** - Update schema and service to store signatures
3. **Backend Execution** - Implement scheduler to execute orders on time
4. **Order Notifications** - Alert users when orders execute
5. **Edit Orders** - Allow users to modify existing orders
6. **Advanced Filters** - Filter orders by status, frequency, tokens, etc.

## Troubleshooting

### Orders Not Loading
- Check browser console for errors
- Verify wallet is connected
- Ensure Supabase tables exist and RLS policies allow reads

### Can't Cancel Order
- Verify RLS policy allows updates
- Check that order exists in database
- Ensure wallet address matches

### Signature Not Working
- Check if Privy's signMessage is available in your version
- Verify user's wallet supports message signing
- Check browser console for specific errors

## Architecture Notes

### Component Hierarchy
```
RecurringOrdersPage
├── Header
├── Tab Navigation
├── RecurringOrdersDashboard (tab: view)
│   ├── Orders Table
│   └── Order Details & History
├── RecurringBuys (tab: create-buy)
└── RecurringSell (tab: create-sell)
└── Footer
```

### State Management
- **Local State**: Form inputs, loading states, errors
- **Database**: Recurring orders, execution history
- **localStorage**: Cached orders (optional backup)

### API Integration
- Reads: getRecurringOrders, getOrderExecutions
- Writes: createRecurringOrder, cancelRecurringOrder, logOrderExecution
- Authentication: Privy wallet address validation
