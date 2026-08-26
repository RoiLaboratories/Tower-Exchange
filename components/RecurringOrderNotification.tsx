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
      <div className="bg-card backdrop-blur-md rounded-2xl px-5 py-4 shadow-2xl flex items-start gap-3 min-w-[320px] border border-border">
        <div className="pt-0.5">
          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
            <Check className="w-3 h-3 text-foreground" strokeWidth={3} />
          </div>
        </div>

        <div className="flex-1">
          <h3 className="font-semibold text-foreground text-base mb-1">
            Order Placed Successfully!
          </h3>
          <p className="text-sm text-muted-foreground">
            Recurring {orderTypeLabel} order created
          </p>
          <p className="text-sm text-muted-foreground mb-2">
            {amount} {sourceToken} ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ {targetToken}
          </p>
          <p className="text-xs text-muted-foreground">
            Executes {frequency.toLowerCase()}
          </p>
        </div>

        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
};

export default RecurringOrderNotification;
