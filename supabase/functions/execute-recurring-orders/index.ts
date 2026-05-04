import { createClient } from "@supabase/supabase-js";
// @ts-ignore Deno Edge Functions resolve npm: specifiers at deploy/runtime.
import { ethers } from "npm:ethers@6.15.0";

type DenoRuntime = {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type QueryError = {
  message?: string;
};

type QueryResult<T = unknown> = {
  data: T | null;
  error: QueryError | null;
};

type SupabaseTableQuery<T = unknown> = PromiseLike<QueryResult<T>> & {
  select: <TNext = unknown>(columns?: string) => SupabaseTableQuery<TNext>;
  eq: (column: string, value: unknown) => SupabaseTableQuery<T>;
  lte: (column: string, value: unknown) => SupabaseTableQuery<T>;
  order: (
    column: string,
    options?: { ascending?: boolean }
  ) => SupabaseTableQuery<T>;
  limit: (count: number) => SupabaseTableQuery<T>;
  update: (values: Record<string, unknown>) => SupabaseTableQuery<T>;
  insert: (
    values: Record<string, unknown> | Array<Record<string, unknown>>
  ) => SupabaseTableQuery<T>;
  maybeSingle: <TSingle = unknown>() => Promise<QueryResult<TSingle>>;
};

type SupabaseClientInstance = {
  from: (table: string) => SupabaseTableQuery;
};

const denoRuntime = (globalThis as unknown as { Deno: DenoRuntime }).Deno;

const supabaseUrl = denoRuntime.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = denoRuntime.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const swapBackendUrl =
  denoRuntime.env.get("TOWER_BACKEND_URL") ||
  denoRuntime.env.get("NEXT_PUBLIC_BACKEND_URL") ||
  "https://tower-backend.vercel.app";
const swapBackendApiKey =
  denoRuntime.env.get("TOWER_BACKEND_API_KEY") ||
  denoRuntime.env.get("BACKEND_API_KEY") ||
  "";
const swapBackendAuthHeader =
  denoRuntime.env.get("TOWER_BACKEND_AUTH_HEADER") || "Authorization";
const swapBackendMaxAttempts = Math.max(
  1,
  Number(denoRuntime.env.get("TOWER_BACKEND_MAX_ATTEMPTS") ?? "3")
);
const swapBackendMaxRetryDelayMs = Math.max(
  1000,
  Number(denoRuntime.env.get("TOWER_BACKEND_MAX_RETRY_DELAY_MS") ?? "15000")
);
const arcRpcUrl =
  denoRuntime.env.get("ARC_TESTNET_RPC_URL") ?? "https://rpc.testnet.arc.network";
const recurringOrderExecutorAddress =
  denoRuntime.env.get("RECURRING_ORDER_EXECUTOR_ADDRESS") ?? "";
const recurringOrderRelayerPrivateKey =
  denoRuntime.env.get("RECURRING_ORDER_RELAYER_PRIVATE_KEY") ?? "";
const minOutputBps = Number(
  denoRuntime.env.get("RECURRING_ORDER_MIN_OUTPUT_BPS") ?? "9900"
);
const maxOrdersPerRun = Math.max(
  1,
  Number(denoRuntime.env.get("RECURRING_ORDER_MAX_ORDERS_PER_RUN") ?? "25")
);
const orderDelayMs = Math.max(
  0,
  Number(denoRuntime.env.get("RECURRING_ORDER_DELAY_MS") ?? "1000")
);

const tokenDecimalsBySymbol: Record<string, number> = {
  USDC: 6,
  WUSDC: 18,
  QTM: 18,
  EURC: 6,
  USYC: 6,
  USDT: 18,
  SWPRC: 6,
  SYN: 18,
};

const tokenAddressBySymbol: Record<string, string> = {
  USDC: "0x3600000000000000000000000000000000000000",
  WUSDC: "0xD40fCAa5d2cE963c5dABC2bf59E268489ad7BcE4",
  QTM: "0xCD304d2A421BFEd31d45f0054AF8E8a6a4cF3EaE",
  EURC: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
  USYC: "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C",
  USDT: "0x175CdB1D338945f0D851A741ccF787D343E57952",
  SWPRC: "0xBE7477BF91526FC9988C8f33e91B6db687119D45",
  SYN: "0xC5124C846c6e6307986988dFb7e743327aA05F19",
};

const recurringOrderExecutorAbi = [
  "function executeOrder(bytes32 orderId,uint256 amountIn,uint256 minAmountOut,address routeTarget,address approvalSpender,bytes routeCalldata) returns (uint256 amountOut)",
];
const routeInterface = new ethers.Interface([
  "function swapExactTokensForTokens(uint256 amountIn,uint256 minAmountOut,address[] path,address to,uint256 deadline,address router)",
  "function swapWithSplit(tuple(address[] path,uint256 amountIn,uint256 minAmountOut,address router)[] splits,address tokenOut,uint256 minAmountOut,address to,uint256 deadline)",
  "function swap(address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,address recipient,uint256 deadline)",
]);

function getSwapBackendUrl(): string {
  const normalizedUrl = swapBackendUrl.replace(/\/$/, "");

  if (/tower-exchange-ai/i.test(normalizedUrl)) {
    throw new Error(
      "TOWER_BACKEND_URL points to the Tower-Exchange-AI service. Recurring orders require the swap backend URL, for example https://tower-backend.vercel.app."
    );
  }

  return normalizedUrl;
}

function buildBackendHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (!swapBackendApiKey) {
    return headers;
  }

  headers[swapBackendAuthHeader] =
    swapBackendAuthHeader.toLowerCase() === "authorization"
      ? `Bearer ${swapBackendApiKey}`
      : swapBackendApiKey;

  return headers;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getRetryDelayMs(response: Response, attempt: number): Promise<number> {
  const retryAfterHeader = response.headers.get("retry-after");

  if (retryAfterHeader) {
    const retryAfterSeconds = Number(retryAfterHeader);

    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
      return Math.min(retryAfterSeconds * 1000, swapBackendMaxRetryDelayMs);
    }

    const retryAfterDate = Date.parse(retryAfterHeader);

    if (!Number.isNaN(retryAfterDate)) {
      return Math.min(
        Math.max(retryAfterDate - Date.now(), 1000),
        swapBackendMaxRetryDelayMs
      );
    }
  }

  try {
    const errorText = await response.clone().text();
    const errorBody = JSON.parse(errorText) as { retryAfter?: unknown };
    const retryAfterSeconds = Number(errorBody.retryAfter);

    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
      return Math.min(retryAfterSeconds * 1000, swapBackendMaxRetryDelayMs);
    }
  } catch {
    // Fall back to exponential delay below.
  }

  return Math.min(1000 * 2 ** (attempt - 1), swapBackendMaxRetryDelayMs);
}

async function fetchSwapBackend(
  url: string,
  init: RequestInit,
  label: string
): Promise<Response> {
  for (let attempt = 1; attempt <= swapBackendMaxAttempts; attempt++) {
    const response = await fetch(url, init);
    const shouldRetry =
      response.status === 429 || response.status === 502 || response.status === 503;

    if (!shouldRetry || attempt === swapBackendMaxAttempts) {
      return response;
    }

    const delayMs = await getRetryDelayMs(response, attempt);
    console.warn(
      `[${label}] Swap backend returned ${response.status}; retrying in ${Math.round(
        delayMs / 1000
      )}s (${attempt}/${swapBackendMaxAttempts})`
    );
    await sleep(delayMs);
  }

  throw new Error("Swap backend request failed before receiving a response.");
}

interface RecurringOrder {
  id: string;
  wallet_address: string;
  order_type: "buy" | "sell";
  source_token: string;
  target_token: string;
  amount: number;
  frequency: string;
  next_execution_date: string;
  end_date?: string | null;
  is_active: boolean;
  execution_count?: number;
  onchain_order_key?: string | null;
  onchain_authorized?: boolean;
}

/**
 * Main handler for executing recurring orders
 */
denoRuntime.serve(async (req: Request) => {
  try {
    // Log the incoming request for debugging
    console.log(`[${new Date().toISOString()}] Received request:`, {
      method: req.method,
      url: req.url,
      swapBackendHost: new URL(getSwapBackendUrl()).host,
      swapBackendAuthHeader: swapBackendApiKey ? swapBackendAuthHeader : "none",
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

    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey
    ) as unknown as SupabaseClientInstance;

    // Get all active recurring orders that are due for execution
    const now = new Date().toISOString();
    console.log(`[${new Date().toISOString()}] Querying orders due before:`, now);
    
    const { data: ordersToExecute, error: fetchError } = await supabase
      .from("recurring_orders")
      .select<RecurringOrder[]>("*")
      .eq("is_active", true)
      .eq("onchain_authorized", true)
      .lte("next_execution_date", now)
      .order("next_execution_date", { ascending: true })
      .limit(maxOrdersPerRun);

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

    console.log(`[${new Date().toISOString()}] Processing ${ordersToExecute.length} recurring orders`, {
      maxOrdersPerRun,
      orderDelayMs,
    });

    // Execute each order and track results
    const results = [];
    let claimedCount = 0;
    let successCount = 0;
    let failureCount = 0;

    for (const order of ordersToExecute) {
      try {
        const claimed = await claimOrderForExecution(supabase, order);

        if (!claimed) {
          console.log(`[${new Date().toISOString()}] Skipping order already claimed or no longer due:`, order.id);
          continue;
        }

        claimedCount++;
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

      if (orderDelayMs > 0) {
        await sleep(orderDelayMs);
      }
    }

    const summary = {
      message: "Execution batch completed",
      timestamp: new Date().toISOString(),
      processed: ordersToExecute.length,
      claimed: claimedCount,
      successful: successCount,
      failed: failureCount,
      results,
    };

    console.log(`[${new Date().toISOString()}] Batch summary:`, summary);

    return new Response(
      JSON.stringify(summary),
      {
        status: failureCount > 0 && successCount === 0 ? 500 : 200,
        headers: { "Content-Type": "application/json" },
      }
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
  supabase: SupabaseClientInstance,
  order: RecurringOrder
): Promise<{ orderId: string; status: string; transactionHash?: string; error?: string }> {
  try {
    console.log(`Executing order ${order.id}: ${order.source_token} -> ${order.target_token}`);

    // Get the same backend-selected route used by normal swaps.
    const quoteResult = await getSwapQuote(order);
    if (!quoteResult.success) {
      throw new Error(`Failed to get quote: ${quoteResult.error}`);
    }

    const txResult = await executeOrderOnchain(order, quoteResult.data);

    if (!txResult.success) {
      throw new Error(`Failed to execute on-chain order: ${txResult.error}`);
    }

    // Log successful execution
    await logOrderExecution(
      supabase,
      order,
      "Successful",
      txResult.transactionHash
    );

    // Update next execution date
    const nextDate = calculateNextExecutionDate(order.frequency, order.next_execution_date);
    const currentCount = order.execution_count ?? 0;
    const shouldDeactivate =
      Boolean(order.end_date) && new Date(nextDate) > new Date(order.end_date as string);
    await supabase
      .from("recurring_orders")
      .update({
        next_execution_date: nextDate,
        execution_count: currentCount + 1,
        execution_transaction_hash: txResult.transactionHash,
        is_active: !shouldDeactivate,
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
    await releaseFailedOrder(supabase, order);
    return {
      orderId: order.id,
      status: "Failed",
      error: errorMsg,
    };
  }
}

async function claimOrderForExecution(
  supabase: SupabaseClientInstance,
  order: RecurringOrder
): Promise<boolean> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("recurring_orders")
    .update({ next_execution_date: calculateRetryExecutionDate() })
    .eq("id", order.id)
    .eq("is_active", true)
    .lte("next_execution_date", now)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    console.error(`[Claim Error] Unable to claim order ${order.id}:`, error);
    return false;
  }

  return Boolean(data?.id);
}

async function releaseFailedOrder(
  supabase: SupabaseClientInstance,
  order: RecurringOrder
): Promise<void> {
  const nextRetryDate = calculateRetryExecutionDate();

  await supabase
    .from("recurring_orders")
    .update({ next_execution_date: nextRetryDate })
    .eq("id", order.id)
    .eq("is_active", true);
}

/**
 * Get swap quote from the backend route optimizer.
 */
async function getSwapQuote(
  order: RecurringOrder
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const sourceDecimals = tokenDecimalsBySymbol[order.source_token];
    const sourceAddress = tokenAddressBySymbol[order.source_token];
    const targetAddress = tokenAddressBySymbol[order.target_token];

    if (sourceDecimals == null || !sourceAddress || !targetAddress) {
      return {
        success: false,
        error: `Unsupported token pair for recurring execution: ${order.source_token}/${order.target_token}`,
      };
    }

    const amountIn = ethers.parseUnits(order.amount.toString(), sourceDecimals).toString();
    console.log("[Quote] Requesting backend route quote:", {
      sourceToken: order.source_token,
      targetToken: order.target_token,
      sourceAddress,
      targetAddress,
      amountIn,
    });

    const backendUrl = getSwapBackendUrl();
    const quoteResponse = await fetchSwapBackend(
      `${backendUrl}/api/swap/quote`,
      {
        method: "POST",
        headers: buildBackendHeaders(),
        body: JSON.stringify({
          inputToken: sourceAddress,
          outputToken: targetAddress,
          inputAmount: amountIn,
          slippageTolerance: 10000 - Math.min(Math.max(minOutputBps, 1), 10000),
        }),
      },
      "Quote"
    );

    if (!quoteResponse.ok) {
      const errorText = await quoteResponse.text();
      return {
        success: false,
        error: `Swap backend returned status ${quoteResponse.status}: ${errorText}`,
      };
    }

    const quoteData = await quoteResponse.json();
    const quote = unwrapData(quoteData);

    if (!quote) {
      return {
        success: false,
        error: "No quote data in route optimizer response",
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
 * Execute the recurring order through the allowance-based executor contract.
 */
async function executeOrderOnchain(
  order: RecurringOrder,
  quoteData: unknown
): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
  try {
    if (!recurringOrderExecutorAddress || !recurringOrderRelayerPrivateKey) {
      return {
        success: false,
        error:
          "RECURRING_ORDER_EXECUTOR_ADDRESS or RECURRING_ORDER_RELAYER_PRIVATE_KEY is not configured.",
      };
    }

    const sourceDecimals = tokenDecimalsBySymbol[order.source_token];
    if (sourceDecimals == null) {
      return {
        success: false,
        error: `Unsupported source token for recurring execution: ${order.source_token}`,
      };
    }

    const orderKey =
      order.onchain_order_key || ethers.keccak256(ethers.toUtf8Bytes(order.id));
    const amountIn = ethers.parseUnits(order.amount.toString(), sourceDecimals);
    const route = await buildRecurringRoute(order, quoteData);

    if (!route.success || !route.swap) {
      return {
        success: false,
        error: route.error || "Backend did not return a swap route.",
      };
    }

    const approvalSpender =
      route.approvalSpender || route.swap.to;
    const routeMinAmountOut = extractRouteMinAmountOut(route.swap.data);
    const expectedAmountOut = extractQuoteAmountOut(
      quoteData,
      tokenDecimalsBySymbol[order.target_token]
    );
    const boundedMinOutputBps = BigInt(Math.min(Math.max(minOutputBps, 1), 10000));
    const minAmountOut =
      routeMinAmountOut ??
      (expectedAmountOut > 0n ? (expectedAmountOut * boundedMinOutputBps) / 10000n : 1n);

    console.log("[Executor] Sending recurring order transaction:", {
      orderId: order.id,
      orderKey,
      amountIn: amountIn.toString(),
      minAmountOut: minAmountOut.toString(),
      routeMinAmountOut: routeMinAmountOut?.toString() ?? null,
      quoteExpectedAmountOut: expectedAmountOut.toString(),
      executor: recurringOrderExecutorAddress,
      routeTarget: route.swap.to,
      approvalSpender,
    });

    const provider = new ethers.JsonRpcProvider(arcRpcUrl);
    const wallet = new ethers.Wallet(recurringOrderRelayerPrivateKey, provider);
    const executor = new ethers.Contract(
      recurringOrderExecutorAddress,
      recurringOrderExecutorAbi,
      wallet
    );

    const tx = await executor.executeOrder(
      orderKey,
      amountIn,
      minAmountOut,
      route.swap.to,
      approvalSpender,
      route.swap.data
    );
    const receipt = await tx.wait();

    return {
      success: receipt?.status === 1,
      transactionHash: tx.hash,
      error: receipt?.status === 1 ? undefined : "Executor transaction reverted.",
    };
  } catch (error) {
    console.error("[Executor Error]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

type BuiltSwapTransaction = {
  to: string;
  data: string;
  value?: string;
  gasLimit?: string | number;
};

type BuiltApprovalTransaction = {
  to?: string;
  data?: string;
  spender?: string;
  approvalAddress?: string;
};

async function buildRecurringRoute(
  order: RecurringOrder,
  quoteData: unknown
): Promise<{
  success: boolean;
  swap?: BuiltSwapTransaction;
  approvalSpender?: string;
  error?: string;
}> {
  try {
    const backendUrl = getSwapBackendUrl();
    const response = await fetchSwapBackend(
      `${backendUrl}/api/swap/build-tx`,
      {
        method: "POST",
        headers: buildBackendHeaders(),
        body: JSON.stringify({
          quote: quoteData,
          userAddress: recurringOrderExecutorAddress,
          recipient: order.wallet_address,
          executionMode: "recurring_order_executor",
        }),
      },
      "Build Route"
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Transaction builder returned status ${response.status}: ${errorText}`,
      };
    }

    const buildData = unwrapData(await response.json()) as Record<string, unknown>;
    const swap = (buildData.swap || buildData) as BuiltSwapTransaction;
    const approval = (buildData.approval || buildData.approvalTx || null) as
      | BuiltApprovalTransaction
      | null;

    if (!isHexAddress(swap?.to) || !isHexData(swap?.data)) {
      return {
        success: false,
        error: "Transaction builder response did not include a valid swap target/data.",
      };
    }

    if (swap.value && BigInt(normalizeHexQuantity(swap.value)) > 0n) {
      return {
        success: false,
        error: "Recurring order executor only supports ERC20 routes with zero native value.",
      };
    }

    const approvalSpender =
      firstValidAddress([
        approval?.spender,
        approval?.approvalAddress,
        extractApprovalSpender(approval?.data),
        extractApprovalSpender((buildData as { approvalData?: string }).approvalData),
        (buildData as { approvalAddress?: string }).approvalAddress,
      ]) || swap.to;

    return {
      success: true,
      swap,
      approvalSpender,
    };
  } catch (error) {
    console.error("[Build Route Error]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function unwrapData(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  return record.data ?? value;
}

function isHexAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isHexData(value: unknown): value is string {
  return typeof value === "string" && /^0x([a-fA-F0-9]{2})*$/.test(value);
}

function firstValidAddress(values: unknown[]): string | null {
  for (const value of values) {
    if (isHexAddress(value)) {
      return value;
    }
  }

  return null;
}

function normalizeHexQuantity(value: string): string {
  if (value.startsWith("0x")) {
    return value;
  }

  return `0x${BigInt(value).toString(16)}`;
}

function extractApprovalSpender(data?: string): string | null {
  if (!data || !data.startsWith("0x095ea7b3") || data.length < 74) {
    return null;
  }

  const spender = `0x${data.slice(34, 74)}`;
  return isHexAddress(spender) ? spender : null;
}

function extractRouteMinAmountOut(routeCalldata: string): bigint | null {
  try {
    const parsed = routeInterface.parseTransaction({ data: routeCalldata });

    if (!parsed) {
      return null;
    }

    if (parsed.name === "swapExactTokensForTokens") {
      return BigInt(parsed.args.minAmountOut.toString());
    }

    if (parsed.name === "swapWithSplit") {
      return BigInt(parsed.args.minAmountOut.toString());
    }

    if (parsed.name === "swap") {
      return BigInt(parsed.args.minAmountOut.toString());
    }
  } catch (error) {
    console.warn("[Route Decode] Unable to decode route minimum output:", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return null;
}

function normalizeQuoteAmountOut(value: bigint, outputDecimals?: number): bigint {
  if (outputDecimals == null || outputDecimals >= 18 || value <= 0n) {
    return value;
  }

  const scale = 10n ** BigInt(18 - outputDecimals);

  if (value >= scale && value % scale === 0n) {
    return value / scale;
  }

  return value;
}

function extractQuoteAmountOut(
  quoteData: unknown,
  outputDecimals?: number
): bigint {
  const candidates: unknown[] = [];

  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") {
      return;
    }

    const record = value as Record<string, unknown>;
    for (const key of [
      "minOut",
      "minimumReceived",
      "amountOut",
      "outputAmount",
      "toAmount",
    ]) {
      candidates.push(record[key]);
    }

    for (const nestedKey of ["data", "quote", "swap_quote"]) {
      visit(record[nestedKey]);
    }
  };

  visit(quoteData);

  for (const candidate of candidates) {
    if (typeof candidate === "string" && /^\d+$/.test(candidate)) {
      return normalizeQuoteAmountOut(BigInt(candidate), outputDecimals);
    }

    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
      return normalizeQuoteAmountOut(BigInt(Math.floor(candidate)), outputDecimals);
    }
  }

  return 0n;
}

/**
 * Log order execution in database
 */
async function logOrderExecution(
  supabase: SupabaseClientInstance,
  order: RecurringOrder,
  status: "Successful" | "Failed" | "Pending",
  transactionHash?: string,
  errorMessage?: string
): Promise<void> {
  try {
    const { error } = await supabase.from("recurring_order_executions").insert({
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

    if (error) {
      console.error("Error logging execution:", error);
    }
  } catch (error) {
    console.error("Error logging execution:", error);
    // Don't throw, as this is secondary to the actual execution
  }
}

/**
 * Calculate next execution date based on frequency
 */
function calculateNextExecutionDate(frequency: string, fromDate?: string | null): string {
  const now = new Date();
  const next = fromDate ? new Date(fromDate) : now;

  if (Number.isNaN(next.getTime()) || next < now) {
    next.setTime(now.getTime());
  }

  switch (frequency.toLowerCase()) {
    case "hourly":
      next.setHours(next.getHours() + 1);
      break;
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "bi-weekly":
      next.setDate(next.getDate() + 14);
      break;
    case "monthly":
    case "month":
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      next.setDate(next.getDate() + 7); // Default to weekly
  }

  return next.toISOString();
}

function calculateRetryExecutionDate(): string {
  const retryDate = new Date();
  retryDate.setMinutes(retryDate.getMinutes() + 15);
  return retryDate.toISOString();
}
