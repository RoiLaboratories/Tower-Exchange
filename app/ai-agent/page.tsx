"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X } from "lucide-react";
import { RecurringBuys } from "@/components/reusable/RecurringBuys";
import { RecurringSell } from "@/components/reusable/RecurringSell";
import { PortfolioAnalysis } from "@/components/reusable/PortfolioAnalysis";
import { AIChat } from "@/components/AIChat";
import TokenTicker from "@/components/TokenTicker";

const AIAgentPage = () => {
  const [activeTab, setActiveTab] = useState("recurring-buys");
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  const tabs = [
    { id: "recurring-buys", label: "Recurring Buy" },
    { id: "recurring-sell", label: "Recurring Sell" },
    { id: "portfolio", label: "Portfolio Analysis" },
  ];

  return (
    <div className="flex flex-col min-h-[calc(100vh-100px)] text-white">
      <TokenTicker />

      {/* Mobile Toggle Button - Only visible on mobile */}
      <div className="lg:hidden fixed bottom-40 right-6 z-50">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowRightPanel(!showRightPanel)}
          className="w-14 h-14 rounded-full bg-[#7BB8FF] text-white shadow-lg flex items-center justify-center"
        >
          {showRightPanel ? <X size={24} /> : <Plus size={24} />}
        </motion.button>
      </div>

      <div
        className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden"
      >
        {/* Left Side - AI Chat */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className={`flex-1 flex flex-col min-h-0 w-full lg:w-auto ${
            showRightPanel ? "hidden lg:flex" : "flex"
          }`}
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.4) 100%)",
          }}
        >
          <AIChat />
        </motion.div>

        {/* Mobile Backdrop - Blur effect when panel opens */}
        {showRightPanel && !isLargeScreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowRightPanel(false)}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 lg:hidden"
          />
        )}

        {/* Right Side - Trading Interface */}
        <AnimatePresence>
          {(showRightPanel || isLargeScreen) && (
            <motion.div
              initial={isLargeScreen ? { opacity: 0, x: 20 } : { opacity: 0, y: "100%" }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={isLargeScreen ? { opacity: 0, x: 20 } : { opacity: 0, y: "100%" }}
              transition={{ duration: isLargeScreen ? 0.3 : 0.4 }}
              className={`
                ${isLargeScreen ? "lg:relative" : "fixed"}
                ${!isLargeScreen ? "bottom-0 left-0 right-0 max-h-[70vh]" : "inset-auto"}
                lg:inset-auto
                z-40 lg:z-auto
                lg:w-125 xl:w-150
                flex flex-col
                overflow-hidden
              `}
              style={{
                background: "rgba(20, 20, 20, 0.6)",
                backdropFilter: "blur(10px)",
              }}
            >
              {/* Tabs */}
              <div className="px-6 pt-6 pb-4 shrink-0">
                <div className="flex gap-2 bg-zinc-900/50 rounded-xl p-1 overflow-x-auto">
                  {tabs.map((tab) => (
                    <motion.button
                      key={tab.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-4 py-2.5 rounded-lg font-medium transition-all text-sm whitespace-nowrap shrink-0 ${
                        activeTab === tab.id
                          ? "bg-zinc-800 text-white"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      {tab.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Tab Content - Scrollable */}
              <div className="flex-1 overflow-y-auto px-6 pb-6">
                <AnimatePresence mode="wait">
                  {activeTab === "recurring-buys" && (
                    <RecurringBuys key="buys" />
                  )}
                  {activeTab === "recurring-sell" && (
                    <RecurringSell key="sell" />
                  )}
                  {activeTab === "portfolio" && (
                    <PortfolioAnalysis key="portfolio" />
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AIAgentPage;
