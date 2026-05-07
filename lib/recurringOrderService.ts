import { supabase } from "./supabase";

export interface RecurringOrder {
  id: string;
  wallet_address: string;
  order_type: "buy" | "sell";
  source_token: string;
  target_token: string;
  amount: number;
  frequency: string;
  start_date: string;
  end_date?: string;
  next_execution_date?: string;
  onchain_order_key?: string;
  executor_address?: string;
  approval_transaction_hash?: string;
  authorization_transaction_hash?: string;
  onchain_authorized?: boolean;
  is_active: boolean;
  execution_count: number;
  created_at: string;
  updated_at: string;
}

export interface RecurringOrderExecution {
  id: string;
  recurring_order_id: string;
  wallet_address: string;
  execution_date: string;
  amount: number;
  source_token: string;
  target_token: string;
  transaction_hash?: string;
  status: "Pending" | "Successful" | "Failed";
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export const DATE_ONLY_INPUT_REGEX = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
export const ISO_DATE_ONLY_INPUT_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (value: number) => String(value).padStart(2, "0");

export const buildUtcIsoString = (date: string, time: string): string => {
  if (!date || !time) {
    return "";
  }

  return `${date}T${time}:00.000Z`;
};

export const getUtcDateInputValue = (dateString?: string | null): string => {
  if (!dateString) {
    return "";
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};

export const getUtcTimeInputValue = (dateString?: string | null): string => {
  if (!dateString) {
    return "";
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
};

export const formatUtcDateTimeLabel = (
  dateString?: string | null,
  fallback = "Select date and time",
): string => {
  if (!dateString) {
    return fallback;
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return `${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(date)} UTC`;
};

export const formatUtcDateTimeCompactLabel = (
  dateString?: string | null,
  fallback = "Select date and time",
): string => {
  if (!dateString) {
    return fallback;
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(date);
};

export const getDefaultRecurringExecutionUtc = (): string => {
  const date = new Date();
  date.setUTCMinutes(0, 0, 0);
  date.setUTCHours(date.getUTCHours() + 1);
  return date.toISOString();
};

/**
 * Create a new recurring order
 */
export const createRecurringOrder = async (
  walletAddress: string,
  orderType: "buy" | "sell",
  sourceToken: string,
  targetToken: string,
  amount: number,
  frequency: string,
  firstExecutionDate?: string,
  endDate?: string | null,
  signature?: string
): Promise<RecurringOrder> => {
  const nextExecutionDate = calculateInitialExecutionDate(
    firstExecutionDate,
    frequency
  );
  const normalizedEndDate = calculateEndDate(endDate);

  const { data, error } = await supabase
    .from("recurring_orders")
    .insert({
      wallet_address: walletAddress,
      order_type: orderType,
      source_token: sourceToken,
      target_token: targetToken,
      amount,
      frequency,
      start_date: nextExecutionDate,
      end_date: normalizedEndDate,
      next_execution_date: nextExecutionDate,
      is_active: true,
      ...(signature && { signature }),
    })
    .select()
    .single();

  if (error) {
    const errorMessage = error?.message || JSON.stringify(error) || "Unknown error";
    console.error("Error creating recurring order:", errorMessage);
    throw new Error(`Failed to create recurring order: ${errorMessage}`);
  }

  if (!data) {
    throw new Error("Failed to create recurring order: No data returned from database");
  }

  return data;
};

/**
 * Get all recurring orders for a wallet
 */
export const getRecurringOrders = async (
  walletAddress: string,
  activeOnly = true
): Promise<RecurringOrder[]> => {
  let query = supabase
    .from("recurring_orders")
    .select("*")
    .eq("wallet_address", walletAddress);

  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query.order("created_at", {
    ascending: false,
  });

  if (error) {
    const errorMessage = error?.message || JSON.stringify(error) || "Unknown error";
    console.error("Error fetching recurring orders:", errorMessage);
    throw new Error(`Failed to fetch recurring orders: ${errorMessage}`);
  }

  return data || [];
};

/**
 * Get a specific recurring order
 */
export const getRecurringOrder = async (
  orderId: string
): Promise<RecurringOrder | null> => {
  const { data, error } = await supabase
    .from("recurring_orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (error) {
    console.error("Error fetching recurring order:", error);
    return null;
  }

  return data;
};

/**
 * Update a recurring order
 */
export const updateRecurringOrder = async (
  orderId: string,
  updates: Partial<RecurringOrder>
): Promise<RecurringOrder> => {
  const { data, error } = await supabase
    .from("recurring_orders")
    .update(updates)
    .eq("id", orderId)
    .select()
    .single();

  if (error) {
    const errorMessage = error?.message || JSON.stringify(error) || "Unknown error";
    console.error("Error updating recurring order:", errorMessage);
    throw new Error(`Failed to update recurring order: ${errorMessage}`);
  }

  if (!data) {
    throw new Error("Failed to update recurring order: No data returned");
  }

  return data;
};

/**
 * Log an order cancellation activity
 */
export const logOrderCancellation = async (
  walletAddress: string,
  orderId: string,
  sourceToken: string,
  targetToken: string,
  orderType: "buy" | "sell"
): Promise<void> => {
  const { error } = await supabase.from("activities").insert({
    wallet_address: walletAddress.toLowerCase(),
    type: `Recurring ${orderType.charAt(0).toUpperCase() + orderType.slice(1)} Cancelled`,
    source_currency_ticker: sourceToken,
    destination_currency_ticker: targetToken,
    source_network_name: "Arc",
    destination_network_name: "Arc",
    status: "Successful",
    amount: 0,
  });

  if (error) {
    console.error("Error logging order cancellation:", error);
    throw new Error(`Failed to log order cancellation: ${error.message}`);
  }
};

/**
 * Log an order creation activity
 */
export const logOrderCreation = async (
  walletAddress: string,
  sourceToken: string,
  targetToken: string,
  orderType: "buy" | "sell",
  amount: number
): Promise<void> => {
  const { error } = await supabase.from("activities").insert({
    wallet_address: walletAddress.toLowerCase(),
    type: `Recurring ${orderType.charAt(0).toUpperCase() + orderType.slice(1)} Created`,
    source_currency_ticker: sourceToken,
    destination_currency_ticker: targetToken,
    source_network_name: "Arc",
    destination_network_name: "Arc",
    status: "Successful",
    amount: amount,
  });

  if (error) {
    console.error("Error logging order creation:", error);
    throw new Error(`Failed to log order creation: ${error.message}`);
  }
};

/**
 * Cancel a recurring order (deactivate it)
 */
export const cancelRecurringOrder = async (
  orderId: string,
  walletAddress: string
): Promise<void> => {
  // Get order details before canceling for activity logging
  const order = await getRecurringOrder(orderId);

  if (!order) {
    throw new Error("Order not found");
  }

  // Update order status
  const { error } = await supabase
    .from("recurring_orders")
    .update({ is_active: false })
    .eq("id", orderId);

  if (error) {
    const errorMessage = error?.message || JSON.stringify(error) || "Unknown error";
    console.error("Error canceling recurring order:", errorMessage);
    throw new Error(`Failed to cancel recurring order: ${errorMessage}`);
  }

  // Log the cancellation as an activity
  try {
    await logOrderCancellation(
      walletAddress,
      orderId,
      order.source_token,
      order.target_token,
      order.order_type
    );
  } catch (err) {
    console.error("Error logging cancellation activity:", err);
    // Don't throw - order is already canceled, just log the error
  }
};

/**
 * Delete a recurring order
 */
export const deleteRecurringOrder = async (orderId: string): Promise<void> => {
  const { error } = await supabase
    .from("recurring_orders")
    .delete()
    .eq("id", orderId);

  if (error) {
    const errorMessage = error?.message || JSON.stringify(error) || "Unknown error";
    console.error("Error deleting recurring order:", errorMessage);
    throw new Error(`Failed to delete recurring order: ${errorMessage}`);
  }
};

/**
 * Get execution history for a recurring order
 */
export const getOrderExecutions = async (
  recurringOrderId: string
): Promise<RecurringOrderExecution[]> => {
  const { data, error } = await supabase
    .from("recurring_order_executions")
    .select("*")
    .eq("recurring_order_id", recurringOrderId)
    .order("execution_date", { ascending: false });

  if (error) {
    const errorMessage = error?.message || JSON.stringify(error) || "Unknown error";
    console.error("Error fetching order executions:", errorMessage);
    throw new Error(`Failed to fetch order executions: ${errorMessage}`);
  }

  return data || [];
};

/**
 * Get execution history for a wallet
 */
export const getWalletExecutions = async (
  walletAddress: string
): Promise<RecurringOrderExecution[]> => {
  const { data, error } = await supabase
    .from("recurring_order_executions")
    .select("*")
    .eq("wallet_address", walletAddress)
    .order("execution_date", { ascending: false });

  if (error) {
    const errorMessage = error?.message || JSON.stringify(error) || "Unknown error";
    console.error("Error fetching wallet executions:", errorMessage);
    throw new Error(`Failed to fetch wallet executions: ${errorMessage}`);
  }

  return data || [];
};

/**
 * Log an order execution
 */
export const logOrderExecution = async (
  recurringOrderId: string,
  walletAddress: string,
  amount: number,
  sourceToken: string,
  targetToken: string,
  status: "Pending" | "Successful" | "Failed" = "Pending",
  transactionHash?: string,
  errorMessage?: string
): Promise<RecurringOrderExecution> => {
  const { data, error } = await supabase
    .from("recurring_order_executions")
    .insert({
      recurring_order_id: recurringOrderId,
      wallet_address: walletAddress,
      amount,
      source_token: sourceToken,
      target_token: targetToken,
      status,
      transaction_hash: transactionHash,
      error_message: errorMessage,
      execution_date: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    const errorMessage = error?.message || JSON.stringify(error) || "Unknown error";
    console.error("Error logging order execution:", errorMessage);
    throw new Error(`Failed to log order execution: ${errorMessage}`);
  }

  if (!data) {
    throw new Error("Failed to log order execution: No data returned");
  }

  return data;
};

export const calculateEndDate = (date?: string | null): string | null => {
  if (!date) {
    return null;
  }

  const isDateOnly =
    DATE_ONLY_INPUT_REGEX.test(date) || ISO_DATE_ONLY_INPUT_REGEX.test(date);
  const endDate = parseLocalDateInput(date);

  if (Number.isNaN(endDate.getTime())) {
    return null;
  }

  if (isDateOnly) {
    endDate.setHours(23, 59, 59, 999);
  }
  return endDate.toISOString();
};

/**
 * Calculate the first execution date selected by the user.
 * Same-day or past date-only values execute after one frequency interval.
 */
export const calculateInitialExecutionDate = (
  date?: string,
  frequency = "Weekly"
): string => {
  const now = new Date();

  if (!date) {
    return addFrequencyInterval(now, frequency).toISOString();
  }

  const executionDate = parseExecutionDateInput(date, now, frequency);

  if (Number.isNaN(executionDate.getTime())) {
    return addFrequencyInterval(now, frequency).toISOString();
  }

  if (executionDate <= now) {
    return addFrequencyInterval(now, frequency).toISOString();
  }

  return executionDate.toISOString();
};

/**
 * Calculate next execution date based on frequency
 */
export const calculateNextExecutionDate = (frequency: string): string => {
  return addFrequencyInterval(new Date(), frequency).toISOString();
};

const addFrequencyInterval = (date: Date, frequency: string): Date => {
  const next = new Date(date);
  switch (frequency.toLowerCase()) {
    case "hourly":
      next.setMinutes(0, 0, 0);
      next.setHours(next.getHours() + 1);
      break;
    case "daily":
      next.setSeconds(0, 0);
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setSeconds(0, 0);
      next.setDate(next.getDate() + 7);
      break;
    case "bi-weekly":
      next.setSeconds(0, 0);
      next.setDate(next.getDate() + 14);
      break;
    case "monthly":
    case "month":
      next.setSeconds(0, 0);
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      next.setSeconds(0, 0);
      next.setDate(next.getDate() + 7); // Default to weekly
  }

  return next;
};

const parseLocalDateInput = (value: string): Date => {
  const mmddyyyyMatch = value.match(DATE_ONLY_INPUT_REGEX);
  if (mmddyyyyMatch) {
    const [, month, day, year] = mmddyyyyMatch;
    return new Date(
      Number.parseInt(year, 10),
      Number.parseInt(month, 10) - 1,
      Number.parseInt(day, 10),
    );
  }

  const isoDateMatch = value.match(ISO_DATE_ONLY_INPUT_REGEX);
  if (isoDateMatch) {
    const [, year, month, day] = isoDateMatch;
    return new Date(
      Number.parseInt(year, 10),
      Number.parseInt(month, 10) - 1,
      Number.parseInt(day, 10),
    );
  }

  return new Date(value);
};

const parseExecutionDateInput = (
  value: string,
  referenceDate: Date,
  frequency: string,
): Date => {
  const parsed = parseLocalDateInput(value);

  if (Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const isDateOnly =
    DATE_ONLY_INPUT_REGEX.test(value) || ISO_DATE_ONLY_INPUT_REGEX.test(value);

  if (!isDateOnly) {
    return parsed;
  }

  if (frequency.toLowerCase() === "hourly") {
    parsed.setHours(referenceDate.getHours(), 0, 0, 0);
    return parsed;
  }

  parsed.setHours(
    referenceDate.getHours(),
    referenceDate.getMinutes(),
    0,
    0,
  );
  return parsed;
};

/**
 * Save recurring order to localStorage as backup
 */
export const saveRecurringOrderLocally = (
  walletAddress: string,
  orders: RecurringOrder[]
): void => {
  try {
    localStorage.setItem(
      `tower-recurring-${walletAddress}`,
      JSON.stringify({
        walletAddress,
        orders,
        savedAt: new Date().toISOString(),
      })
    );
  } catch (error) {
    console.error("Error saving recurring orders locally:", error);
  }
};

/**
 * Load recurring orders from localStorage
 */
export const loadRecurringOrdersLocally = (
  walletAddress: string
): { orders: RecurringOrder[]; savedAt: string } | null => {
  try {
    const data = localStorage.getItem(`tower-recurring-${walletAddress}`);
    if (data) {
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error("Error loading recurring orders locally:", error);
    return null;
  }
};

/**
 * Clear local cache for recurring orders
 */
export const clearRecurringOrdersLocalCache = (walletAddress: string): void => {
  try {
    localStorage.removeItem(`tower-recurring-${walletAddress}`);
  } catch (error) {
    console.error("Error clearing recurring orders cache:", error);
  }
};
