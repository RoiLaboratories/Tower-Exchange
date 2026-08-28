"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { tokens } from "@/mockData/token";
import { TokenDropdown } from "./TokenDropdown";
import { FrequencyField } from "./FrequencyField";
import { AmountInput } from "./AmountInput";
import { FrequencyModal } from "../FrequencyModal";
import { DateTimePickerModal } from "../DateTimePickerModal";
import RecurringOrderNotification from "../RecurringOrderNotification";
import {
  createRecurringOrder,
  formatUtcDateTimeCompactLabel,
  formatUtcDateTimeLabel,
  getDefaultRecurringExecutionUtc,
  logOrderCreation,
  markRecurringOrderAuthorized,
  updateRecurringOrder,
} from "@/lib/recurringOrderService";
import {
  authorizeRecurringOrderOnchain,
  isRecurringOrderTokenSupported,
} from "@/lib/recurringOrderExecutor";
import { AppErrorModal } from "@/components/AppErrorModal";
import { useRainbowKitAuth } from "@/lib/use-rainbowkit-auth";

const recurringTokens = tokens.filter((token) =>
  ["USDC", "EURC", "USDT", "cirBTC", "cNGN", "QCAD"].includes(token.symbol),
);

export const RecurringSell = () => {
  const { user } = useRainbowKitAuth();
  const walletAddress = user?.wallet?.address;

  const [selectedSellToken, setSelectedSellToken] = useState<typeof tokens[0] | null>(null);
  const [selectedConvertToken, setSelectedConvertToken] = useState(recurringTokens[0]);
  const [amount, setAmount] = useState("10.00");
  const [frequency, setFrequency] = useState("Weekly");
  const [firstExecutionDate, setFirstExecutionDate] = useState(
    getDefaultRecurringExecutionUtc(),
  );
  const [endDate, setEndDate] = useState<string | null>(null);

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

  const amountValue = Number.parseFloat(amount);
  const endDateIsValid =
    !endDate || new Date(endDate).getTime() >= new Date(firstExecutionDate).getTime();
  const disabledSellTokenSymbols = [selectedConvertToken.symbol];
  const disabledConvertTokenSymbols = selectedSellToken
    ? [selectedSellToken.symbol]
    : [];
  const canContinue =
    Boolean(walletAddress) &&
    Boolean(selectedSellToken) &&
    Number.isFinite(amountValue) &&
    amountValue > 0 &&
    endDateIsValid;

  const handleStartDateSelect = (date: string) => {
    setFirstExecutionDate(date);
    if (endDate && new Date(endDate).getTime() < new Date(date).getTime()) {
      setEndDate(null);
    }
  };

  const handleContinue = async () => {
    if (!walletAddress) {
      setError("Please connect your wallet");
      return;
    }

    if (!selectedSellToken) {
      setError("Please select a token to sell");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (!isRecurringOrderTokenSupported(selectedSellToken.symbol)) {
      setError(`${selectedSellToken.symbol} is not supported for automatic recurring orders yet.`);
      return;
    }

    setIsLoading(true);
    setError(null);
    let createdOrderId: string | null = null;

    try {
      const order = await createRecurringOrder(
        walletAddress,
        "sell",
        selectedSellToken.symbol,
        selectedConvertToken.symbol,
        parseFloat(amount),
        frequency,
        firstExecutionDate,
        endDate,
      );
      createdOrderId = order.id;

      const authorization = await authorizeRecurringOrderOnchain({
        orderId: order.id,
        walletAddress,
        sourceToken: selectedSellToken.symbol,
        targetToken: selectedConvertToken.symbol,
        amount: parseFloat(amount),
        frequency,
        startDate: order.next_execution_date,
        endDate: order.end_date,
      });

      await markRecurringOrderAuthorized(order.id, walletAddress, {
        orderKey: authorization.orderKey,
        executorAddress: authorization.executorAddress,
        authorizationHash: authorization.authorizationHash,
        approvalHash: authorization.approvalHash,
      });

      setSelectedSellToken(null);
      setAmount("10.00");
      setFrequency("Weekly");
      setEndDate(null);
      setFirstExecutionDate(getDefaultRecurringExecutionUtc());

      setNotificationData({
        amount,
        sourceToken: selectedSellToken.symbol,
        targetToken: selectedConvertToken.symbol,
        frequency,
      });
      setShowNotification(true);

      try {
        await logOrderCreation(
          walletAddress,
          selectedSellToken.symbol,
          selectedConvertToken.symbol,
          "sell",
          parseFloat(amount),
        );
      } catch (logError) {
        console.error("Error logging order creation:", logError);
      }
    } catch (err) {
      if (createdOrderId) {
        await updateRecurringOrder(createdOrderId, walletAddress, { is_active: false }).catch((updateError) => {
          console.error("Error deactivating unauthorized recurring sell:", updateError);
        });
      }
      const errorMsg = err instanceof Error ? err.message : "Failed to create recurring sell order";
      setError(errorMsg);
      console.error("Error creating recurring sell:", err);
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
        className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] backdrop-blur-sm sm:space-y-5 sm:rounded-2xl sm:p-5"
      >
        <AmountInput amount={amount} onChange={setAmount} />

        <TokenDropdown
          label="Sell"
          selected={selectedSellToken}
          onSelect={setSelectedSellToken}
          availableTokens={recurringTokens}
          disabledTokenSymbols={disabledSellTokenSymbols}
          showInfo
          infoMessage="Select which token you want to sell regularly"
        />

        <TokenDropdown
          label="Convert to"
          selected={selectedConvertToken}
          onSelect={setSelectedConvertToken}
          availableTokens={recurringTokens}
          disabledTokenSymbols={disabledConvertTokenSymbols}
          showInfo
          infoMessage="Select which token you want to receive from your sales"
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
            label="Start Time"
            value={formatUtcDateTimeCompactLabel(firstExecutionDate)}
            compactValue
            centerValue
            showInfo
            infoMessage="Set the exact UTC time when this recurring order should first execute"
            optional
            onClick={() => setShowDatePicker(true)}
            tooltipDirection="responsive"
          />
          <div>
            <FrequencyField
              label="End Time"
              value={endDate ? formatUtcDateTimeCompactLabel(endDate) : "No end time"}
              compactValue
              centerValue
              showInfo
              infoMessage="Set the final UTC time after which this recurring order should stop"
              optional
              onClick={() => setShowEndDatePicker(true)}
              tooltipDirection="left"
            />
            {endDate && (
              <button
                type="button"
                onClick={() => setEndDate(null)}
                className="mt-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Clear end time
              </button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Tracking in UTC</p>
          <p className="mt-1 leading-6">
            First execution: <span className="text-foreground">{formatUtcDateTimeLabel(firstExecutionDate)}</span>
          </p>
          <p className="leading-6">
            End time: <span className="text-foreground">{endDate ? formatUtcDateTimeLabel(endDate) : "No end time"}</span>
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={handleContinue}
          disabled={isLoading || !canContinue}
          className="mt-1 w-full rounded-[16px] bg-primary py-3 text-sm font-semibold text-[#0C0C0D] transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:mt-2 sm:rounded-[18px]"
        >
          {isLoading ? "Creating Order..." : "Continue"}
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {showNotification && notificationData && (
          <RecurringOrderNotification
            orderType="sell"
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
        <DateTimePickerModal
          key="start-date-time-picker"
          isOpen={showDatePicker}
          onClose={() => setShowDatePicker(false)}
          onSave={handleStartDateSelect}
          currentValue={firstExecutionDate}
          title="Choose first execution time"
          description="Select the first UTC date and time this order should run."
        />
        <DateTimePickerModal
          key="end-date-time-picker"
          isOpen={showEndDatePicker}
          onClose={() => setShowEndDatePicker(false)}
          onSave={setEndDate}
          currentValue={endDate || firstExecutionDate}
          minValue={firstExecutionDate}
          title="Choose end time"
          description="Select the last UTC moment this recurring order is allowed to execute."
          allowClear
          onClear={() => setEndDate(null)}
        />
      </AnimatePresence>
    </>
  );
};
