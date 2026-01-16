import { useState } from "react";
import { ChevronDown } from "lucide-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { holdingsData } from "@/mockData/portfolioData";

const Positions = () => {
  const [holdingsExpanded, setHoldingsExpanded] = useState(false);

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
  );
};

export default Positions;
