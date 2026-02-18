"use client";
import { X, Check } from "lucide-react";
import { motion } from "framer-motion";

interface RecurringOrderNotificationProps {
  orderType: "buy" | "sell";
  amount: string;
  sourceToken: string;
  targetToken: string;
  frequency: string;
  onClose: () => void;
}

const RecurringOrderNotification = ({
  orderType,
  amount,
  sourceToken,
  targetToken,
  frequency,
  onClose,
}: RecurringOrderNotificationProps) => {
  const orderTypeLabel = orderType === "buy" ? "Buy" : "Sell";

  return (
    <motion.div
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -50 }}
      transition={{ duration: 0.3 }}
      className="fixed top-8 left-1/2 transform -translate-x-1/2 z-50"
    >
      <div className="bg-[#1a1d1f] backdrop-blur-md rounded-2xl px-5 py-4 shadow-2xl flex items-start gap-3 min-w-[320px] border border-white/10">
        <div className="pt-0.5">
          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
            <Check className="w-3 h-3 text-white" strokeWidth={3} />
          </div>
        </div>

        <div className="flex-1">
          <h3 className="font-semibold text-white text-base mb-1">
            Order Placed Successfully!
          </h3>
          <p className="text-sm text-gray-300">
            Recurring {orderTypeLabel} order created
          </p>
          <p className="text-sm text-gray-300 mb-2">
            {amount} {sourceToken} → {targetToken}
          </p>
          <p className="text-xs text-gray-400">
            Executes {frequency.toLowerCase()}
          </p>
        </div>

        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
};

export default RecurringOrderNotification;
