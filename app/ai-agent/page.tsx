"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RecurringBuys } from "@/components/reusable/RecurringBuys";
import { RecurringSell } from "@/components/reusable/RecurringSell";
import { PortfolioAnalysis } from "@/components/reusable/PortfolioAnalysis";
import { AIChat } from "@/components/AIChat";

const AIAgentPage = () => {
  const [activeTab, setActiveTab] = useState("recurring-buys");

  const tabs = [
    { id: "recurring-buys", label: "Recurring Buys" },
    { id: "recurring-sell", label: "Recurring Sell" },
    { id: "portfolio", label: "Portfolio Analysis" },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex" style={{ minHeight: "100vh" }}>
        {/* Left Side - AI Chat */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex-1 flex flex-col"
        >
          <AIChat />
        </motion.div>

        <div className="w-px bg-zinc-800" />

        {/* Right Side - Trading Interface */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-150 p-8 shrink-0 flex flex-col overflow-y-auto"
          style={{ maxHeight: "100vh" }}
        >
          {/* Tabs */}
          <div className="flex gap-2 mb-6 bg-zinc-900 rounded-xl p-1 shrink-0">
            {tabs.map((tab) => (
              <motion.button
                key={tab.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-zinc-800 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {tab.label}
              </motion.button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              {activeTab === "recurring-buys" && <RecurringBuys key="buys" />}
              {activeTab === "recurring-sell" && <RecurringSell key="sell" />}
              {activeTab === "portfolio" && (
                <PortfolioAnalysis key="portfolio" />
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AIAgentPage;
