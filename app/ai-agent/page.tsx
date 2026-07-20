"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
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
    <div className="relative flex min-h-[calc(100dvh-100px)] flex-col overflow-x-hidden text-white lg:h-full lg:min-h-0">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_85%,rgba(87,147,255,0.12),transparent_30%),radial-gradient(circle_at_75%_100%,rgba(35,57,94,0.16),transparent_34%),linear-gradient(180deg,#07080b_0%,#0a0b0f_45%,#0d1015_100%)]" />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <TokenTicker />

        {!showRightPanel && (
          <div className="fixed bottom-[10rem] right-4 z-50 lg:hidden sm:bottom-[17rem] sm:right-6">
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => setShowRightPanel(true)}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[#7BB8FF] text-[#081019] shadow-[0_16px_40px_rgba(123,184,255,0.35)] sm:h-14 sm:w-14"
            >
              <Plus size={22} />
            </motion.button>
          </div>
        )}

        <div className="mx-auto flex w-full max-w-[1320px] min-h-0 flex-1 flex-col px-3 pb-20 pt-3 sm:px-6 sm:pb-24 sm:pt-4 lg:px-8 lg:pb-8">
          <div className="flex min-h-0 flex-1 flex-col gap-4 lg:grid lg:h-full lg:grid-cols-[minmax(0,1fr)_16px_minmax(430px,500px)] lg:gap-4 xl:grid-cols-[minmax(0,1fr)_18px_minmax(460px,540px)]">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className={`flex h-[calc(100dvh-15.5rem)] min-h-[34rem] flex-col overflow-hidden sm:min-h-[620px] lg:h-full lg:min-h-0 ${showRightPanel ? "hidden lg:flex" : "flex"}`}
            >
              <AIChat />
            </motion.div>

            <div className="relative hidden lg:flex items-center justify-center">
              <div className="h-[64%] w-px rounded-full bg-gradient-to-b from-transparent via-white/12 to-transparent" />
              <div className="absolute h-20 w-1.5 rounded-full bg-white/35" />
            </div>

            {showRightPanel && !isLargeScreen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowRightPanel(false)}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-30 bg-black/55 backdrop-blur-sm sm:backdrop-blur lg:hidden"
                style={{
                  willChange: "opacity",
                  WebkitAcceleratedCompositing: true,
                } as any}
              />
            )}

            <AnimatePresence>
              {(showRightPanel || isLargeScreen) && (
                <motion.div
                  initial={
                    isLargeScreen ? { opacity: 0, x: 20 } : { opacity: 0, y: "100%" }
                  }
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  exit={
                    isLargeScreen ? { opacity: 0, x: 20 } : { opacity: 0, y: "100%" }
                  }
                  transition={{ duration: isLargeScreen ? 0.3 : 0.35, ease: "easeOut" }}
                  className={`z-40 flex flex-col overflow-hidden border border-[#263446]/70 bg-[#171a1f]/92 shadow-[0_28px_80px_rgba(0,0,0,0.48)] backdrop-blur-md sm:backdrop-blur-xl ${
                    isLargeScreen
                      ? "relative h-full min-h-0 rounded-[24px] p-3 lg:shadow-[0_24px_64px_rgba(0,0,0,0.42)] xl:rounded-[26px] xl:p-3.5"
                      : "fixed inset-x-0 bottom-0 top-[8.5rem] rounded-t-[24px] rounded-b-none border-b-0 border-x-0 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 sm:top-[9rem] sm:px-4 sm:pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pt-4"
                  }`}
                  style={{
                    willChange: isLargeScreen ? "transform, opacity" : "transform, opacity",
                    WebkitAcceleratedCompositing: true,
                    transform: isLargeScreen ? undefined : "translateZ(0)",
                    backfaceVisibility: "hidden",
                  } as any}
                >
                  {!isLargeScreen && (
                    <div className="mb-4 flex justify-center lg:hidden">
                      <div className="h-1.5 w-14 rounded-full bg-white/20" />
                    </div>
                  )}

                  <div className="shrink-0 rounded-[10px] border border-white/[0.04] bg-[#111214] p-1.5 lg:p-1">
                    <div className="grid w-full grid-cols-3 gap-1.5 lg:gap-1">
                      {tabs.map((tab) => (
                        <motion.button
                          key={tab.id}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => setActiveTab(tab.id)}
                          className={`flex items-center justify-center min-w-0 whitespace-nowrap rounded-[4px] px-1.5 py-2.5 text-center text-[0.72rem] font-semibold tracking-[-0.01em] transition-all lg:px-2 lg:py-2 lg:text-[0.76rem] xl:px-3 xl:py-2.25 xl:text-[0.82rem] ${
                            activeTab === tab.id
                              ? "bg-[#1f2125] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                              : "text-[#8a909c] hover:text-white"
                          }`}
                        >
                          {tab.label}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  <div
                    className={`px-2 pb-2 pt-5 lg:px-1 lg:pb-1 lg:pt-3.5 xl:px-1.5 xl:pb-1.5 xl:pt-4 ${
                      isLargeScreen ? "flex-1 overflow-hidden" : "flex-1 overflow-y-auto overscroll-contain"
                    }`}
                    style={{
                      WebkitOverflowScrolling: "touch",
                      scrollBehavior: "smooth",
                    } as any}
                  >
                    <div className="mx-auto w-full max-w-[430px] xl:max-w-[470px]">
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
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAgentPage;
