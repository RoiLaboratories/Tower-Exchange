import { userApiFetch } from "./userApi";

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
  amount: number | string;
  source_amount_usd?: number | string | null;
  target_amount?: number | string | null;
  target_amount_usd?: number | string | null;
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

  const result = await userApiFetch<{ data: RecurringOrder }>(
    "/api/user/recurring-orders",
    {
      method: "POST",
      walletAddress,
      body: JSON.stringify({
        order_type: orderType,
        source_token: sourceToken,
        target_token: targetToken,
        amount,
        frequency,
        start_date: nextExecutionDate,
        end_date: normalizedEndDate,
        next_execution_date: nextExecutionDate,
        is_active: true,
      }),
    },
  );

  if (!result.ok || !result.data?.data) {
    const errorMessage = result.error || "Unknown error";
    console.error("Error creating recurring order:", errorMessage);
    throw new Error(`Failed to create recurring order: ${errorMessage}`);
  }

  return result.data.data;
};

/**
 * Get all recurring orders for a wallet
 */
export const getRecurringOrders = async (
  walletAddress: string,
  activeOnly = true
): Promise<RecurringOrder[]> => {
  const params = new URLSearchParams({
    walletAddress,
    activeOnly: activeOnly ? "true" : "false",
  });
  const result = await userApiFetch<{ data: RecurringOrder[] }>(
    `/api/user/recurring-orders?${params.toString()}`,
    { walletAddress },
  );

  if (!result.ok) {
    const errorMessage = result.error || "Unknown error";
    console.error("Error fetching recurring orders:", errorMessage);
    throw new Error(`Failed to fetch recurring orders: ${errorMessage}`);
  }

  return result.data?.data || [];
};

/**
 * Get a specific recurring order
 */
export const getRecurringOrder = async (
  orderId: string,
  walletAddress: string,
): Promise<RecurringOrder | null> => {
  const params = new URLSearchParams({ walletAddress });
  const result = await userApiFetch<{ data: RecurringOrder }>(
    `/api/user/recurring-orders/${orderId}?${params.toString()}`,
    { walletAddress },
  );

  if (!result.ok || !result.data?.data) {
    console.error("Error fetching recurring order:", result.error);
    return null;
  }

  return result.data.data;
};

const CLIENT_ORDER_UPDATE_KEYS = [
  "is_active",
  "amount",
  "frequency",
  "end_date",
  "next_execution_date",
] as const;

type ClientOrderUpdate = Pick<
  RecurringOrder,
  (typeof CLIENT_ORDER_UPDATE_KEYS)[number]
>;

/**
 * Update client-editable recurring order fields only.
 * On-chain authorization fields must use markRecurringOrderAuthorized.
 */
export const updateRecurringOrder = async (
  orderId: string,
  walletAddress: string,
  updates: Partial<ClientOrderUpdate>,
): Promise<RecurringOrder> => {
  const body: Record<string, unknown> = {};
  for (const key of CLIENT_ORDER_UPDATE_KEYS) {
    if (updates[key] !== undefined) {
      body[key] = updates[key];
    }
  }

  const result = await userApiFetch<{ data: RecurringOrder }>(
    `/api/user/recurring-orders/${orderId}`,
    {
      method: "PATCH",
      walletAddress,
      body: JSON.stringify(body),
    },
  );

  if (!result.ok || !result.data?.data) {
    const errorMessage = result.error || "Unknown error";
    console.error("Error updating recurring order:", errorMessage);
    throw new Error(`Failed to update recurring order: ${errorMessage}`);
  }

  return result.data.data;
};

/**
 * Persist on-chain authorization proof after authorizeRecurringOrderOnchain.
 */
export const markRecurringOrderAuthorized = async (
  orderId: string,
  walletAddress: string,
  authorization: {
    orderKey: string;
    executorAddress: string;
    authorizationHash: string;
    approvalHash?: string | null;
  },
): Promise<RecurringOrder> => {
  const result = await userApiFetch<{ data: RecurringOrder }>(
    `/api/user/recurring-orders/${orderId}/authorize`,
    {
      method: "POST",
      walletAddress,
      body: JSON.stringify({
        onchain_order_key: authorization.orderKey,
        executor_address: authorization.executorAddress,
        authorization_transaction_hash: authorization.authorizationHash,
        ...(authorization.approvalHash
          ? { approval_transaction_hash: authorization.approvalHash }
          : {}),
      }),
    },
  );

  if (!result.ok || !result.data?.data) {
    const errorMessage = result.error || "Unknown error";
    console.error("Error authorizing recurring order:", errorMessage);
    throw new Error(`Failed to authorize recurring order: ${errorMessage}`);
  }

  return result.data.data;
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
  const result = await userApiFetch("/api/user/activities", {
    method: "POST",
    walletAddress,
    body: JSON.stringify({
      type: `Recurring ${orderType.charAt(0).toUpperCase() + orderType.slice(1)} Cancelled`,
      source_currency_ticker: sourceToken,
      destination_currency_ticker: targetToken,
      source_network_name: "Arc",
      destination_network_name: "Arc",
      status: "Successful",
      amount: 0,
    }),
  });

  if (!result.ok) {
    console.error("Error logging order cancellation:", result.error);
    throw new Error(`Failed to log order cancellation: ${result.error}`);
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
  const result = await userApiFetch("/api/user/activities", {
    method: "POST",
    walletAddress,
    body: JSON.stringify({
      type: `Recurring ${orderType.charAt(0).toUpperCase() + orderType.slice(1)} Created`,
      source_currency_ticker: sourceToken,
      destination_currency_ticker: targetToken,
      source_network_name: "Arc",
      destination_network_name: "Arc",
      status: "Successful",
      amount,
    }),
  });

  if (!result.ok) {
    console.error("Error logging order creation:", result.error);
    throw new Error(`Failed to log order creation: ${result.error}`);
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
  const order = await getRecurringOrder(orderId, walletAddress);

  if (!order) {
    throw new Error("Order not found");
  }

  try {
    await updateRecurringOrder(orderId, walletAddress, { is_active: false });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
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
export const deleteRecurringOrder = async (
  orderId: string,
  walletAddress: string,
): Promise<void> => {
  const params = new URLSearchParams({ walletAddress });
  const result = await userApiFetch(
    `/api/user/recurring-orders/${orderId}?${params.toString()}`,
    { method: "DELETE", walletAddress },
  );

  if (!result.ok) {
    const errorMessage = result.error || "Unknown error";
    console.error("Error deleting recurring order:", errorMessage);
    throw new Error(`Failed to delete recurring order: ${errorMessage}`);
  }
};

/**
 * Get execution history for a recurring order
 */
export const getOrderExecutions = async (
  recurringOrderId: string,
  walletAddress: string,
): Promise<RecurringOrderExecution[]> => {
  const params = new URLSearchParams({
    walletAddress,
    orderId: recurringOrderId,
  });
  const result = await userApiFetch<{ data: RecurringOrderExecution[] }>(
    `/api/user/recurring-order-executions?${params.toString()}`,
    { walletAddress },
  );

  if (!result.ok) {
    const errorMessage = result.error || "Unknown error";
    console.error("Error fetching order executions:", errorMessage);
    throw new Error(`Failed to fetch order executions: ${errorMessage}`);
  }

  return result.data?.data || [];
};

/**
 * Get execution history for a wallet
 */
export const getWalletExecutions = async (
  walletAddress: string
): Promise<RecurringOrderExecution[]> => {
  const params = new URLSearchParams({ walletAddress });
  const result = await userApiFetch<{ data: RecurringOrderExecution[] }>(
    `/api/user/recurring-order-executions?${params.toString()}`,
    { walletAddress },
  );

  if (!result.ok) {
    const errorMessage = result.error || "Unknown error";
    console.error("Error fetching wallet executions:", errorMessage);
    throw new Error(`Failed to fetch wallet executions: ${errorMessage}`);
  }

  return result.data?.data || [];
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
  errorMessage?: string,
  executionAmounts?: {
    sourceAmountUsd?: number | string | null;
    targetAmount?: number | string | null;
    targetAmountUsd?: number | string | null;
  }
): Promise<RecurringOrderExecution> => {
  const result = await userApiFetch<{ data: RecurringOrderExecution }>(
    "/api/user/recurring-order-executions",
    {
      method: "POST",
      walletAddress,
      body: JSON.stringify({
        recurring_order_id: recurringOrderId,
        amount,
        source_amount_usd: executionAmounts?.sourceAmountUsd ?? null,
        target_amount: executionAmounts?.targetAmount ?? null,
        target_amount_usd: executionAmounts?.targetAmountUsd ?? null,
        source_token: sourceToken,
        target_token: targetToken,
        status,
        transaction_hash: transactionHash,
        error_message: errorMessage,
        execution_date: new Date().toISOString(),
      }),
    },
  );

  if (!result.ok || !result.data?.data) {
    const message = result.error || "Unknown error";
    console.error("Error logging order execution:", message);
    throw new Error(`Failed to log order execution: ${message}`);
  }

  return result.data.data;
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
