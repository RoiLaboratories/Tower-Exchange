"use client";
import { type MouseEvent, useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  getRecurringOrders,
  cancelRecurringOrder,
  getOrderExecutions,
} from "@/lib/recurringOrderService";
import {
  RecurringOrder,
  RecurringOrderExecution,
} from "@/lib/recurringOrderService";
import { cancelRecurringOrderOnchain } from "@/lib/recurringOrderExecutor";
import CancelOrderConfirmationModal from "@/components/CancelOrderConfirmationModal";
import { AppErrorModal } from "@/components/AppErrorModal";
import { ErrorBadge } from "@/components/ui/error-badge";
import { useRainbowKitAuth } from "@/lib/use-rainbowkit-auth";

export const RecurringOrdersDashboard = () => {
  const { user } = useRainbowKitAuth();
  const walletAddress = user?.wallet?.address;

  const [orders, setOrders] = useState<RecurringOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<RecurringOrder | null>(
    null,
  );
  const [executionHistory, setExecutionHistory] = useState<
    RecurringOrderExecution[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<RecurringOrder | null>(
    null,
  );

  const loadOrders = useCallback(async () => {
    if (!walletAddress) return;
    setIsLoading(true);
    setError(null);

    try {
      const data = await getRecurringOrders(walletAddress, false); // Get all orders
      setOrders(data);
      if (data.length > 0 && !selectedOrder) {
        setSelectedOrder(data[0]);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load recurring orders";
      setError(errorMessage);
      console.error("Error loading orders:", err);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress, selectedOrder]);

  const loadExecutionHistory = useCallback(async (orderId: string) => {
    try {
      const executions = await getOrderExecutions(orderId);
      setExecutionHistory(executions);
    } catch (err) {
      console.error("Error loading execution history:", err);
      setExecutionHistory([]);
    }
  }, []);

  // Load orders on component mount
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Load execution history when order is selected
  useEffect(() => {
    if (selectedOrder) {
      loadExecutionHistory(selectedOrder.id);
    }
  }, [selectedOrder, loadExecutionHistory]);

  // If no wallet connected, show unified "No wallet connected" state (same as Activities/Profile)
  if (!walletAddress) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: "hsl(220, 20%, 10%)",
          border: "1px solid hsl(220, 15%, 18%)",
        }}
      >
        <div className="flex flex-col items-center justify-center py-20 px-6">
          <div className="mb-6">
            <Image
              src="/assets/empty state icon.svg"
              alt="No wallet connected"
              width={80}
              height={80}
              className="w-20 h-20 opacity-60"
            />
          </div>
          <h4 className="text-xl font-semibold mb-2 text-white">
            No wallet connected
          </h4>
          <p className="text-gray-400 text-center text-sm">
            Connect your wallet to view your recurring orders.
          </p>
        </div>
      </motion.div>
    );
  }

  const handleCancelOrder = async (orderId: string) => {
    if (!walletAddress) {
      setError("Please connect your wallet");
      return;
    }

    const orderToCancelData = orders.find((o) => o.id === orderId);
    if (!orderToCancelData) {
      alert("Order not found");
      return;
    }

    setOrderToCancel(orderToCancelData);
    setShowCancelModal(true);
  };

  const handleConfirmCancelOrder = async () => {
    if (!orderToCancel || !walletAddress) {
      return;
    }

    setCancelingId(orderToCancel.id);
    try {
      if (orderToCancel.onchain_authorized) {
        await cancelRecurringOrderOnchain({
          orderId: orderToCancel.id,
          walletAddress,
          sourceToken: orderToCancel.source_token,
          onchainOrderKey: orderToCancel.onchain_order_key,
        });
      }

      await cancelRecurringOrder(orderToCancel.id, walletAddress);
      setOrders(
        orders.map((o) =>
          o.id === orderToCancel.id ? { ...o, is_active: false } : o,
        ),
      );
      if (selectedOrder?.id === orderToCancel.id) {
        setSelectedOrder({ ...selectedOrder, is_active: false });
      }
      setShowCancelModal(false);
      setOrderToCancel(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to cancel order";
      setError(errorMessage);
      console.error("Error canceling order:", err);
    } finally {
      setCancelingId(null);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  };

  const formatDateTimeShort = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC",
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC",
    });
  };

  const getFrequencyColor = () => {
    return {
      backgroundColor: "rgba(123, 184, 255, 0.15)",
      color: "#7BB8FF",
      borderColor: "rgba(123, 184, 255, 0.4)",
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Successful":
        return "text-green-400";
      case "Failed":
        return "text-red-400";
      case "Pending":
        return "text-yellow-400";
      default:
        return "text-zinc-400";
    }
  };

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-8 text-center border border-zinc-800/30"
      >
        <p className="text-zinc-400">Loading recurring orders...</p>
      </motion.div>
    );
  }

  return (
    <>
      <AppErrorModal
        error={error}
        onClose={() => setError(null)}
        onRetry={loadOrders}
        title="Failed to load recurring orders"
      />
      {orders.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-8 text-center border border-zinc-800/30"
        >
          <p className="text-zinc-400">No recurring orders yet</p>
          <p className="text-zinc-500 text-sm mt-2">
            Create a recurring buy or sell order to get started
          </p>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {/* Orders List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl border border-zinc-800/30 overflow-hidden"
          >
            <div className="p-6 border-b border-zinc-800/30">
              <h3 className="text-lg font-semibold text-white">
                Your Recurring Orders
              </h3>
              <p className="text-zinc-400 text-sm mt-1">
                Total: {orders.length} orders
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800/30 bg-zinc-800/20">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">
                      Pair
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">
                      Frequency
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">
                      Next Exec (UTC)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">
                      Auth
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, idx) => (
                    <motion.tr
                      key={order.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`border-b border-zinc-800/20 hover:bg-zinc-800/30 transition-colors cursor-pointer ${
                        selectedOrder?.id === order.id ? "bg-zinc-800/50" : ""
                      }`}
                      onClick={() => setSelectedOrder(order)}
                    >
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            order.order_type === "buy"
                              ? "bg-green-500/20 text-green-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {order.order_type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-white">
                        {order.source_token} → {order.target_token}
                      </td>
                      <td className="px-6 py-4 text-sm text-white">
                        {order.amount}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold border ${getFrequencyColor()}`}
                        >
                          {order.frequency}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-400">
                        {formatDateTimeShort(order.next_execution_date)} UTC
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-sm font-semibold ${order.onchain_authorized ? "text-green-400" : "text-yellow-400"}`}
                        >
                          {order.onchain_authorized ? "Authorized" : "Pending"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-sm font-semibold ${order.is_active ? "text-green-400" : "text-zinc-500"}`}
                        >
                          {order.is_active ? "Active" : "Cancelled"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {order.is_active && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={(e: MouseEvent<HTMLButtonElement>) => {
                              e.stopPropagation();
                              handleCancelOrder(order.id);
                            }}
                            disabled={cancelingId === order.id}
                            className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-semibold border border-red-500/50 transition-colors disabled:opacity-50"
                          >
                            {cancelingId === order.id
                              ? "Canceling..."
                              : "Cancel"}
                          </motion.button>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Order Details & Execution History */}
          {selectedOrder && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Order Details */}
              <motion.div
                key="details"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-6 border border-zinc-800/30"
              >
                <h3 className="text-lg font-semibold text-white mb-4">
                  Order Details
                </h3>

                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-4 border-b border-zinc-800/30">
                    <span className="text-zinc-400">Type</span>
                    <span
                      className={`font-semibold px-3 py-1 rounded-full text-xs ${
                        selectedOrder.order_type === "buy"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {selectedOrder.order_type.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pb-4 border-b border-zinc-800/30">
                    <span className="text-zinc-400">Trading Pair</span>
                    <span className="font-semibold text-white">
                      {selectedOrder.source_token} →{" "}
                      {selectedOrder.target_token}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pb-4 border-b border-zinc-800/30">
                    <span className="text-zinc-400">Amount per Order</span>
                    <span className="font-semibold text-white">
                      {selectedOrder.amount}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pb-4 border-b border-zinc-800/30">
                    <span className="text-zinc-400">Frequency</span>
                    <span
                      className={`font-semibold px-3 py-1 rounded-full text-xs border ${getFrequencyColor()}`}
                    >
                      {selectedOrder.frequency}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pb-4 border-b border-zinc-800/30">
                    <span className="text-zinc-400">Status</span>
                    <span
                      className={`font-semibold ${selectedOrder.is_active ? "text-green-400" : "text-zinc-500"}`}
                    >
                      {selectedOrder.is_active ? "Active" : "Cancelled"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pb-4 border-b border-zinc-800/30">
                    <span className="text-zinc-400">Next Execution (UTC)</span>
                    <span className="font-semibold text-white">
                      {formatDateTimeShort(selectedOrder.next_execution_date)}{" "}
                      UTC
                    </span>
                  </div>

                  <div className="flex justify-between items-center pb-4 border-b border-zinc-800/30">
                    <span className="text-zinc-400">
                      On-chain Authorization
                    </span>
                    <span
                      className={`font-semibold ${selectedOrder.onchain_authorized ? "text-green-400" : "text-yellow-400"}`}
                    >
                      {selectedOrder.onchain_authorized
                        ? "Authorized"
                        : "Pending"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pb-4 border-b border-zinc-800/30">
                    <span className="text-zinc-400">First Execution (UTC)</span>
                    <span className="font-semibold text-white">
                      {formatDateTime(selectedOrder.start_date)} UTC
                    </span>
                  </div>

                  <div className="flex justify-between items-center pb-4 border-b border-zinc-800/30">
                    <span className="text-zinc-400">End Time (UTC)</span>
                    <span className="font-semibold text-white">
                      {selectedOrder.end_date
                        ? `${formatDateTime(selectedOrder.end_date)} UTC`
                        : "No end time"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Executions</span>
                    <span className="font-semibold text-white">
                      {selectedOrder.execution_count}
                    </span>
                  </div>

                  {selectedOrder.is_active && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleCancelOrder(selectedOrder.id)}
                      disabled={cancelingId === selectedOrder.id}
                      className="w-full mt-4 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold border border-red-500/50 transition-colors disabled:opacity-50"
                    >
                      {cancelingId === selectedOrder.id
                        ? "Canceling..."
                        : "Cancel This Order"}
                    </motion.button>
                  )}
                </div>
              </motion.div>

              {/* Execution History */}
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-6 border border-zinc-800/30"
              >
                <h3 className="text-lg font-semibold text-white mb-4">
                  Execution History
                </h3>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {executionHistory.length === 0 ? (
                    <p className="text-zinc-400 text-center py-8">
                      No executions yet
                    </p>
                  ) : (
                    executionHistory.map((execution, idx) => (
                      <motion.div
                        key={execution.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="p-3 rounded-lg bg-zinc-800/20 border border-zinc-800/50"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span
                            className={`text-xs font-semibold ${getStatusColor(execution.status)}`}
                          >
                            {execution.status}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {formatDateTime(execution.execution_date)}
                          </span>
                        </div>

                        <div className="text-sm text-white mb-2">
                          {execution.amount} {execution.source_token} →{" "}
                          {execution.target_token}
                        </div>

                        {execution.transaction_hash && (
                          <a
                            href={`https://testnet.arcscan.app/tx/${execution.transaction_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:text-blue-300 truncate block"
                          >
                            {execution.transaction_hash.slice(0, 20)}...
                          </a>
                        )}

                        {execution.error_message && (
                          <div className="mt-2">
                            <ErrorBadge
                              message={execution.error_message}
                              fallback="Execution failed."
                            />
                          </div>
                        )}
                      </motion.div>
                    ))
                  )}
                </div>
              </motion.div>
            </div>
          )}

          {/* Cancel Order Confirmation Modal */}
          <AnimatePresence>
            {showCancelModal && orderToCancel && (
              <CancelOrderConfirmationModal
                orderType={orderToCancel.order_type}
                sourceToken={orderToCancel.source_token}
                targetToken={orderToCancel.target_token}
                onConfirm={handleConfirmCancelOrder}
                onCancel={() => {
                  setShowCancelModal(false);
                  setOrderToCancel(null);
                }}
                isLoading={cancelingId === orderToCancel.id}
              />
            )}
          </AnimatePresence>
        </div>
      )}
    </>
  );
};
