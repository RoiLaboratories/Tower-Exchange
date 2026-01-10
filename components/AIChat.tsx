"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";

const quickPrompts = [
  "What are my buy/sell position",
  "Show are my 7D trading volume",
  "Provide overall analysis on the market",
];

interface Message {
  id: number;
  text: string;
  isUser: boolean;
  isTyping?: boolean;
}

// Mock responses based on prompt type
const getMockResponse = (prompt: string): string => {
  if (prompt.includes("buy/sell position")) {
    return "You currently hold $1000 USDC and short $500 worth of ETH.";
  } else if (prompt.includes("7D trading volume")) {
    return "Trading Volume";
  } else if (prompt.includes("overall analysis")) {
    return "With bitcoin below $90K, the crypto market in a downtrend but a bounce back should be expected soon based on market analysis";
  }
  return "I'm here to help with your trading needs!";
};

export const AIChat = () => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activePrompt, setActivePrompt] = useState<string | null>(null);

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Date.now(),
      text: text,
      isUser: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    setMessage("");
    setIsLoading(true);

    // Simulate AI response delay
    setTimeout(() => {
      const aiResponse: Message = {
        id: Date.now() + 1,
        text: getMockResponse(text),
        isUser: false,
      };
      setMessages((prev) => [...prev, aiResponse]);
      setIsLoading(false);
    }, 1000);
  };

  const handlePromptClick = (prompt: string) => {
    if (activePrompt === prompt) {
      // If clicking the same prompt, reset everything
      setActivePrompt(null);
      setMessages([]);
      setIsLoading(false);
    } else {
      // New prompt clicked
      setActivePrompt(prompt);
      setMessages([]);
      handleSendMessage(prompt);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(message);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 overflow-hidden">
      {/* Top section - Logo or Active Prompt */}
      <div className="shrink-0 mb-6">
        {!activePrompt ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full flex items-center justify-center"
          >
            <Image
              src="/assets/logo.png"
              alt="Tower logo"
              width={80}
              height={80}
              className="object-contain"
            />
          </motion.div>
        ) : (
          // Active prompt button
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ scale: 1.02, x: 5 }}
            whileTap={{ scale: 0.98 }}
            className="w-full text-left px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
            onClick={() => handlePromptClick(activePrompt)}
          >
            <span className="text-sm sm:text-base text-gray-300">
              {activePrompt}
            </span>
          </motion.button>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-4 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900">
        {messages.length > 0 && (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${
                  msg.isUser ? "justify-end" : "justify-start"
                }`}
              >
                {!msg.isUser && (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0">
                    <Image
                      src="/assets/logo.png"
                      alt="Tower logo"
                      width={40}
                      height={40}
                      className="object-contain"
                    />
                  </div>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`max-w-[80%] ${
                    msg.isUser
                      ? "bg-blue-600 text-white rounded-3xl px-4 py-2 sm:px-6 sm:py-3"
                      : msg.text === "Trading Volume"
                      ? "bg-zinc-900 text-white rounded-2xl p-4"
                      : "bg-zinc-900 text-white rounded-2xl px-4 py-3 sm:px-6 sm:py-4"
                  }`}
                >
                  {msg.text === "Trading Volume" ? (
                    // Trading Volume Chart
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="font-semibold">Trading Volume</span>
                        <div className="flex gap-2">
                          {["24H", "7D", "30D", "ALL"].map((tf, idx) => (
                            <button
                              key={tf}
                              className={`px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm ${
                                idx === 1
                                  ? "bg-blue-600 text-white"
                                  : "text-gray-400"
                              }`}
                            >
                              {tf}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="text-xl sm:text-2xl font-bold mb-1">
                        $44,238 USD
                      </div>
                      <div className="text-xs sm:text-sm text-gray-400 mb-4">
                        Jan, 2026 8:00 AM
                      </div>
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
                  ) : (
                    <p className="text-sm sm:text-base">{msg.text}</p>
                  )}
                </motion.div>

                {msg.isUser && (
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                    <span className="text-white text-sm">U</span>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0">
                  <Image
                    src="/assets/logo.png"
                    alt="Tower logo"
                    width={40}
                    height={40}
                    className="object-contain"
                  />
                </div>
                <div className="bg-zinc-900 text-white rounded-2xl px-6 py-4">
                  <div className="flex gap-1">
                    <motion.div
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                      className="w-2 h-2 bg-gray-400 rounded-full"
                    />
                    <motion.div
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                      className="w-2 h-2 bg-gray-400 rounded-full"
                    />
                    <motion.div
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                      className="w-2 h-2 bg-gray-400 rounded-full"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Prompts above input - only show when no active prompt */}
      {!activePrompt && (
        <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4 shrink-0">
          {quickPrompts.map((prompt, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1, duration: 0.3 }}
              whileHover={{ scale: 1.02, x: 5 }}
              whileTap={{ scale: 0.98 }}
              className="w-full text-left px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
              onClick={() => handlePromptClick(prompt)}
            >
              <span className="text-sm sm:text-base text-gray-300">
                {prompt}
              </span>
            </motion.button>
          ))}
        </div>
      )}

      {/* Input at bottom */}
      <div className="shrink-0">
        <div className="relative">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask Tower anything..."
            className="w-full px-4 sm:px-6 py-3 sm:py-4 pr-12 sm:pr-14 rounded-xl sm:rounded-2xl bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none text-white placeholder-gray-500 text-sm sm:text-base"
          />
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleSendMessage(message)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white flex items-center justify-center"
          >
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5 text-black"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 10l7-7m0 0l7 7m-7-7v18"
              />
            </svg>
          </motion.button>
        </div>
      </div>
    </div>
  );
};
