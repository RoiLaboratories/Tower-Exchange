"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RecurringOrdersDashboard } from "@/components/RecurringOrdersDashboard";
import { RecurringBuys } from "@/components/reusable/RecurringBuys";
import { RecurringSell } from "@/components/reusable/RecurringSell";

export default function RecurringOrdersPage() {
  const [activeTab, setActiveTab] = useState<"view" | "create-buy" | "create-sell">("view");

  return (
    <main className="min-h-screen bg-black">

      <section className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto">
        {/* Page Title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Recurring Orders</h1>
          <p className="text-zinc-400">Manage your automated buy and sell orders</p>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-2 mb-8 border-b border-zinc-800/30"
        >
          <button
            onClick={() => setActiveTab("view")}
            className={`px-6 py-3 font-semibold transition-colors relative ${
              activeTab === "view" ? "text-white" : "text-zinc-400 hover:text-white"
            }`}
          >
            View Orders
            {activeTab === "view" && (
              <motion.div
                layoutId="active-tab"
                className="absolute bottom-0 left-0 right-0 h-1 bg-white"
                initial={false}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
              />
            )}
          </button>

          <button
            onClick={() => setActiveTab("create-buy")}
            className={`px-6 py-3 font-semibold transition-colors relative ${
              activeTab === "create-buy" ? "text-white" : "text-zinc-400 hover:text-white"
            }`}
          >
            Create Buy Order
            {activeTab === "create-buy" && (
              <motion.div
                layoutId="active-tab"
                className="absolute bottom-0 left-0 right-0 h-1 bg-white"
                initial={false}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
              />
            )}
          </button>

          <button
            onClick={() => setActiveTab("create-sell")}
            className={`px-6 py-3 font-semibold transition-colors relative ${
              activeTab === "create-sell" ? "text-white" : "text-zinc-400 hover:text-white"
            }`}
          >
            Create Sell Order
            {activeTab === "create-sell" && (
              <motion.div
                layoutId="active-tab"
                className="absolute bottom-0 left-0 right-0 h-1 bg-white"
                initial={false}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
              />
            )}
          </button>
        </motion.div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeTab === "view" && (
            <motion.div
              key="view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <RecurringOrdersDashboard />
            </motion.div>
          )}

          {activeTab === "create-buy" && (
            <motion.div
              key="create-buy"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="max-w-lg mx-auto"
            >
              <h2 className="text-2xl font-bold text-white mb-6">Create Recurring Buy Order</h2>
              <RecurringBuys />
            </motion.div>
          )}

          {activeTab === "create-sell" && (
            <motion.div
              key="create-sell"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="max-w-lg mx-auto"
            >
              <h2 className="text-2xl font-bold text-white mb-6">Create Recurring Sell Order</h2>
              <RecurringSell />
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </main>
  );
}
