"use client";
import { useState } from "react";
import { motion } from "framer-motion";

export const PortfolioAnalysis = () => {
  const [timeframe, setTimeframe] = useState("7D");
  const timeframes = ["24H", "7D", "30D", "ALL"];

  const positions = [
    { token: "USDC", amount: "1,000", value: "$999.99", change: "+0.01%" },
    { token: "USDC", amount: "1,000", value: "$999.99", change: "+0.01%" },
    { token: "USDC", amount: "1,000", value: "$999.99", change: "+0.01%" },
  ];

  const closedPositions = [
    { pair: "ETH × USDC", amount: "1 ETH = 3000 USDC" },
    { pair: "ETH × USDC", amount: "1 ETH = 3200 USDC" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="bg-zinc-900 rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-6"
    >
      {/* Chart Section */}
      <div className="bg-black rounded-xl p-3 sm:p-4">
        {/* Tabs */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex gap-3 sm:gap-4">
            <button className="text-white font-medium text-sm sm:text-base">
              PNL
            </button>
            <button className="text-gray-500 text-sm sm:text-base">
              Volume
            </button>
          </div>
          <div className="flex gap-1 sm:gap-2">
            {timeframes.map((tf) => (
              <motion.button
                key={tf}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setTimeframe(tf)}
                className={`px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm ${
                  timeframe === tf
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {tf}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Chart Value */}
        <div className="mb-4">
          <div className="text-xl sm:text-2xl font-bold text-white">
            $44,238 USD
          </div>
          <div className="text-xs sm:text-sm text-gray-400">
            Jan , 2026 8:00 AM
          </div>
        </div>

        {/* Chart Placeholder */}
        <div className="h-24 sm:h-32 relative">
          <svg className="w-full h-full" viewBox="0 0 400 100">
            <polyline
              points="0,60 50,40 100,70 150,50 200,20 250,40 300,70 350,50 400,30"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
            />
          </svg>
        </div>
      </div>

      {/* Open Positions */}
      <div>
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">
          Open Positions
        </h3>
        <div className="space-y-2">
          {positions.map((position, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
              className="flex items-center justify-between p-3 sm:p-4 rounded-xl bg-zinc-950"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-600 flex items-center justify-center">
                  <span className="text-white text-xs sm:text-sm">$</span>
                </div>
                <div>
                  <div className="text-white font-medium text-sm sm:text-base">
                    {position.token}{" "}
                    <span className="text-gray-400">{position.amount}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-white font-medium text-sm sm:text-base">
                  {position.value}
                </div>
                <div className="text-green-400 text-xs sm:text-sm">
                  {position.change}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Closed Positions */}
      <div>
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">
          Closed Positions
        </h3>
        <div className="flex flex-col sm:flex-row gap-2">
          {closedPositions.map((position, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.02 }}
              className="flex-1 p-3 sm:p-4 rounded-xl bg-zinc-950 border border-zinc-800"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="flex -space-x-2">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-purple-600 flex items-center justify-center border-2 border-zinc-950">
                    <span className="text-white text-xs">Ξ</span>
                  </div>
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-600 flex items-center justify-center border-2 border-zinc-950">
                    <span className="text-white text-xs">$</span>
                  </div>
                </div>
                <span className="text-white font-medium text-xs sm:text-sm">
                  {position.pair}
                </span>
              </div>
              <div className="text-gray-400 text-xs">{position.amount}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
