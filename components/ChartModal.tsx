"use client";
import { X } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";

import usdcLogo from "@/public/assets/USDC-fotor-bg-remover-2025111075935.png";
import ethLogo from "@/public/assets/Eth_logo_3-removebg-preview.png";

interface ChartModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChartModal = ({ isOpen, onClose }: ChartModalProps) => {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="fixed top-1/2 -translate-y-1/2 right-8 w-full max-w-xl bg-[#18191b] border border-border/50 rounded-2xl shadow-2xl z-40 overflow-hidden"
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center overflow-hidden">
                <Image
                  src={ethLogo}
                  alt="ETH logo"
                  width={32}
                  height={32}
                  className="object-contain w-full h-full"
                />
              </div>
              <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center overflow-hidden -ml-3">
                <Image
                  src={usdcLogo}
                  alt="USDC logo"
                  width={32}
                  height={32}
                  className="object-contain w-full h-full"
                />
              </div>
            </div>
            <h2 className="text-2xl font-semibold text-foreground">ETH/USDC</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-2">
              {["24H", "7D", "1M", "3M", "6M"].map((period) => (
                <motion.button
                  key={period}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    period === "24H"
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/50"
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {period}
                </motion.button>
              ))}
            </div>
            <motion.button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-secondary transition-colors ml-2"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </motion.button>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-green-500">+16.0%</span>
            <span className="text-xs text-muted-foreground">in 24h</span>
          </div>
          <div className="flex items-end justify-between">
            <h3 className="text-4xl font-bold text-foreground">3200.23 USDC</h3>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Market Cap</p>
                <p className="text-base font-semibold text-foreground">
                  $78.0B
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Volume</p>
                <p className="text-base font-semibold text-foreground">$8.0B</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Markets</p>
                <p className="text-base font-semibold text-foreground">5</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#151617] rounded-xl p-6 h-80 flex items-center justify-center">
          <p className="text-muted-foreground">Chart visualization area</p>
        </div>
      </div>
    </motion.div>
  );
};

export default ChartModal;
export type { ChartModalProps };
