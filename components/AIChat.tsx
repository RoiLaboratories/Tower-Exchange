"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { ArrowUp } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { sendMessageToAIAgent, createAIAgentSession, saveChatMessageToHistory, getConversationHistory } from "@/lib/aiAgentService";
import { loadProfileData } from "@/lib/profileService";
import { v4 as uuidv4 } from "uuid";
import { Plus, MessageSquare, Trash2, Menu, X } from "lucide-react";

interface Message {
  id: number;
  text: string;
  isUser: boolean;
  isTyping?: boolean;
  error?: string;
}

interface ChatSession {
  id: string;
  title: string;
  timestamp: number;
  messageCount: number;
}

const quickPrompts = [
  "What are my buy/sell position",
  "Show are my 7D trading volume",
  "Provide overall analysis on the market",
];

export const AIChat = () => {
  const { user } = usePrivy();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Load sessions from localStorage
  const loadSessions = (walletAddress: string): ChatSession[] => {
    try {
      const sessionsData = localStorage.getItem(
        `tower-ai-sessions-${walletAddress}`
      );
      return sessionsData ? JSON.parse(sessionsData) : [];
    } catch (error) {
      console.error("Error loading sessions:", error);
      return [];
    }
  };

  // Save sessions to localStorage
  const saveSessions = (walletAddress: string, sessionsData: ChatSession[]) => {
    try {
      localStorage.setItem(
        `tower-ai-sessions-${walletAddress}`,
        JSON.stringify(sessionsData)
      );
    } catch (error) {
      console.error("Error saving sessions:", error);
    }
  };

  // Start a new chat
  const startNewChat = async () => {
    if (!user?.wallet?.address) return;

    try {
      const newSessionId = uuidv4();
      const newSession: ChatSession = {
        id: newSessionId,
        title: "New Chat",
        timestamp: Date.now(),
        messageCount: 0,
      };

      // Add to sessions list
      const updatedSessions = [newSession, ...sessions];
      setSessions(updatedSessions);
      saveSessions(user.wallet.address, updatedSessions);

      // Switch to new session
      switchSession(newSessionId);
    } catch (error) {
      console.error("Error creating new chat:", error);
    }
  };

  // Switch to a different session
  const switchSession = async (newSessionId: string) => {
    if (!user?.wallet?.address) return;

    try {
      setSessionId(newSessionId);
      localStorage.setItem("ai-session-id", newSessionId);
      setMessages([]);
      setMessage("");
      setError(null);
      setSidebarOpen(false); // Close sidebar after selecting a session

      // Load history for this session
      const history = await getConversationHistory(
        newSessionId,
        user.wallet.address
      );

      if (history.length > 0) {
        const loadedMessages: Message[] = [];
        let messageId = 1;

        history.forEach((item) => {
          if (item.user_query) {
            loadedMessages.push({
              id: messageId++,
              text: item.user_query,
              isUser: true,
            });
          }
          if (item.ai_response) {
            loadedMessages.push({
              id: messageId++,
              text: item.ai_response,
              isUser: false,
            });
          }
        });
        setMessages(loadedMessages);
      }
    } catch (error) {
      console.error("Error switching session:", error);
    }
  };

  // Delete a session
  const deleteSession = (sessionToDelete: string) => {
    try {
      const updatedSessions = sessions.filter((s) => s.id !== sessionToDelete);
      setSessions(updatedSessions);
      if (user?.wallet?.address) {
        saveSessions(user.wallet.address, updatedSessions);
      }

      // If we deleted the active session, switch to the first available
      if (sessionId === sessionToDelete && updatedSessions.length > 0) {
        switchSession(updatedSessions[0].id);
      }
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  };

  // Initialize session when user is available
  useEffect(() => {
    const initializeSession = async () => {
      if (!user?.wallet?.address) return;

      try {
        // Load profile picture from localStorage or fetch from Supabase
        const profilePicUrl = await loadProfileData(user.wallet.address);
        setProfilePictureUrl(profilePicUrl);

        // Load all sessions for this user
        const userSessions = loadSessions(user.wallet.address);
        
        // Try to use stored session or create a new one
        let sessionIdToUse = localStorage.getItem("ai-session-id");
        
        if (!sessionIdToUse || !userSessions.find((s) => s.id === sessionIdToUse)) {
          const response = await createAIAgentSession(user.wallet.address);
          sessionIdToUse = response.sessionId;
          
          // Add to sessions list if not already there
          if (!userSessions.find((s) => s.id === sessionIdToUse)) {
            const newSession: ChatSession = {
              id: sessionIdToUse,
              title: "Chat",
              timestamp: Date.now(),
              messageCount: 0,
            };
            userSessions.unshift(newSession);
            saveSessions(user.wallet.address, userSessions);
          }
        }
        
        setSessions(userSessions);
        localStorage.setItem("ai-session-id", sessionIdToUse);
        setSessionId(sessionIdToUse);

        // Load chat history from Supabase
        const history = await getConversationHistory(
          sessionIdToUse,
          user.wallet.address
        );

        if (history.length > 0) {
          const loadedMessages: Message[] = [];
          let messageId = 1;
          
          history.forEach((item) => {
            if (item.user_query) {
              loadedMessages.push({
                id: messageId++,
                text: item.user_query,
                isUser: true,
              });
            }
            if (item.ai_response) {
              loadedMessages.push({
                id: messageId++,
                text: item.ai_response,
                isUser: false,
              });
            }
          });
          setMessages(loadedMessages);
        }
      } catch (err) {
        console.error("Failed to initialize session:", err);
        // Fallback to generating a local session ID
        const localSessionId = uuidv4();
        setSessionId(localSessionId);
        localStorage.setItem("ai-session-id", localSessionId);
      }
    };

    initializeSession();
  }, [user?.wallet?.address]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    if (!user?.wallet?.address) {
      setError("Please connect your wallet first");
      return;
    }
    if (!sessionId) {
      setError("Chat session not initialized");
      return;
    }

    const userMessage: Message = {
      id: Date.now(),
      text: text,
      isUser: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    setMessage("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await sendMessageToAIAgent({
        message: text,
        userid: user.wallet.address,
        session_id: sessionId,
        wallet_address: user.wallet.address,
        chain_id: 5042002, // Arc testnet
        enable_wallet_access: true,
        enable_swap_execution: false,
        enable_portfolio_analysis: true,
      });

      const aiResponse: Message = {
        id: Date.now() + 1,
        text: response.reply,
        isUser: false,
      };
      setMessages((prev) => [...prev, aiResponse]);

      // Save chat to Supabase
      await saveChatMessageToHistory(
        user.wallet.address,
        sessionId,
        text,
        response.reply
      );

      // Update session title and message count
      const updatedSessions = sessions.map((session) => {
        if (session.id === sessionId) {
          return {
            ...session,
            title:
              session.title === "New Chat"
                ? text.substring(0, 30) + (text.length > 30 ? "..." : "")
                : session.title,
            messageCount: session.messageCount + 1,
          };
        }
        return session;
      });
      setSessions(updatedSessions);
      saveSessions(user.wallet.address, updatedSessions);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to get response";
      setError(errorMessage);

      const errorMsg: Message = {
        id: Date.now() + 1,
        text: "Sorry, I encountered an error. Please try again.",
        isUser: false,
        error: errorMessage,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
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
    setError(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(message);
      setActivePrompt(null);
    }
  };

  return (
    <div className="flex-1 flex h-full relative">
      {/* Sidebar - Collapsible Overlay */}
      <motion.div
        initial={{ x: -250 }}
        animate={{ x: sidebarOpen ? 0 : -250 }}
        transition={{ duration: 0.3 }}
        className="absolute left-0 top-0 bottom-0 w-64 bg-zinc-900/80 backdrop-blur-sm border-r border-zinc-700/50 flex flex-col overflow-hidden z-50"
      >
        {/* New Chat Button */}
        <button
          onClick={startNewChat}
          className="m-4 flex items-center gap-2 rounded-lg bg-[#7BB8FF] hover:bg-[#6AABFF] text-white px-4 py-2.5 font-medium transition-colors"
        >
          <Plus size={18} />
          New Chat
        </button>

        {/* Divider */}
        <div className="h-px bg-zinc-700/50 mx-4" />

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {sessions.length === 0 ? (
            <div className="text-gray-400 text-sm text-center py-4">
              No conversations yet
            </div>
          ) : (
            sessions.map((session) => (
              <motion.div
                key={session.id}
                whileHover={{ x: 4 }}
                className={`group relative rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                  sessionId === session.id
                    ? "bg-blue-600/20 border border-blue-500/50"
                    : "hover:bg-zinc-800/50"
                }`}
                onClick={() => switchSession(session.id)}
              >
                <div className="flex items-start gap-2 min-w-0">
                  <MessageSquare size={14} className="mt-1 shrink-0 text-gray-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-300 truncate">
                      {session.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(session.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Delete Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(session.id);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-red-400 transition-opacity"
                >
                  <Trash2 size={14} />
                </button>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>

      {/* Backdrop - Click to close sidebar */}
      {sidebarOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/30 z-40"
        />
      )}

      {/* Main Chat Area - Takes full space, sidebar overlays */}
      <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-12 w-full overflow-hidden relative">
        {/* Sidebar Toggle Icon */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-4 left-4 p-2 rounded-lg hover:bg-zinc-800/50 text-gray-400 hover:text-white transition-colors z-10"
          aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Error notification */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm"
          >
            {error}
          </motion.div>
        )}

        {/* Messages Area - Takes up remaining space */}
        <div className="flex-1 overflow-y-auto space-y-4 flex flex-col justify-end pt-12">
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
                      src="/assets/chat_logo.svg"
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
                  className={`max-w-[80%] ${
                    msg.isUser
                      ? "bg-[#7BB8FF] text-white rounded-2xl px-5 py-3 transition-colors"
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
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 overflow-hidden">
                    {profilePictureUrl ? (
                      <Image
                        src={profilePictureUrl}
                        alt="User avatar"
                        width={32}
                        height={32}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <span className="text-white text-sm font-semibold">
                        {user?.wallet?.address?.substring(0, 1).toUpperCase() || "U"}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-white">
                  <Image
                    src="/assets/chat_logo.svg"
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
                  src="/assets/chat_logo.svg"
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
      </div>
    );
  };
