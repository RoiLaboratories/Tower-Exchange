"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { tokens } from "@/mockData/token";
import { TokenDropdown } from "./TokenDropdown";
import { FrequencyField } from "./FrequencyField";
import { AmountInput } from "./AmountInput";
import { FrequencyModal } from "../FrequencyModal";
import { DatePicker } from "../DatePicker";
import { createRecurringOrder } from "@/lib/recurringOrderService";

export const RecurringBuys = () => {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const walletAddress = user?.wallet?.address;

  const [selectedPayToken, setSelectedPayToken] = useState(tokens[0]);
  const [selectedBuyToken, setSelectedBuyToken] = useState<typeof tokens[0] | null>(null);
  const [amount, setAmount] = useState("10.00");
  const [frequency, setFrequency] = useState("Weekly");
  const [endDate, setEndDate] = useState("01/22/2026");

  const [showFrequencyModal, setShowFrequencyModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter tokens to exclude the selected pay token
  const availableTokensForBuy = tokens.filter(
    (token) => token.symbol !== selectedPayToken.symbol
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
      // Step 1: Create message to sign
      const message = `I authorize Tower Finance to set up a recurring ${frequency} ${selectedPayToken.symbol} → ${selectedBuyToken.symbol} buy order for ${amount} ${selectedPayToken.symbol}`;
      
      let signature: string | undefined;

      try {
        // Step 2: Get the wallet and sign the message
        const connectedWallet = wallets.find(
          (w) => w.address?.toLowerCase() === walletAddress.toLowerCase()
        );

        if (!connectedWallet) {
          throw new Error("Connected wallet not found");
        }

        // Get the EIP-1193 provider from the wallet
        const eip1193Provider = await connectedWallet.getEthereumProvider();

        if (!eip1193Provider) {
          throw new Error("Failed to get wallet provider");
        }

        // Convert message to hex
        const messageHex = "0x" + Buffer.from(message).toString("hex");

        // Request signature - WALLET WILL PROMPT USER
        signature = await eip1193Provider.request({
          method: "personal_sign",
          params: [messageHex, walletAddress],
        }) as string;

        console.log("✅ Message signed successfully:", signature);
      } catch (signError) {
        console.warn("⚠️ Signature request failed:", signError);
        // Proceed without signature (optional - can require it)
      }

      // Step 3: Create the recurring order in the database
      const order = await createRecurringOrder(
        walletAddress,
        "buy",
        selectedPayToken.symbol,
        selectedBuyToken.symbol,
        parseFloat(amount),
        frequency,
        endDate,
        signature
      );

      // Reset form
      setSelectedBuyToken(null);
      setAmount("10.00");
      setFrequency("Weekly");
      setEndDate("01/22/2026");

      // Show success message
      setError(null);
      console.log("✅ Recurring buy order created successfully", order);
      
      // Show success alert
      alert(`Recurring buy order created! Orders will execute ${frequency.toLowerCase()}.`);
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-6 space-y-5 border border-zinc-800/30"
      >
        <AmountInput amount={amount} onChange={setAmount} />

        <TokenDropdown
          label="Pay With"
          selected={selectedPayToken}
          onSelect={setSelectedPayToken}
          showInfo
        />

        <TokenDropdown
          label="Buy"
          selected={selectedBuyToken}
          onSelect={setSelectedBuyToken}
          availableTokens={availableTokensForBuy}
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
