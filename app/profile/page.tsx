"use client";
import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import TokenTicker from "@/components/TokenTicker";
import Positions from "@/components/Positions";
import Activities from "@/components/Activities";

const Profile = () => {
  const [activeTab, setActiveTab] = useState("positions");

  return (
    <div className="text-white min-h-screen">
      {/* Token Ticker */}
      <TokenTicker />

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
          {activeTab === "positions" ? <Positions /> : <Activities />}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Profile;
