"use client";
import { X } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";
import { useState, useEffect } from "react";

import usdcLogo from "@/public/assets/usdc.svg";
import ethLogo from "@/public/assets/Eth_logo_3-removebg-preview.png";

interface ChartModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChartModal = ({ isOpen, onClose }: ChartModalProps) => {
  const [selectedPeriod, setSelectedPeriod] = useState("24H");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isOpen) return null;

  const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;

  return (
    <>
      {/* Backdrop for mobile */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
      />

      {/* Modal */}
      <motion.div
        initial={isMobile ? { y: "100%", opacity: 0 } : { opacity: 0 }}
        animate={isMobile ? { y: 0, opacity: 1 } : { opacity: 1 }}
        exit={isMobile ? { y: "100%", opacity: 0 } : { opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={isMobile ? "fixed bottom-0 left-0 right-0 z-40 w-full max-h-[70vh] overflow-x-hidden overflow-y-auto bg-[#18191b] border-b border-border/50 shadow-2xl rounded-t-2xl" : "hidden lg:block w-[32rem] shrink-0 overflow-x-hidden overflow-y-auto bg-[#18191b] border border-border/50 shadow-2xl rounded-2xl"}
        style={
          {
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          } as React.CSSProperties
        }
      >
        <div className="p-4 sm:p-6 relative">
          {/* Close button - positioned at top right corner on mobile */}
          <motion.button
            onClick={onClose}
            className="absolute top-4 right-4 lg:hidden p-2 rounded-lg hover:bg-secondary transition-colors z-10"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </motion.button>

          {/* Header */}
          <div className="mb-4 flex flex-col items-start gap-4 sm:mb-6 lg:flex-row lg:items-center lg:justify-between">
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

            <div className="hidden lg:flex items-center gap-1">
              {/* Time period buttons */}
              {["24H", "7D", "1M", "3M", "6M"].map((period) => (
                <motion.button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    period === selectedPeriod
                      ? "bg-[#151617] text-foreground border border-gray-700"
                      : "text-muted-foreground hover:bg-secondary/50"
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {period}
                </motion.button>
              ))}

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

          {/* Mobile: Time period buttons */}
          <div className="flex lg:hidden w-full items-center gap-1">
            <div className="flex flex-1 gap-1 overflow-x-auto scrollbar-hide">
              {["24H", "7D", "1M", "3M", "6M"].map((period) => (
                <motion.button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-2 sm:px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    period === selectedPeriod
                      ? "bg-[#151617] text-foreground border border-gray-700"
                      : "text-muted-foreground hover:bg-secondary/50"
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {period}
                </motion.button>
              ))}
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
              <div className="flex items-end gap-6">
                <div>
                  <p className="text-xs text-muted-foreground mb-1 whitespace-nowrap">
                    Market Cap
                  </p>
                  <p className="text-sm sm:text-base font-semibold text-foreground">
                    $78.0B
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1 whitespace-nowrap">Volume</p>
                  <p className="text-sm sm:text-base font-semibold text-foreground">
                    $8.0B
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1 whitespace-nowrap">Markets</p>
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
