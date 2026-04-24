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
import { createRecurringOrder, logOrderCreation } from "@/lib/recurringOrderService";
import { AppErrorModal } from "@/components/AppErrorModal";
import { useRainbowKitAuth } from "@/lib/use-rainbowkit-auth";
import { signBrowserWalletMessage } from "@/lib/browser-wallet";

export const RecurringBuys = () => {
  const { user } = useRainbowKitAuth();
  const walletAddress = user?.wallet?.address;

  const today = new Date();
  const todayFormatted = `${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}/${today.getFullYear()}`;

  const [selectedPayToken, setSelectedPayToken] = useState(tokens[0]);
  const [selectedBuyToken, setSelectedBuyToken] = useState<typeof tokens[0] | null>(null);
  const [amount, setAmount] = useState("10.00");
  const [frequency, setFrequency] = useState("Weekly");
  const [endDate, setEndDate] = useState(todayFormatted);

  const [showFrequencyModal, setShowFrequencyModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
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

    setIsLoading(true);
    setError(null);

    try {
      const message = `I authorize Tower Finance to set up a recurring ${frequency} ${selectedPayToken.symbol} -> ${selectedBuyToken.symbol} buy order for ${amount} ${selectedPayToken.symbol}`;

      let signature: string | undefined;

      try {
        signature = await signBrowserWalletMessage(message, walletAddress);
        console.log("Message signed successfully:", signature);
      } catch (signError) {
        console.warn("Signature request failed:", signError);
      }

      await createRecurringOrder(
        walletAddress,
        "buy",
        selectedPayToken.symbol,
        selectedBuyToken.symbol,
        parseFloat(amount),
        frequency,
        endDate,
        signature,
      );

      setSelectedBuyToken(null);
      setAmount("10.00");
      setFrequency("Weekly");
      const newToday = new Date();
      const newTodayFormatted = `${String(newToday.getMonth() + 1).padStart(2, "0")}/${String(newToday.getDate()).padStart(2, "0")}/${newToday.getFullYear()}`;
      setEndDate(newTodayFormatted);

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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FrequencyField
            label="Frequency"
            value={frequency}
            showInfo
            infoMessage="Choose how often you want to execute this order"
            onClick={() => setShowFrequencyModal(true)}
          />
          <FrequencyField
            label="End Date"
            value={endDate}
            showInfo
            infoMessage="Set when you want this recurring order to stop executing"
            optional
            onClick={() => setShowDatePicker(true)}
            tooltipDirection="responsive"
          />
        </div>

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={handleContinue}
          disabled={isLoading}
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
          onSelect={setEndDate}
          currentValue={endDate}
        />
      </AnimatePresence>
    </>
  );
};
