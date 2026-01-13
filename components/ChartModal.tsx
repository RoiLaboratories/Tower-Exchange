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
    <>
      {/* Backdrop for mobile */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 z-30 md:hidden"
      />

      {/* Modal */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="fixed inset-0 md:top-1/2 md:-translate-y-1/2 md:right-8 md:inset-auto w-full md:max-w-xl bg-[#18191b] border-0 md:border border-border/50 md:rounded-2xl shadow-2xl z-40 overflow-auto"
      >
        <div className="p-4 sm:p-6">
          {/* Header */}
          <div className="flex items-start md:items-center justify-between mb-4 sm:mb-6 flex-col md:flex-row gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/30 flex items-center justify-center overflow-hidden">
                  <Image
                    src={ethLogo}
                    alt="ETH logo"
                    width={40}
                    height={40}
                    className="object-contain w-full h-full"
                  />
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/30 flex items-center justify-center overflow-hidden -ml-3">
                  <Image
                    src={usdcLogo}
                    alt="USDC logo"
                    width={40}
                    height={40}
                    className="object-contain w-full h-full"
                  />
                </div>
              </div>
              <h2 className="text-xl sm:text-2xl font-semibold text-foreground">
                ETH/USDC
              </h2>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              {/* Time period buttons */}
              <div className="flex gap-1 sm:gap-2 flex-1 md:flex-initial overflow-x-auto">
                {["24H", "7D", "1M", "3M", "6M"].map((period) => (
                  <motion.button
                    key={period}
                    className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
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

              {/* Close button */}
              <motion.button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-secondary transition-colors shrink-0"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </motion.button>
            </div>
          </div>

          {/* Price info */}
          <div className="mb-4 sm:mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-green-500">+16.0%</span>
              <span className="text-xs text-muted-foreground">in 24h</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">
                3200.23 USDC
              </h3>
              <div className="grid grid-cols-3 sm:flex sm:items-center gap-4 sm:gap-6">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Market Cap
                  </p>
                  <p className="text-sm sm:text-base font-semibold text-foreground">
                    $78.0B
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Volume</p>
                  <p className="text-sm sm:text-base font-semibold text-foreground">
                    $8.0B
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Markets</p>
                  <p className="text-sm sm:text-base font-semibold text-foreground">
                    5
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Chart area */}
          <div className="bg-[#151617] rounded-xl p-4 sm:p-6 h-64 sm:h-80 flex items-center justify-center">
            <p className="text-muted-foreground text-sm sm:text-base">
              Chart visualization area
            </p>
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default ChartModal;
export type { ChartModalProps };
