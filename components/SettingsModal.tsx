"use client";
import { X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  const [slippage, setSlippage] = useState("0.2");
  const [customSlippage, setCustomSlippage] = useState("");

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="bg-[#18191b] border border-border/50 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
            <h3 className="text-base font-medium text-foreground/90">
              Swap Settings
            </h3>
            <motion.button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[#191A1C] transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </motion.button>
          </div>

          <div className="p-6">
            <div>
              <h4 className="text-sm text-muted-foreground mb-3">Slippage</h4>
              <div className="flex items-center gap-2">
                {["0.1", "0.2", "0.5"].map((value) => (
                  <motion.button
                    key={value}
                    onClick={() => {
                      setSlippage(value);
                      setCustomSlippage("");
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      slippage === value && !customSlippage
                        ? "bg-secondary text-foreground"
                        : "bg-[#1a1b1e] text-muted-foreground hover:bg-secondary/50"
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {value}%
                  </motion.button>
                ))}
                <motion.button
                  onClick={() => {
                    setSlippage("custom");
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    slippage === "custom" || customSlippage
                      ? "bg-secondary text-foreground"
                      : "bg-[#1a1b1e] text-muted-foreground hover:bg-secondary/50"
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Custom
                </motion.button>
                <input
                  type="text"
                  value={customSlippage}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "" || /^\d*\.?\d*$/.test(value)) {
                      setCustomSlippage(value);
                      if (value) setSlippage("custom");
                    }
                  }}
                  placeholder="0.0"
                  className="w-20 bg-[#1a1b1e] border-0 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-border transition-all"
                />
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SettingsModal;
export type { SettingsModalProps };
