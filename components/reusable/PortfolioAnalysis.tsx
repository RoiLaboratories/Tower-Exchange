"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import usdcLogo from "@/public/assets/USDC-fotor-bg-remover-2025111075935.png";
import ethLogo from "@/public/assets/Eth_logo_3-removebg-preview.png";

export const PortfolioAnalysis = () => {
  const [timeframe, setTimeframe] = useState("7D");
  const timeframes = ["24H", "7D", "30D", "ALL"];

  const positions = [
    {
      token: "USDC",
      amount: "1,000",
      value: "$999.99",
      change: "+0.01%",
      logo: usdcLogo,
    },
    {
      token: "USDC",
      amount: "1,000",
      value: "$999.99",
      change: "+0.01%",
      logo: usdcLogo,
    },
    {
      token: "USDC",
      amount: "1,000",
      value: "$999.99",
      change: "+0.01%",
      logo: usdcLogo,
    },
  ];

  const closedPositions = [
    {
      pair: "ETH x USDC",
      amount: "1 ETH = 3000 USDC",
      logos: {
        eth: ethLogo,
        usdc: usdcLogo,
      },
    },
    {
      pair: "ETH x USDC",
      amount: "1 ETH = 3200 USDC",
      logos: {
        eth: ethLogo,
        usdc: usdcLogo,
      },
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-4 rounded-[24px] border border-[#243046] bg-[#151517] p-4 sm:space-y-6 sm:rounded-[28px] sm:p-6 lg:space-y-4 lg:p-4 xl:space-y-6 xl:p-6"
    >
      <div className="rounded-xl bg-black p-3 sm:p-4 lg:p-3 xl:p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 lg:flex-nowrap lg:gap-1.5">
          <div className="flex items-center gap-3 sm:gap-4 lg:gap-2 xl:gap-3">
            <button className="whitespace-nowrap text-sm font-medium text-white sm:text-base lg:text-[0.9rem] xl:text-base">
              PNL
            </button>
            <button className="whitespace-nowrap text-sm text-gray-500 sm:text-base lg:text-[0.9rem] xl:text-base">
              Volume
            </button>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2 lg:gap-1">
            {timeframes.map((tf) => (
              <motion.button
                key={tf}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setTimeframe(tf)}
                className={`whitespace-nowrap rounded-lg px-2 py-1 text-xs sm:px-3 sm:text-sm lg:px-1.5 lg:py-0.5 lg:text-[0.68rem] xl:px-2 xl:py-1 xl:text-xs ${
                  timeframe === tf
                    ? "bg-[#7BB8FF] text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {tf}
              </motion.button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <div className="text-xl font-bold text-white sm:text-2xl lg:text-[1.4rem] xl:text-2xl">
            $44,238 USD
          </div>
          <div className="text-xs text-gray-400 sm:text-sm">Jan , 2026 8:00 AM</div>
        </div>

        <div className="relative h-24 sm:h-32">
          <svg className="h-full w-full" viewBox="0 0 400 100">
            <polyline
              points="0,60 50,40 100,70 150,50 200,20 250,40 300,70 350,50 400,30"
              fill="none"
              stroke="#7BB8FF"
              strokeWidth="2"
            />
          </svg>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-base font-semibold text-white sm:mb-4 sm:text-lg">
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
              className="flex items-center justify-between rounded-xl bg-zinc-950 p-3 sm:p-4"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full sm:h-8 sm:w-8">
                  <Image
                    src={position.logo}
                    alt={position.token}
                    width={32}
                    height={32}
                    className="h-full w-full object-contain"
                  />
                </div>
                <div>
                  <div className="text-sm font-medium text-white sm:text-base">
                    {position.token} <span className="text-gray-400">{position.amount}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-white sm:text-base">
                  {position.value}
                </div>
                <div className="text-xs text-green-400 sm:text-sm">{position.change}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-base font-semibold text-white sm:mb-4 sm:text-lg">
          Closed Positions
        </h3>
        <div className="flex flex-col gap-2 xl:flex-row">
          {closedPositions.map((position, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.02 }}
              className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 p-3 sm:p-4 lg:p-3 xl:p-4"
            >
              <div className="mb-2 flex items-center gap-2">
                <div className="flex -space-x-2">
                  <div className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full border-2 border-zinc-950 sm:h-6 sm:w-6 lg:h-5 lg:w-5 xl:h-6 xl:w-6">
                    <Image
                      src={position.logos.eth}
                      alt="ETH"
                      width={24}
                      height={24}
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full border-2 border-zinc-950 sm:h-6 sm:w-6 lg:h-5 lg:w-5 xl:h-6 xl:w-6">
                    <Image
                      src={position.logos.usdc}
                      alt="USDC"
                      width={24}
                      height={24}
                      className="h-full w-full object-contain"
                    />
                  </div>
                </div>
                <span className="whitespace-nowrap text-xs font-medium text-white sm:text-sm lg:text-[0.78rem] xl:text-sm">
                  {position.pair}
                </span>
              </div>
              <div className="text-xs text-gray-400 lg:text-[0.72rem] xl:text-xs">
                {position.amount}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
