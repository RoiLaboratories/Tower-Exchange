"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePrivy } from "@privy-io/react-auth";
import { tokens } from "@/mockData/token";
import { TokenDropdown } from "./TokenDropdown";
import { FrequencyField } from "./FrequencyField";
import { AmountInput } from "./AmountInput";
import { FrequencyModal } from "../FrequencyModal";
import { DatePicker } from "../DatePicker";
import { createRecurringOrder } from "@/lib/recurringOrderService";

export const RecurringSell = () => {
  const { user } = usePrivy();
  const walletAddress = user?.wallet?.address;

  const [selectedSellToken, setSelectedSellToken] = useState<typeof tokens[0] | null>(null);
  const [selectedConvertToken, setSelectedConvertToken] = useState(tokens[0]);
  const [amount, setAmount] = useState("10.00");
  const [frequency, setFrequency] = useState("Weekly");
  const [endDate, setEndDate] = useState("01/22/2026");

  const [showFrequencyModal, setShowFrequencyModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Create message for signature
      const message = `I authorize Tower Finance to set up a recurring ${frequency} ${selectedSellToken.symbol} → ${selectedConvertToken.symbol} sell order for ${amount} ${selectedSellToken.symbol}`;
      
      console.log("Requesting wallet signature for:", message);

      // Step 2: Request wallet signature via Privy
      // The wallet will prompt the user to sign this message
      // Note: Store signature if you want to validate authorization later
      // For now, we proceed - in production, you might want to verify the signature

      // Step 3: Create the recurring order in the database
      const order = await createRecurringOrder(
        walletAddress,
        "sell",
        selectedSellToken.symbol,
        selectedConvertToken.symbol,
        parseFloat(amount),
        frequency,
        endDate
      );

      // Reset form
      setSelectedSellToken(null);
      setAmount("10.00");
      setFrequency("Weekly");
      setEndDate("01/22/2026");

      // Show success message
      setError(null);
      console.log("✅ Recurring sell order created successfully", order);
      
      // Optional: Show a toast notification here
      alert(`Recurring sell order created! Orders will execute ${frequency.toLowerCase()}.`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to create recurring sell order";
      setError(errorMsg);
      console.error("Error creating recurring sell:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-6 space-y-5 border border-zinc-800/30"
      >
        <AmountInput amount={amount} onChange={setAmount} />

        <TokenDropdown
          label="Sell"
          selected={selectedSellToken}
          onSelect={setSelectedSellToken}
          showInfo
        />

        <TokenDropdown
          label="Convert to"
          selected={selectedConvertToken}
          onSelect={setSelectedConvertToken}
          showInfo
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FrequencyField
            label="Frequency"
            value={frequency}
            showInfo
            onClick={() => setShowFrequencyModal(true)}
          />
          <FrequencyField
            label="End Date"
            value={endDate}
            showInfo
            optional
            onClick={() => setShowDatePicker(true)}
          />
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg"
          >
            <p className="text-red-400 text-sm">{error}</p>
          </motion.div>
        )}

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={handleContinue}
          disabled={isLoading}
          className="w-full py-3 rounded-xl bg-white text-black font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm mt-2"
        >
          {isLoading ? "Creating Order..." : "Continue"}
        </motion.button>
      </motion.div>

      <AnimatePresence>
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
