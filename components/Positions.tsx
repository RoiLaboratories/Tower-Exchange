"use client";

import { useState, useMemo, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { holdingsData } from "@/mockData/portfolioData";
import { useWalletHoldings } from "@/lib/useWalletHoldings";

interface PositionsProps {
  walletAddress?: string | null;
  onTotalValueChange?: (value: string) => void;
}

const Positions = ({ walletAddress, onTotalValueChange }: PositionsProps) => {
  const [holdingsExpanded, setHoldingsExpanded] = useState(false);
  const { holdings: walletHoldings, loading, error } = useWalletHoldings(
    walletAddress || null
  );

  // Use wallet holdings if available and loaded, otherwise use mock data
  const displayHoldings = useMemo(() => {
    // If no wallet connected, return empty array to show empty state
    if (!walletAddress) {
      return [];
    }
    // If wallet is connected and has holdings, show them
    if (walletHoldings.length > 0) {
      return walletHoldings;
    }
    // If wallet is connected but no holdings found, return empty array
    return [];
  }, [walletAddress, walletHoldings]);

  // Calculate and report total value using useEffect (not useMemo)
  useEffect(() => {
    // If wallet is connected but has no holdings, set to $0.00
    if (walletAddress && !loading && walletHoldings.length === 0) {
      if (onTotalValueChange) {
        onTotalValueChange("$0.00");
      }
      return;
    }

    const total = displayHoldings.reduce((sum, holding) => {
      const value = parseFloat(holding.value.replace("$", ""));
      return sum + value;
    }, 0);
    
    const totalValue = `$${total.toFixed(2)}`;
    if (onTotalValueChange) {
      onTotalValueChange(totalValue);
    }
  }, [displayHoldings, onTotalValueChange, walletAddress, loading, walletHoldings.length]);

  return (
    <motion.div
      key="positions"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: "hsl(220, 20%, 10%)",
        border: "1px solid hsl(220, 15%, 18%)",
      }}
    >
      <motion.button
        whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
        transition={{ duration: 0.2 }}
        onClick={() => setHoldingsExpanded(!holdingsExpanded)}
        className="w-full flex items-center justify-between p-6"
      >
        <h3 className="text-xl font-semibold">
          Holdings
          {walletAddress && !loading && walletHoldings.length > 0 && (
            <span className="ml-2 text-sm text-gray-400 font-normal">
              ({walletHoldings.length} {walletHoldings.length === 1 ? "asset" : "assets"})
            </span>
          )}
        </h3>
        <motion.div
          animate={{ rotate: holdingsExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-5 h-5 text-gray-400" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {holdingsExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="flex items-center justify-center py-20 px-6"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-gray-600 border-t-primary rounded-full animate-spin" />
                  <p className="text-gray-400">Loading wallet holdings...</p>
                </div>
              </motion.div>
            )}

            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="flex items-center justify-center py-20 px-6"
              >
                <div className="flex flex-col items-center gap-3">
                  <p className="text-red-400 font-medium">Error loading holdings</p>
                  <p className="text-gray-400 text-sm">{error}</p>
                </div>
              </motion.div>
            )}

            {!loading && !error && displayHoldings.length > 0 ? (
              <div className="px-6 pb-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr
                        style={{
                          borderBottom: "1px solid hsl(220, 15%, 18%)",
                        }}
                      >
                        <th className="text-left py-4 px-4 text-sm font-medium text-gray-400">
                          Token
                        </th>
                        <th className="text-right py-4 px-4 text-sm font-medium text-gray-400">
                          Balance
                        </th>
                        <th className="text-right py-4 px-4 text-sm font-medium text-gray-400">
                          Price
                        </th>
                        <th className="text-right py-4 px-4 text-sm font-medium text-gray-400">
                          Value
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayHoldings.map((holding, index) => (
                        <motion.tr
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{
                            delay: index * 0.03,
                            duration: 0.3,
                          }}
                          whileHover={{
                            backgroundColor: "rgba(255, 255, 255, 0.05)",
                          }}
                          className="transition-colors"
                          style={{
                            borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                          }}
                        >
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className="shrink-0 w-6 h-6">
                                {holding.icon ? (
                                  <Image
                                    src={holding.icon}
                                    alt={`${holding.token} logo`}
                                    width={24}
                                    height={24}
                                    className="object-contain w-full h-full"
                                  />
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-xs font-bold">
                                    {holding.token.charAt(0)}
                                  </div>
                                )}
                              </div>
                              <span className="font-medium">
                                {holding.token}
                              </span>
                            </div>
                          </td>
                          <td className="text-right py-4 px-4 text-gray-400">
                            {holding.balance}
                          </td>
                          <td className="text-right py-4 px-4 text-gray-400">
                            {holding.price}
                          </td>
                          <td className="text-right py-4 px-4 font-medium">
                            {holding.value}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : !loading && !error && walletAddress && walletHoldings.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center justify-center py-20 px-6"
              >
                <div className="mb-6">
                  <svg
                    className="w-20 h-20 opacity-60"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                </div>
                <h4 className="text-xl font-semibold mb-2">
                  No Holdings
                </h4>
                <p className="text-gray-400 text-center">
                  Your wallet doesn't have any token holdings yet. Start trading to build your portfolio.
                </p>
              </motion.div>
            ) : !loading && !error && !walletAddress && displayHoldings.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center justify-center py-20 px-6"
              >
                <div className="mb-6">
                  <Image
                    src="/assets/wallet.png"
                    alt="No wallet connected"
                    width={80}
                    height={80}
                    className="w-20 h-20 opacity-60"
                  />
                </div>
                <h4 className="text-xl font-semibold mb-2">
                  No wallet connected
                </h4>
                <p className="text-gray-400 text-center">
                  Connect your wallet to view your holdings.
                </p>
              </motion.div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Positions;
