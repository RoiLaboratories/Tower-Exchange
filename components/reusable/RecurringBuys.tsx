"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { tokens } from "@/mockData/token";
import { TokenDropdown } from "./TokenDropdown";
import { FrequencyField } from "./FrequencyField";
import { AmountInput } from "./AmountInput";
import { FrequencyModal } from "../FrequencyModal";
import { DatePicker } from "../DatePicker";

export const RecurringBuys = () => {
  const [selectedPayToken, setSelectedPayToken] = useState(tokens[0]);
  const [selectedBuyToken, setSelectedBuyToken] = useState(null);
  const [amount] = useState("10.00");
  const [frequency, setFrequency] = useState("Weekly");
  const [endDate, setEndDate] = useState("01/22/2026");

  const [showFrequencyModal, setShowFrequencyModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-6 space-y-5 border border-zinc-800/30"
      >
        <AmountInput amount={amount} readOnly />

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
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Changed label from "Pay With" to "Frequency" and added onClick */}
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

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="w-full py-3 rounded-xl bg-white text-black font-semibold hover:bg-gray-100 transition-colors text-sm mt-2"
        >
          Continue
        </motion.button>
      </motion.div>

      <AnimatePresence>
        <FrequencyModal
          isOpen={showFrequencyModal}
          onClose={() => setShowFrequencyModal(false)}
          onSelect={setFrequency}
          currentValue={frequency}
        />
        <DatePicker
          isOpen={showDatePicker}
          onClose={() => setShowDatePicker(false)}
          onSelect={setEndDate}
          currentValue={endDate}
        />
      </AnimatePresence>
    </>
  );
};
