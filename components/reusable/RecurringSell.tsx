"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { tokens } from "@/mockData/token";
import { TokenDropdown } from "./TokenDropdown";
import { FrequencyField } from "./FrequencyField";
import { AmountInput } from "./AmountInput";

export const RecurringSell = () => {
  const [selectedSellToken, setSelectedSellToken] = useState(null);
  const [selectedConvertToken, setSelectedConvertToken] = useState(tokens[0]);
  const [amount] = useState("10.00");
  const [frequency] = useState("Weekly");
  const [endDate] = useState("Weekly");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="bg-zinc-900 rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-6"
    >
      <AmountInput amount={amount} readOnly />

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
        <FrequencyField label="Pay With" value={frequency} showInfo />
        <FrequencyField label="End Date" value={endDate} showInfo optional />
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full py-3 rounded-xl bg-white text-black font-semibold hover:bg-gray-100 transition-colors text-sm sm:text-base"
      >
        Continue
      </motion.button>
    </motion.div>
  );
};
