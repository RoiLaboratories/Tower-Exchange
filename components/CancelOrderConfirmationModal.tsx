"use client";
import { AlertCircle, X } from "lucide-react";
import { motion } from "framer-motion";

interface CancelOrderConfirmationModalProps {
  orderType: "buy" | "sell";
  sourceToken: string;
  targetToken: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const CancelOrderConfirmationModal = ({
  orderType,
  sourceToken,
  targetToken,
  onConfirm,
  onCancel,
  isLoading = false,
}: CancelOrderConfirmationModalProps) => {
  const orderTypeLabel = orderType === "buy" ? "Buy" : "Sell";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3 }}
        className="bg-[#1a1d1f] backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-white/10 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="pt-0.5">
            <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
              <AlertCircle className="w-3 h-3 text-white" strokeWidth={3} />
            </div>
          </div>

          <div className="flex-1">
            <h3 className="font-semibold text-white text-base">
              Cancel Order?
            </h3>
            <p className="text-sm text-gray-300 mt-1">
              This will stop the recurring {orderTypeLabel.toLowerCase()} order for {sourceToken} → {targetToken}
            </p>
          </div>

          <button
            onClick={onCancel}
            disabled={isLoading}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Keep Order
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Cancelling...</span>
              </>
            ) : (
              "Cancel Order"
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CancelOrderConfirmationModal;
