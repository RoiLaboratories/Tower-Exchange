"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { tokens } from "@/mockData/token";
import { TokenDropdown } from "./TokenDropdown";
import { FrequencyField } from "./FrequencyField";
import { AmountInput } from "./AmountInput";
import { FrequencyModal } from "../FrequencyModal";
import { DatePicker } from "../DatePicker";
import RecurringOrderNotification from "../RecurringOrderNotification";
import {
  createRecurringOrder,
  logOrderCreation,
  updateRecurringOrder,
} from "@/lib/recurringOrderService";
import {
  authorizeRecurringOrderOnchain,
  isRecurringOrderTokenSupported,
} from "@/lib/recurringOrderExecutor";
import { AppErrorModal } from "@/components/AppErrorModal";
import { useRainbowKitAuth } from "@/lib/use-rainbowkit-auth";

export const RecurringBuys = () => {
  const { user } = useRainbowKitAuth();
  const walletAddress = user?.wallet?.address;

  const today = new Date();
  const todayFormatted = `${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}/${today.getFullYear()}`;

  const [selectedPayToken, setSelectedPayToken] = useState(tokens[0]);
  const [selectedBuyToken, setSelectedBuyToken] = useState<typeof tokens[0] | null>(null);
  const [amount, setAmount] = useState("10.00");
  const [frequency, setFrequency] = useState("Weekly");
  const [firstExecutionDate, setFirstExecutionDate] = useState(todayFormatted);
  const [endDate, setEndDate] = useState("");

  const [showFrequencyModal, setShowFrequencyModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationData, setNotificationData] = useState<{
    amount: string;
    sourceToken: string;
    targetToken: string;
    frequency: string;
  } | null>(null);

  const availableTokensForBuy = tokens.filter(
    (token) => token.symbol !== selectedPayToken.symbol,
  );
  const amountValue = Number.parseFloat(amount);
  const endDateIsValid =
    !endDate || new Date(endDate).getTime() >= new Date(firstExecutionDate).getTime();
  const canContinue =
    Boolean(walletAddress) &&
    Boolean(selectedBuyToken) &&
    Number.isFinite(amountValue) &&
    amountValue > 0 &&
    endDateIsValid;

  const handleStartDateSelect = (date: string) => {
    setFirstExecutionDate(date);
    if (endDate && new Date(endDate).getTime() < new Date(date).getTime()) {
      setEndDate("");
    }
  };

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

    if (!isRecurringOrderTokenSupported(selectedPayToken.symbol)) {
      setError(`${selectedPayToken.symbol} is not supported for automatic recurring orders yet.`);
      return;
    }

    setIsLoading(true);
    setError(null);
    let createdOrderId: string | null = null;

    try {
      const order = await createRecurringOrder(
        walletAddress,
        "buy",
        selectedPayToken.symbol,
        selectedBuyToken.symbol,
        parseFloat(amount),
        frequency,
        firstExecutionDate,
        endDate || null,
      );
      createdOrderId = order.id;

      const authorization = await authorizeRecurringOrderOnchain({
        orderId: order.id,
        walletAddress,
        sourceToken: selectedPayToken.symbol,
        targetToken: selectedBuyToken.symbol,
        amount: parseFloat(amount),
        frequency,
        startDate: order.next_execution_date,
        endDate: order.end_date,
      });

      await updateRecurringOrder(order.id, {
        onchain_order_key: authorization.orderKey,
        executor_address: authorization.executorAddress,
        ...(authorization.approvalHash && {
          approval_transaction_hash: authorization.approvalHash,
        }),
        authorization_transaction_hash: authorization.authorizationHash,
        onchain_authorized: true,
      });

      setSelectedBuyToken(null);
      setAmount("10.00");
      setFrequency("Weekly");
      setEndDate("");
      const newToday = new Date();
      const newTodayFormatted = `${String(newToday.getMonth() + 1).padStart(2, "0")}/${String(newToday.getDate()).padStart(2, "0")}/${newToday.getFullYear()}`;
      setFirstExecutionDate(newTodayFormatted);

      setNotificationData({
        amount,
        sourceToken: selectedPayToken.symbol,
        targetToken: selectedBuyToken.symbol,
        frequency,
      });
      setShowNotification(true);

      try {
        await logOrderCreation(
          walletAddress,
          selectedPayToken.symbol,
          selectedBuyToken.symbol,
          "buy",
          parseFloat(amount),
        );
      } catch (logError) {
        console.error("Error logging order creation:", logError);
      }
    } catch (err) {
      if (createdOrderId) {
        await updateRecurringOrder(createdOrderId, { is_active: false }).catch((updateError) => {
          console.error("Error deactivating unauthorized recurring buy:", updateError);
        });
      }
      const errorMsg = err instanceof Error ? err.message : "Failed to create recurring buy order";
      setError(errorMsg);
      console.error("Error creating recurring buy:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <AppErrorModal error={error} onClose={() => setError(null)} title="Failed to create order" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="space-y-4 rounded-[24px] border border-[#243046] bg-[#151517] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] backdrop-blur-sm sm:space-y-5 sm:rounded-[28px] sm:p-5"
      >
        <AmountInput amount={amount} onChange={setAmount} />

        <TokenDropdown
          label="Pay With"
          selected={selectedPayToken}
          onSelect={setSelectedPayToken}
          showInfo
          infoMessage="Select which token you'll use to make your regular purchases"
        />

        <TokenDropdown
          label="Buy"
          selected={selectedBuyToken}
          onSelect={setSelectedBuyToken}
          availableTokens={availableTokensForBuy}
          showInfo
          infoMessage="Select which token you want to buy regularly"
        />

        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-4">
          <FrequencyField
            label="Frequency"
            value={frequency}
            showInfo
            infoMessage="Choose how often you want to execute this order"
            onClick={() => setShowFrequencyModal(true)}
          />
          <FrequencyField
            label="Start Date"
            value={firstExecutionDate}
            showInfo
            infoMessage="Set the first date this recurring order should execute"
            optional
            onClick={() => setShowDatePicker(true)}
            tooltipDirection="responsive"
          />
          <div>
            <FrequencyField
              label="End Date"
              value={endDate || "No end date"}
              showInfo
              infoMessage="Set the last date this recurring order may execute"
              optional
              onClick={() => setShowEndDatePicker(true)}
              tooltipDirection="left"
            />
            {endDate && (
              <button
                type="button"
                onClick={() => setEndDate("")}
                className="mt-2 text-xs font-medium text-zinc-400 transition-colors hover:text-white"
              >
                Clear end date
              </button>
            )}
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={handleContinue}
          disabled={isLoading || !canContinue}
          className="mt-1 w-full rounded-[16px] bg-white py-3 text-sm font-semibold text-black transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 sm:mt-2 sm:rounded-[18px]"
        >
          {isLoading ? "Creating Order..." : "Continue"}
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {showNotification && notificationData && (
          <RecurringOrderNotification
            orderType="buy"
            amount={notificationData.amount}
            sourceToken={notificationData.sourceToken}
            targetToken={notificationData.targetToken}
            frequency={notificationData.frequency}
            onClose={() => setShowNotification(false)}
          />
        )}
        <FrequencyModal
          key="frequency-modal"
          isOpen={showFrequencyModal}
          onClose={() => setShowFrequencyModal(false)}
          onSelect={setFrequency}
          currentValue={frequency}
        />
        <DatePicker
          key="date-picker"
          isOpen={showDatePicker}
          onClose={() => setShowDatePicker(false)}
          onSelect={handleStartDateSelect}
          currentValue={firstExecutionDate}
        />
        <DatePicker
          key="end-date-picker"
          isOpen={showEndDatePicker}
          onClose={() => setShowEndDatePicker(false)}
          onSelect={setEndDate}
          currentValue={endDate || firstExecutionDate}
          minDate={firstExecutionDate}
        />
      </AnimatePresence>
    </>
  );
};
