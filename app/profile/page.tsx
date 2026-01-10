"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { tokens } from "@/mockData/token";
import { holdingsData, activitiesData } from "@/mockData/portfolioData";

const Profile = () => {
  const [activeTab, setActiveTab] = useState("positions");
  const [holdingsExpanded, setHoldingsExpanded] = useState(false);

  return (
    <div className="text-white min-h-screen">
      {/* Token Ticker */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden py-3"
        style={{ borderBottom: "1px solid hsl(220, 15%, 18%)" }}
      >
        <div
          className="flex gap-4 animate-scroll"
          style={{
            animation: "scroll 20s linear infinite",
          }}
        >
          {[...tokens, ...tokens, ...tokens].map((token, index) => (
            <motion.div
              key={index}
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-3 px-6 py-2 rounded-full whitespace-nowrap shrink-0"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                border: "1px solid hsl(220, 15%, 18%)",
              }}
            >
              <div className="shrink-0 w-5 h-5">
                <Image
                  src={token.icon}
                  alt={`${token.symbol} logo`}
                  width={20}
                  height={20}
                  className="object-contain w-full h-full"
                />
              </div>
              <span className="font-semibold">${token.symbol}</span>
              <span className="text-gray-300">{token.price}</span>
              <span className="text-green-400">{token.change}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <style>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
      `}</style>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <h1 className="text-4xl font-bold mb-8">Profile</h1>

          <div className="flex items-center gap-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="w-24 h-24 rounded-full overflow-hidden bg-linear-to-br from-gray-700 to-gray-800 border-2 border-gray-600"
            >
              <Image
                src="/assets/user.png"
                alt="Profile"
                width={96}
                height={96}
                className="w-full h-full object-cover"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <p className="text-gray-400 mb-1">Not Connected</p>
              <h2 className="text-5xl font-bold mb-2">$0.00</h2>
              <p className="text-green-400 text-sm">
                +0.00% <span className="text-gray-500">($0.00)</span>
              </p>
            </motion.div>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex items-center gap-4 mb-8 rounded-xl p-1 w-fit "
          style={{
            backgroundColor: "hsl(220, 20%, 10%)",
            border: "1px solid hsl(220, 15%, 18%)",
          }}
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab("positions")}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === "positions"
                ? "text-white"
                : "text-gray-400 hover:text-white"
            }`}
            style={
              activeTab === "positions"
                ? { backgroundColor: "hsl(220, 20%, 14%)" }
                : {}
            }
          >
            Positions
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab("activities")}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === "activities"
                ? "text-white"
                : "text-gray-400 hover:text-white"
            }`}
            style={
              activeTab === "activities"
                ? { backgroundColor: "hsl(220, 20%, 14%)" }
                : {}
            }
          >
            Activities
          </motion.button>
        </motion.div>

        {/* Content Section */}
        <AnimatePresence mode="wait">
          {activeTab === "positions" ? (
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
                <h3 className="text-xl font-semibold">Holdings</h3>
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
                    {holdingsData.length > 0 ? (
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
                              {holdingsData.map((holding, index) => (
                                <motion.tr
                                  key={index}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{
                                    delay: index * 0.03,
                                    duration: 0.3,
                                  }}
                                  whileHover={{
                                    backgroundColor:
                                      "rgba(255, 255, 255, 0.05)",
                                  }}
                                  className="transition-colors"
                                  style={{
                                    borderBottom:
                                      "1px solid rgba(255, 255, 255, 0.05)",
                                  }}
                                >
                                  <td className="py-4 px-4">
                                    <div className="flex items-center gap-3">
                                      <div className="shrink-0 w-6 h-6">
                                        <Image
                                          src={holding.icon}
                                          alt={`${holding.token} logo`}
                                          width={24}
                                          height={24}
                                          className="object-contain w-full h-full"
                                        />
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
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                        className="flex flex-col items-center justify-center py-20 px-6"
                      >
                        <div className="mb-6">
                          <svg
                            className="w-20 h-20 text-white"
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
                          No wallet Connected
                        </h4>
                        <p className="text-gray-400 text-center">
                          Connect wallet with holdings to view data.
                        </p>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="activities"
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
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr
                      style={{ borderBottom: "1px solid hsl(220, 15%, 18%)" }}
                    >
                      <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                        Type
                      </th>
                      <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                        Source
                      </th>
                      <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                        Destination
                      </th>
                      <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                        Status
                      </th>
                      <th className="text-right py-4 px-6 text-sm font-medium text-gray-400">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {activitiesData.map((activity, index) => (
                      <motion.tr
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05, duration: 0.3 }}
                        whileHover={{
                          backgroundColor: "rgba(255, 255, 255, 0.05)",
                        }}
                        className="transition-colors"
                        style={{
                          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                        }}
                      >
                        <td className="py-5 px-6">
                          <span className="font-medium">{activity.type}</span>
                        </td>
                        <td className="py-5 px-6">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="shrink-0 w-8 h-8">
                                <Image
                                  src={activity.source.icon}
                                  alt={`${activity.source.token} logo`}
                                  width={32}
                                  height={32}
                                  className="object-contain w-full h-full"
                                />
                              </div>
                              <div
                                className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: "#7bb8ff" }}
                              >
                                <span className="text-[8px] font-bold">A</span>
                              </div>
                            </div>
                            <div>
                              <div className="font-medium">
                                {activity.source.token}
                              </div>
                              <div className="text-xs text-gray-400">
                                {activity.source.network}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-5 px-6">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="shrink-0 w-8 h-8">
                                <Image
                                  src={activity.destination.icon}
                                  alt={`${activity.destination.token} logo`}
                                  width={32}
                                  height={32}
                                  className="object-contain w-full h-full"
                                />
                              </div>
                              <div
                                className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: "#7bb8ff" }}
                              >
                                <span className="text-[8px] font-bold">A</span>
                              </div>
                            </div>
                            <div>
                              <div className="font-medium">
                                {activity.destination.token}
                              </div>
                              <div className="text-xs text-gray-400">
                                {activity.destination.network}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-5 px-6">
                          <motion.span
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{
                              delay: index * 0.05 + 0.15,
                              duration: 0.3,
                            }}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium border inline-block ${
                              activity.status === "Successful"
                                ? "text-green-400 border-green-400/30 bg-green-400/10"
                                : "text-red-400 border-red-400/30 bg-red-400/10"
                            }`}
                          >
                            {activity.status}
                          </motion.span>
                        </td>
                        <td className="py-5 px-6 text-right">
                          <div className="font-medium">{activity.date}</div>
                          <div className="text-xs text-gray-400">
                            {activity.time}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Profile;
