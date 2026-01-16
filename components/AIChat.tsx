"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { ArrowUp } from "lucide-react";

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
    setActivePrompt(prompt);
    setMessages([]);
    handleSendMessage(prompt);
  };

  const handleReset = () => {
    setActivePrompt(null);
    setMessages([]);
    setIsLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(message);
      setActivePrompt(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-12 w-full">
      {/* Messages Area - Takes up remaining space */}
      <div className="flex-1 overflow-y-auto space-y-4 flex flex-col justify-end">
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
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-white">
                    <Image
                      src="/assets/chatLogo.svg"
                      alt="Tower logo"
                      width={32}
                      height={32}
                      className="object-contain"
                    />
                  </div>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={msg.isUser ? handleReset : undefined}
                  className={`max-w-[80%] ${
                    msg.isUser
                      ? "bg-[#7BB8FF] text-white rounded-2xl px-5 py-3 cursor-pointer  transition-colors"
                      : msg.text === "Trading Volume"
                      ? "bg-zinc-900/50 text-white rounded-xl p-4 backdrop-blur-sm"
                      : "bg-zinc-900/50 text-white rounded-xl px-5 py-3 backdrop-blur-sm"
                  }`}
                >
                  {msg.text === "Trading Volume" ? (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="font-semibold">Trading Volume</span>
                        <div className="flex gap-2">
                          {["24H", "7D", "30D", "ALL"].map((tf, idx) => (
                            <button
                              key={tf}
                              className={`px-3 py-1 rounded-lg text-xs ${
                                idx === 1
                                  ? "bg-[#7BB8FF] text-white"
                                  : "text-gray-400"
                              }`}
                            >
                              {tf}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="text-2xl font-bold mb-1">$44,238 USD</div>
                      <div className="text-sm text-gray-400 mb-4">
                        Jan, 2026 8:00 AM
                      </div>
                      <div className="h-32 relative">
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
                    <p className="text-sm">{msg.text}</p>
                  )}
                </motion.div>

                {msg.isUser && (
                  <div className="w-8 h-8 rounded-full bg-[#7BB8FF] flex items-center justify-center shrink-0">
                    <span className="text-white text-sm">U</span>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-white">
                  <Image
                    src="/assets/chatLogo.svg"
                    alt="Tower logo"
                    width={32}
                    height={32}
                    className="object-contain"
                  />
                </div>
                <div className="bg-zinc-900/50 backdrop-blur-sm text-white rounded-xl px-5 py-3">
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

      {/* Bottom Container: Logo, Prompts, and Input */}
      <div className="shrink-0 max-w-2xl mt-6">
        {/* Logo and Prompts - Only show when no messages */}
        {messages.length === 0 && (
          <div className="mb-6">
            {/* Logo */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="w-12 h-12 rounded-full flex items-center justify-center bg-white mb-8"
            >
              <Image
                src="/assets/chatLogo.svg"
                alt="Tower logo"
                width={48}
                height={48}
                className="object-contain"
              />
            </motion.div>

            {/* Quick Prompts */}
            <div className="space-y-3 max-w-md">
              {quickPrompts.map((prompt, index) => (
                <motion.button
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.3 }}
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full text-left px-5 py-3.5 rounded-full border border-blue-500/30 hover:border-blue-500/50 transition-all text-gray-300 bg-transparent"
                  onClick={() => handlePromptClick(prompt)}
                >
                  <span className="text-sm">{prompt}</span>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="relative">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask Tower anything..."
            className="w-full px-5 py-3.5 pr-12 rounded-full bg-transparent border border-zinc-700/50 focus:border-zinc-600/50 outline-none text-white placeholder-gray-500 text-sm transition-all"
          />
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleSendMessage(message)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white flex items-center justify-center"
          >
            <ArrowUp className="w-4 h-4 text-black" />
          </motion.button>
        </div>
      </div>
    </div>
  );
};
