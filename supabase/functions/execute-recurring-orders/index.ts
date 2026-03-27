import { createClient } from "@supabase/supabase-js";

// deno-lint-ignore no-explicit-any
const deno = (globalThis as any).Deno;

const supabaseUrl = deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";;
const arcRpcUrl = "https://rpc.testnet.arc.network";
const towerExchangeAiUrl = "https://tower-exchange-ai.vercel.app";
const towerBackendUrl = "https://tower-backend.vercel.app";

// Privy Server Wallet Configuration
const privyAppId = deno.env.get("PRIVY_APP_ID") ?? "";
const privyAppSecret = deno.env.get("PRIVY_APP_SECRET") ?? "";
const privyApiUrl = "https://api.privy.io";

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
    // Log the incoming request for debugging
    console.log(`[${new Date().toISOString()}] Received request:`, {
      method: req.method,
      url: req.url,
      headers: {
        authorization: req.headers.get("authorization") ? "present" : "missing",
        contentType: req.headers.get("content-type"),
      },
    });

    // Verify the request is from Supabase cron or authorized source
    // Accept requests with valid Bearer token OR from Supabase cron without strict validation
    const authHeader = req.headers.get("authorization");
    
    // For cron jobs, we need to be lenient as the auth header format may vary
    // Check if this is a valid request from cron or has proper authorization
    const isAuthorized = 
      !authHeader || // Allow requests without header (for cron compatibility)
      authHeader.startsWith("Bearer "); // Or with Bearer token
    
    if (!isAuthorized) {
      console.error("Invalid authorization header format");
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid token format" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active recurring orders that are due for execution
    const now = new Date().toISOString();
    console.log(`[${new Date().toISOString()}] Querying orders due before:`, now);
    
    const { data: ordersToExecute, error: fetchError } = await supabase
      .from("recurring_orders")
      .select("*")
      .eq("is_active", true)
      .lte("next_execution_date", now)
      .order("next_execution_date", { ascending: true })
      .limit(100); // Process max 100 orders per run

    if (fetchError) {
      console.error(`[${new Date().toISOString()}] Error fetching recurring orders:`, fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch orders", details: fetchError }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!ordersToExecute || ordersToExecute.length === 0) {
      console.log(`[${new Date().toISOString()}] No orders to execute`);
      return new Response(
        JSON.stringify({ message: "No orders to execute", processed: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[${new Date().toISOString()}] Processing ${ordersToExecute.length} recurring orders`);

    // Execute each order and track results
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const order of ordersToExecute as RecurringOrder[]) {
      try {
        console.log(`[${new Date().toISOString()}] Executing order:`, {
          id: order.id,
          wallet: order.wallet_address?.substring(0, 6) + "...",
          swap: `${order.source_token} → ${order.target_token}`,
          amount: order.amount,
        });

        const executionResult = await executeOrder(supabase, order);
        results.push(executionResult);

        if (executionResult.status === "Successful") {
          successCount++;
          console.log(`[${new Date().toISOString()}] ✅ Order ${order.id} executed successfully`);
        } else {
          failureCount++;
          console.warn(`[${new Date().toISOString()}] ❌ Order ${order.id} failed:`, executionResult.error);
        }
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Error executing order ${order.id}:`, error);
        failureCount++;

        // Log failed execution
        await logOrderExecution(supabase, order, "Failed", undefined, String(error));
      }
    }

    const summary = {
      message: "Execution batch completed",
      timestamp: new Date().toISOString(),
      processed: ordersToExecute.length,
      successful: successCount,
      failed: failureCount,
      results,
    };

    console.log(`[${new Date().toISOString()}] Batch summary:`, summary);

    return new Response(
      JSON.stringify(summary),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Unexpected error in execute-recurring-orders:`, error);
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

    // Get swap quote from Tower-Exchange-AI
    const quoteResult = await getSwapQuote(order);
    if (!quoteResult.success) {
      throw new Error(`Failed to get quote: ${quoteResult.error}`);
    }

    // Build and send transaction via Tower-Exchange-AI
    const txResult = await sendSwapTransaction(
      order.wallet_address,
      order.source_token,
      order.target_token,
      order.amount.toString()
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
 * Get swap quote from Tower-Exchange-AI
 */
async function getSwapQuote(
  order: RecurringOrder
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // Tower-Exchange-AI handles amount conversion internally based on token type
    console.log(`[Quote] Requesting quote: ${order.source_token} -> ${order.target_token}, amount: ${order.amount}`);

    // Call Tower-Exchange-AI chat endpoint to get swap quote using AI agent
    const chatResponse = await fetch(`${towerExchangeAiUrl}/api/v1/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: order.wallet_address,
        wallet_address: order.wallet_address,
        message: `Get swap quote for ${order.amount} ${order.source_token} to ${order.target_token}`,
        enable_wallet_access: false,
        enable_portfolio_analysis: false,
      }),
    });

    if (!chatResponse.ok) {
      return {
        success: false,
        error: `Tower-Exchange-AI returned status ${chatResponse.status}`,
      };
    }

    const chatData = (await chatResponse.json()) as any;
    console.log(`[Quote] Tower-Exchange-AI response:`, chatData);

    // Extract quote data from response
    const quote = chatData.data?.swap_quote || chatData.quote;
    if (!quote) {
      return {
        success: false,
        error: "No quote data in Tower-Exchange-AI response",
      };
    }

    return { success: true, data: quote };
  } catch (error) {
    console.error("[Quote Error]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Sign and send a transaction using Privy Server Wallet
 * Requires PRIVY_APP_ID and PRIVY_APP_SECRET environment variables
 */
async function signAndSendTransaction(
  walletAddress: string,
  txData: any
): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
  try {
    if (!privyAppId || !privyAppSecret) {
      return {
        success: false,
        error: "Privy credentials not configured. Set PRIVY_APP_ID and PRIVY_APP_SECRET.",
      };
    }

    console.log(`[Privy] Signing transaction for wallet: ${walletAddress}`);

    // Build Privy auth header (Base64 encoded "app_id:app_secret")
    const credentials = `${privyAppId}:${privyAppSecret}`;
    // deno-lint-ignore no-explicit-any
    const encodedCredentials = btoa(credentials) as any;

    // Call Privy Server Wallet API to sign transaction
    // The transaction object should have: to, data, value, chainId
    const privyResponse = await fetch(
      `${privyApiUrl}/v1/wallets/${walletAddress}/sign_transaction`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${encodedCredentials}`,
        },
        body: JSON.stringify({
          transaction: {
            to: txData.to,
            data: txData.data,
            value: txData.value || "0x0",
            gasLimit: txData.gasLimit?.toString() || "200000",
            chainId: 5042002, // Arc testnet
          },
        }),
      }
    );

    if (!privyResponse.ok) {
      const errorText = await privyResponse.text();
      console.error(`[Privy] Signing failed with status ${privyResponse.status}:`, errorText);
      return {
        success: false,
        error: `Privy signing failed: ${privyResponse.status}`,
      };
    }

    const signedTx = (await privyResponse.json()) as any;
    console.log(`[Privy] Transaction signed successfully`);

    // Send the signed transaction to Arc RPC
    const sendResponse = await fetch(arcRpcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "eth_sendRawTransaction",
        params: [signedTx.signed_transaction || signedTx.transaction],
      }),
    });

    const sendResult = (await sendResponse.json()) as any;

    if (sendResult.error) {
      console.error(`[RPC] Transaction broadcast failed:`, sendResult.error);
      return {
        success: false,
        error: `RPC error: ${sendResult.error.message}`,
      };
    }

    const txHash = sendResult.result;
    console.log(`[RPC] Transaction broadcast successful: ${txHash}`);

    return {
      success: true,
      transactionHash: txHash,
    };
  } catch (error) {
    console.error("[Privy Error]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Send swap transaction to the blockchain
 * Calls Tower-Exchange-AI to build and sends via Privy for signing
 */
async function sendSwapTransaction(
  walletAddress: string,
  inputToken: string,
  outputToken: string,
  inputAmount: string
): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
  try {
    console.log(`[Transaction] Building transaction for ${walletAddress}: ${inputToken} -> ${outputToken}`);

    // Call Tower-Exchange-AI execute_swap endpoint to build transaction
    const execResponse = await fetch(`${towerExchangeAiUrl}/api/v1/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: walletAddress,
        wallet_address: walletAddress,
        message: `Execute swap: ${inputAmount} ${inputToken} to ${outputToken}`,
        enable_wallet_access: true, // Needed for swap execution
        enable_portfolio_analysis: false,
      }),
    });

    if (!execResponse.ok) {
      return {
        success: false,
        error: `Transaction building failed: ${execResponse.status}`,
      };
    }

    const execData = (await execResponse.json()) as any;
    console.log(`[Transaction] Execute response:`, execData);

    // Extract transaction data from response
    const txData = execData.data?.swap_execution?.transaction;
    if (!txData) {
      return {
        success: false,
        error: "No transaction data in response",
      };
    }

    console.log(`[Transaction] Prepared transaction:`, {
      to: txData.to,
      from: txData.from,
      dataLength: txData.data?.length,
      value: txData.value,
      gasLimit: txData.gasLimit,
    });

    // Sign and send transaction using Privy Server Wallet
    return await signAndSendTransaction(walletAddress, txData);
  } catch (error) {
    console.error("[Transaction Error]", error);
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
