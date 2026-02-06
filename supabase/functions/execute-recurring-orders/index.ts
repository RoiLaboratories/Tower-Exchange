import { createClient } from "@supabase/supabase-js";

// deno-lint-ignore no-explicit-any
const deno = (globalThis as any).Deno;

const supabaseUrl = deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";;
const arcRpcUrl = "https://rpc.testnet.arc.network";

// Token decimals for proper amount conversion
const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 18,
  WUSDC: 6,
  QTM: 18,
  EURC: 6,
  SWPRC: 6,
  USDT: 6,
  UNI: 18,
  HYPE: 18,
  ETH: 18,
};

interface RecurringOrder {
  id: string;
  wallet_address: string;
  order_type: "buy" | "sell";
  source_token: string;
  target_token: string;
  amount: number;
  frequency: string;
  next_execution_date: string;
  is_active: boolean;
  execution_count?: number;
}

/**
 * Main handler for executing recurring orders
 */
// deno-lint-ignore no-explicit-any
const Deno = (globalThis as any).Deno;

Deno.serve(async (req: Request) => {
  try {
    // Verify the request is from Supabase cron (optional security check)
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active recurring orders that are due for execution
    const now = new Date().toISOString();
    const { data: ordersToExecute, error: fetchError } = await supabase
      .from("recurring_orders")
      .select("*")
      .eq("is_active", true)
      .lte("next_execution_date", now)
      .order("next_execution_date", { ascending: true })
      .limit(100); // Process max 100 orders per run

    if (fetchError) {
      console.error("Error fetching recurring orders:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch orders", details: fetchError }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!ordersToExecute || ordersToExecute.length === 0) {
      return new Response(
        JSON.stringify({ message: "No orders to execute", processed: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${ordersToExecute.length} recurring orders`);

    // Execute each order and track results
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const order of ordersToExecute as RecurringOrder[]) {
      try {
        const executionResult = await executeOrder(supabase, order);
        results.push(executionResult);

        if (executionResult.status === "Successful") {
          successCount++;
        } else {
          failureCount++;
        }
      } catch (error) {
        console.error(`Error executing order ${order.id}:`, error);
        failureCount++;

        // Log failed execution
        await logOrderExecution(supabase, order, "Failed", undefined, String(error));
      }
    }

    return new Response(
      JSON.stringify({
        message: "Execution batch completed",
        processed: ordersToExecute.length,
        successful: successCount,
        failed: failureCount,
        results,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error in execute-recurring-orders:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

/**
 * Execute a single recurring order
 */
async function executeOrder(
  supabase: any,
  order: RecurringOrder
): Promise<{ orderId: string; status: string; transactionHash?: string; error?: string }> {
  try {
    console.log(`Executing order ${order.id}: ${order.source_token} -> ${order.target_token}`);

    // Get swap quote from QuantumExchange API
    const quoteResult = await getSwapQuote(order);
    if (!quoteResult.success) {
      throw new Error(`Failed to get quote: ${quoteResult.error}`);
    }

    // Build and send transaction
    const txResult = await sendSwapTransaction(
      order.wallet_address,
      quoteResult.data
    );

    if (!txResult.success) {
      throw new Error(`Failed to send transaction: ${txResult.error}`);
    }

    // Log successful execution
    await logOrderExecution(
      supabase,
      order,
      "Successful",
      txResult.transactionHash
    );

    // Update next execution date
    const nextDate = calculateNextExecutionDate(order.frequency);
    const currentCount = order.execution_count ?? 0;
    await supabase
      .from("recurring_orders")
      .update({
        next_execution_date: nextDate,
        execution_count: currentCount + 1,
      })
      .eq("id", order.id);

    return {
      orderId: order.id,
      status: "Successful",
      transactionHash: txResult.transactionHash,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await logOrderExecution(supabase, order, "Failed", undefined, errorMsg);
    return {
      orderId: order.id,
      status: "Failed",
      error: errorMsg,
    };
  }
}

/**
 * Get swap quote from QuantumExchange API
 */
async function getSwapQuote(
  order: RecurringOrder
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const sourceDecimals = TOKEN_DECIMALS[order.source_token] || 18;
    const amountInWei = (order.amount * Math.pow(10, sourceDecimals)).toString();

    const url = new URL("https://www.quantumexchange.app/api/v1/quote");
    url.searchParams.append("tokenIn", order.source_token);
    url.searchParams.append("tokenOut", order.target_token);
    url.searchParams.append("amountIn", amountInWei);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `API returned status ${response.status}`,
      };
    }

    const quoteData = await response.json();
    return { success: true, data: quoteData };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Send swap transaction to the blockchain
 * NOTE: This is a placeholder. In production, you would need to:
 * 1. Sign the transaction using stored wallet credentials or a secure signer
 * 2. Send it via the Arc RPC
 * 3. Wait for confirmation
 */
async function sendSwapTransaction(
  walletAddress: string,
  quoteData: any
): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
  try {
    // IMPORTANT: This is a simplified implementation
    // In production, you would need:
    // - A secure way to sign transactions (e.g., AWS KMS, private keys in secure storage)
    // - Web3.py or ethers.js to prepare the transaction
    // - Send via Arc RPC using eth_sendRawTransaction

    console.log(`Transaction would be sent from ${walletAddress}`);
    console.log(`Quote data:`, quoteData);

    // For now, return a mock transaction hash
    // This would be replaced with actual signing and sending
    const mockTxHash = "0x" + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join("");

    return {
      success: true,
      transactionHash: mockTxHash,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Log order execution in database
 */
async function logOrderExecution(
  supabase: any,
  order: RecurringOrder,
  status: "Successful" | "Failed" | "Pending",
  transactionHash?: string,
  errorMessage?: string
): Promise<void> {
  try {
    await supabase.from("recurring_order_executions").insert({
      recurring_order_id: order.id,
      wallet_address: order.wallet_address,
      amount: order.amount,
      source_token: order.source_token,
      target_token: order.target_token,
      status,
      transaction_hash: transactionHash || null,
      error_message: errorMessage || null,
      execution_date: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error logging execution:", error);
    // Don't throw, as this is secondary to the actual execution
  }
}

/**
 * Calculate next execution date based on frequency
 */
function calculateNextExecutionDate(frequency: string): string {
  const now = new Date();

  switch (frequency.toLowerCase()) {
    case "hourly":
      now.setHours(now.getHours() + 1);
      break;
    case "daily":
      now.setDate(now.getDate() + 1);
      break;
    case "weekly":
      now.setDate(now.getDate() + 7);
      break;
    case "bi-weekly":
      now.setDate(now.getDate() + 14);
      break;
    case "monthly":
      now.setMonth(now.getMonth() + 1);
      break;
    default:
      now.setDate(now.getDate() + 7); // Default to weekly
  }

  return now.toISOString();
}
