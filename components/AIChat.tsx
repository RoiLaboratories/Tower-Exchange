"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { ArrowUp, ArrowDown, Info } from "lucide-react";
import {
  sendMessageToAIAgent,
  createAIAgentSession,
  saveChatMessageToHistory,
  getConversationHistory,
  type ChatHistoryItem,
} from "@/lib/aiAgentService";
import { loadProfileData } from "@/lib/profileService";
import { v4 as uuidv4 } from "uuid";
import { Plus, Trash2, Menu, X } from "lucide-react";
import { useSwapExecution } from "@/lib/useSwapExecution";
import {
  FEE_COLLECTOR_ADDRESS,
  getErc20TokenBalance,
  submitSwapFee,
  waitForTokenBalanceIncrease,
} from "@/lib/swapExecutionService";
import { TransactionConfirmation } from "./TransactionConfirmation";
import { AppErrorModal } from "@/components/AppErrorModal";
import { useRainbowKitAuth } from "@/lib/use-rainbowkit-auth";
import chatLogo from "@/public/assets/chat_logo.svg";

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
  "Show my 7D trading volume",
  "Provide overall analysis on the market",
];

const GENERIC_CHAT_TITLES = new Set(["New Chat", "Chat"]);

const formatSessionTitle = (text: string) => {
  const summary = text.trim().replace(/\s+/g, " ");
  if (!summary) return "New Chat";

  return summary.length > 30 ? `${summary.slice(0, 30)}...` : summary;
};

const isGenericSessionTitle = (title: string) => {
  const normalizedTitle = title.trim();
  return !normalizedTitle || GENERIC_CHAT_TITLES.has(normalizedTitle);
};

const getFeeCollectorOutputAmount = (
  transaction?: { expectedFeeCollectorOutput?: string },
  quote?: { outputAmount?: string }
) => {
  const feeCollectorOutput = transaction?.expectedFeeCollectorOutput;

  if (feeCollectorOutput && feeCollectorOutput !== "0") {
    return feeCollectorOutput;
  }

  return quote?.outputAmount ?? null;
};

const getHistorySessionMetadata = (
  history: Pick<ChatHistoryItem, "created_at" | "user_query" | "ai_response">[]
) => {
  const firstUserMessage =
    history.find((item) => item.user_query?.trim())?.user_query?.trim() || "";
  const firstCreatedAt = history[0]?.created_at
    ? new Date(history[0].created_at).getTime()
    : Number.NaN;

  return {
    title: firstUserMessage ? formatSessionTitle(firstUserMessage) : "New Chat",
    timestamp: Number.isFinite(firstCreatedAt) ? firstCreatedAt : Date.now(),
    messageCount: history.reduce(
      (count, item) => count + (item.user_query ? 1 : 0),
      0
    ),
  };
};

const normalizeSession = (session: ChatSession): ChatSession => ({
  ...session,
  title: session.title?.trim() || "New Chat",
  timestamp: Number.isFinite(session.timestamp) ? session.timestamp : Date.now(),
  messageCount:
    typeof session.messageCount === "number" && session.messageCount >= 0
      ? session.messageCount
      : 0,
});

export const AIChat = () => {
  const { user } = useRainbowKitAuth();
  const swapExecution = useSwapExecution();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [profileImageError, setProfileImageError] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSwapConfirmation, setShowSwapConfirmation] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isAtTop, setIsAtTop] = useState(true);
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Load sessions from localStorage
  const loadSessions = (walletAddress: string): ChatSession[] => {
    try {
      const sessionsData = localStorage.getItem(
        `tower-ai-sessions-${walletAddress}`
      );
      return sessionsData
        ? (JSON.parse(sessionsData) as ChatSession[]).map(normalizeSession)
        : [];
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

  const syncSessionFromHistory = useCallback((
    targetSessionId: string,
    history: Pick<ChatHistoryItem, "created_at" | "user_query" | "ai_response">[]
  ) => {
    const walletAddress = user?.wallet?.address;
    if (!walletAddress || history.length === 0) return;

    const nextMetadata = getHistorySessionMetadata(history);

    setSessions((prevSessions) => {
      let changed = false;

      const updatedSessions = prevSessions.map((session) => {
        if (session.id !== targetSessionId) return session;

        const shouldRefreshTimestamp =
          isGenericSessionTitle(session.title) ||
          session.messageCount === 0 ||
          !Number.isFinite(session.timestamp);
        const nextTitle = isGenericSessionTitle(session.title)
          ? nextMetadata.title
          : session.title;
        const nextTimestamp = shouldRefreshTimestamp
          ? nextMetadata.timestamp
          : session.timestamp;
        const nextMessageCount = Math.max(
          session.messageCount,
          nextMetadata.messageCount
        );

        if (
          nextTitle !== session.title ||
          nextTimestamp !== session.timestamp ||
          nextMessageCount !== session.messageCount
        ) {
          changed = true;
          return {
            ...session,
            title: nextTitle,
            timestamp: nextTimestamp,
            messageCount: nextMessageCount,
          };
        }

        return session;
      });

      if (changed) {
        saveSessions(walletAddress, updatedSessions);
      }

      return updatedSessions;
    });
  }, [user?.wallet?.address]);

  // Start a new chat
  const startNewChat = async () => {
    const walletAddress = user?.wallet?.address;
    if (!walletAddress) return;

    try {
      const newSessionId = uuidv4();
      const newSession: ChatSession = {
        id: newSessionId,
        title: "New Chat",
        timestamp: Date.now(),
        messageCount: 0,
      };

      // Add to sessions list
      setSessions((prevSessions) => {
        const updatedSessions = [newSession, ...prevSessions];
        saveSessions(walletAddress, updatedSessions);
        return updatedSessions;
      });

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
      setShowSwapConfirmation(false);
      swapExecution.resetState();
      setProfileImageError(false);
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
        syncSessionFromHistory(newSessionId, history);
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

      // If we deleted the active session, switch to the first available or clear chat
      if (sessionId === sessionToDelete) {
        if (updatedSessions.length > 0) {
          switchSession(updatedSessions[0].id);
        } else {
          // No more sessions, clear the chat area
          setMessages([]);
          setMessage("");
          setError(null);
          setShowSwapConfirmation(false);
          swapExecution.resetState();
          setSessionId("");
          setSidebarOpen(false);
        }
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
        console.log("Profile picture URL loaded:", profilePicUrl ? "✓ URL exists" : "✗ No URL");
        console.log("Profile URL:", profilePicUrl);
        setProfilePictureUrl(profilePicUrl);
        setProfileImageError(false);

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
              title: "New Chat",
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
          syncSessionFromHistory(sessionIdToUse, history);
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
  }, [syncSessionFromHistory, user?.wallet?.address]);

  // Detect if device is touch-enabled
  useEffect(() => {
    const isTouchEnabled = () => {
      return (
        window.matchMedia("(pointer:coarse)").matches ||
        ("ontouchstart" in window) ||
        (navigator.maxTouchPoints > 0)
      );
    };
    setIsTouchDevice(isTouchEnabled());
  }, []);

  // Close tooltip when clicking outside (for touch devices)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[aria-label="Trading volume information"]')) {
        setShowInfoTooltip(false);
      }
    };

    if (showInfoTooltip && isTouchDevice) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showInfoTooltip, isTouchDevice]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    const walletAddress = user?.wallet?.address;
    if (!walletAddress) {
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
      // Detect user intent to enable appropriate features
      const lowerMessage = text.toLowerCase();
      const enableWalletAccess = /balance|holding|wallet|token|asset|portfolio|position/.test(lowerMessage);
      const enablePortfolioAnalysis = /portfolio|performance|pnl|profit|loss|trading|volume|analysis/.test(lowerMessage);
      const enableSwap = /swap|exchange|trade/.test(lowerMessage);

      const response = await sendMessageToAIAgent({
        message: text,
        userid: walletAddress,
        session_id: sessionId,
        wallet_address: walletAddress,
        chain_id: 5042002, // Arc testnet
        enable_wallet_access: enableWalletAccess,
        enable_swap_execution: enableSwap,
        enable_portfolio_analysis: enablePortfolioAnalysis,
      });

      console.log("AI Response received:", response);
      console.log("Response data:", response.data);

      const aiResponse: Message = {
        id: Date.now() + 1,
        text: response.reply,
        isUser: false,
      };
      setMessages((prev) => [...prev, aiResponse]);

      // Check if swap execution data is present
      if (response.data?.swap_execution) {
        console.log("Swap execution data detected:", response.data.swap_execution);
        
        // Validate transaction structure
        const txData = response.data.swap_execution.transaction;
        const quote = response.data.swap_execution.quote;
        
        // Enhanced quote logging
        if (quote) {
          console.log("═══ FULL QUOTE OBJECT FROM BACKEND ═══");
          console.log("Full quote:", JSON.stringify(quote, null, 2));
          console.log("quote.inputToken:", quote.inputToken);
          console.log("quote.outputToken:", quote.outputToken);
          console.log("quote.outputToken type:", typeof quote.outputToken);
          console.log("quote.outputToken length:", quote.outputToken?.length);
          console.log("quote.inputAmount:", quote.inputAmount);
          console.log("quote.outputAmount:", quote.outputAmount);
          console.log("═════════════════════════════════════════");
        }
        
        if (txData) {
          console.log("Transaction fields:", {
            to: txData.to || "MISSING",
            data: txData.data ? `${txData.data.substring(0, 66)}...` : "MISSING",
            value: txData.value || "MISSING",
            from: txData.from || "MISSING",
            gasLimit: txData.gasLimit || "MISSING",
          });
        } else {
          console.error("Transaction object is undefined in swap_execution data");
        }

        setShowSwapConfirmation(true);

        // Auto-trigger swap execution flow
        if (walletAddress) {
          try {
            if (!txData || !txData.to) {
              throw new Error(
                "Cannot execute swap: Transaction object missing or 'to' address is undefined. Backend may not have returned proper swap execution data."
              );
            }

            const feeCollectorBalanceBefore =
              quote?.outputToken &&
              quote.outputToken.length === 42 &&
              quote.outputToken.startsWith("0x")
                ? await getErc20TokenBalance(
                    quote.outputToken,
                    FEE_COLLECTOR_ADDRESS
                  ).catch((balanceError) => {
                    console.warn(
                      "Unable to read FeeCollector balance before swap:",
                      balanceError
                    );
                    return null;
                  })
                : null;

            await swapExecution.executeSwap(
              txData,
              walletAddress,
              sessionId,
              async (confirmation) => {
                // After successful confirmation, submit platform fee to FeeCollector
                console.log("═══════════════════════════════════════════");
                console.log("SWAP CONFIRMATION RECEIVED");
                console.log("═══════════════════════════════════════════");
                console.log("Swap confirmed:", confirmation);
                
                // Submit fee using captured quote data
                console.log("Quote data available:", !!quote);
                console.log("Confirmation status:", confirmation.status);
                console.log("walletAddress captured:", !!walletAddress, walletAddress?.substring(0, 6) + "...");
                
                // Detailed quote inspection
                if (quote) {
                  console.log("─── Quote Details ───");
                  console.log("quote.outputToken:", quote.outputToken);
                  console.log("quote.outputToken length:", quote.outputToken?.length);
                  console.log("quote.outputToken valid?", quote.outputToken?.length === 42 && quote.outputToken?.startsWith("0x"));
                  console.log("quote.outputAmount:", quote.outputAmount);
                  console.log("quote.inputToken:", quote.inputToken);
                  console.log("quote.inputAmount:", quote.inputAmount);
                  console.log(
                    "transaction.expectedFeeCollectorOutput:",
                    txData?.expectedFeeCollectorOutput
                  );
                  console.log("Full quote object:", JSON.stringify(quote, null, 2));
                }
                
                if (quote && confirmation.status === "success") {
                  console.log("─── Initiating Fee Submission ───");
                  
                  const isValidToken = quote.outputToken?.length === 42 && quote.outputToken?.startsWith("0x");
                  const actualFeeCollectorOutput =
                    feeCollectorBalanceBefore !== null
                      ? await waitForTokenBalanceIncrease(
                          quote.outputToken,
                          FEE_COLLECTOR_ADDRESS,
                          feeCollectorBalanceBefore
                        )
                      : 0n;
                  const feeCollectorOutputAmount =
                    actualFeeCollectorOutput > 0n
                      ? actualFeeCollectorOutput.toString()
                      : getFeeCollectorOutputAmount(txData, quote);
                  const isValidAmount =
                    feeCollectorOutputAmount && Number(feeCollectorOutputAmount) > 0;
                  
                  console.log("Pre-submission validation:", {
                    tokenValid: isValidToken,
                    amountValid: isValidAmount,
                    walletValid: walletAddress?.length === 42 && walletAddress?.startsWith("0x"),
                    feeCollectorOutputAmount,
                    actualFeeCollectorOutput: actualFeeCollectorOutput.toString(),
                    expectedFeeCollectorOutput: txData?.expectedFeeCollectorOutput,
                    quoteOutputAmount: quote.outputAmount,
                  });

                  if (
                    feeCollectorBalanceBefore !== null &&
                    actualFeeCollectorOutput === 0n
                  ) {
                    console.error(
                      "Swap confirmed, but FeeCollector did not receive output tokens.",
                      {
                        outputToken: quote.outputToken,
                        feeCollector: FEE_COLLECTOR_ADDRESS,
                        expectedFeeCollectorOutput: txData?.expectedFeeCollectorOutput,
                        quoteOutputAmount: quote.outputAmount,
                      }
                    );
                    setError(
                      "Swap confirmed, but the output token did not reach the FeeCollector for distribution. The AI swap route needs to be rebuilt with the correct recipient."
                    );
                  } else if (!isValidToken || !isValidAmount) {
                    console.error("❌ Invalid quote data - cannot submit fee:", {
                      outputToken: quote.outputToken,
                      feeCollectorOutputAmount,
                    });
                    setError(
                      "Swap confirmed, but output distribution could not be started because the fee amount was missing."
                    );
                  } else {
                    console.log("Submitting platform fee after swap confirmation...", {
                      outputToken: quote.outputToken,
                      totalAmount: feeCollectorOutputAmount,
                      userAddress: walletAddress,
                      feeBps: 25,
                    });
                    try {
                      const feeResult = await submitSwapFee(
                        quote.outputToken,
                        feeCollectorOutputAmount,
                        walletAddress,
                        25  // 0.25% platform fee in basis points
                      );
                      console.log("submitSwapFee returned:", feeResult);
                      if (feeResult) {
                        console.log("Platform fee submitted successfully!");
                      } else {
                        console.warn("Fee submission returned false - check logs above for validation errors");
                        setError(
                          "Swap confirmed, but output distribution failed. Please contact support with your transaction hash."
                        );
                      }
                    } catch (feeError) {
                      console.error("❌ Error submitting platform fee:", feeError);
                      setError(
                        "Swap confirmed, but output distribution failed. Please contact support with your transaction hash."
                      );
                      // Log error but don't fail the swap - tokens are in FeeCollector
                    }
                  }
                } else {
                  console.warn("⚠️ Fee submission skipped - quote missing or confirmation failed", {
                    quote: !!quote,
                    status: confirmation.status,
                  });
                }
                console.log("═══════════════════════════════════════════");
              }
            );
          } catch (swapError) {
            console.error("Swap execution error:", swapError);
            // Error is handled by the hook's state
          }
        }
      }

      // Save chat to Supabase
      const savedChatMessage = await saveChatMessageToHistory(
        walletAddress,
        sessionId,
        text,
        response.reply
      );

      // Update session title and message count
      const conversationStartedAt = savedChatMessage?.created_at
        ? new Date(savedChatMessage.created_at).getTime()
        : Date.now();

      setSessions((prevSessions) => {
        const updatedSessions = prevSessions.map((session) => {
          if (session.id !== sessionId) {
            return session;
          }

          return {
            ...session,
            title: isGenericSessionTitle(session.title)
              ? formatSessionTitle(text)
              : session.title,
            timestamp:
              session.messageCount === 0
                ? conversationStartedAt
                : session.timestamp,
            messageCount: session.messageCount + 1,
          };
        });

        saveSessions(walletAddress, updatedSessions);
        return updatedSessions;
      });
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

  const dismissMessage = (messageId: number) => {
    setMessages((prevMessages) =>
      prevMessages.filter((msg) => msg.id !== messageId)
    );
  };

  const handleReset = () => {
    setActivePrompt(null);
    setMessages([]);
    setIsLoading(false);
    setError(null);
    setShowSwapConfirmation(false);
    swapExecution.resetState();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(message);
      setActivePrompt(null);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const isBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 50;
    const isTop = element.scrollTop === 0;
    setIsAtBottom(isBottom);
    setIsAtTop(isTop);
  };

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  const scrollToTop = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = 0;
    }
  };

  const hasMessages = messages.length > 0;

  useEffect(() => {
    if (!messagesContainerRef.current || (!hasMessages && !showSwapConfirmation)) {
      return;
    }

    window.requestAnimationFrame(() => {
      scrollToBottom();
    });
  }, [
    hasMessages,
    isLoading,
    messages.length,
    showSwapConfirmation,
    swapExecution.status,
    swapExecution.statusMessage,
  ]);

  return (
    <div className="relative flex h-full min-h-0 flex-1 overflow-hidden sm:rounded-[28px] sm:border sm:border-white/[0.06] sm:bg-[#090b10] sm:shadow-[0_22px_70px_rgba(0,0,0,0.36)] lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none">
      <div className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(circle_at_16%_82%,rgba(96,154,255,0.16),transparent_30%),radial-gradient(circle_at_58%_100%,rgba(51,88,148,0.22),transparent_38%),linear-gradient(180deg,#090a0d_0%,#0b0d11_46%,#10161e_100%)] sm:block lg:hidden" />

      <motion.div
        initial={false}
        animate={{ x: sidebarOpen ? 0 : -320 }}
        transition={{ duration: 0.3 }}
        className="absolute inset-y-0 left-0 z-40 flex w-[min(88vw,18rem)] flex-col overflow-hidden border-r border-white/[0.06] bg-[#101319]/95 backdrop-blur-2xl sm:w-72"
      >
        <div className="border-b border-white/[0.06] px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7f8796]">
            Conversations
          </p>
          <button
            onClick={() => {
              handleReset();
              startNewChat();
            }}
            className="mt-4 flex w-full items-center justify-start gap-2.5 rounded-2xl bg-[#7bb8ff] px-4 py-3 font-semibold text-[#081019] transition-colors hover:bg-[#90c3ff]"
          >
            <Plus size={18} />
            New Chat
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
          {sessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/[0.08] px-4 py-5 text-sm text-[#7f8796]">
              No conversations yet
            </div>
          ) : (
            sessions.map((session) => (
              <motion.div
                key={session.id}
                whileHover={{ x: 4 }}
                className={`group relative cursor-pointer rounded-2xl border px-3 py-3 transition-colors ${
                  sessionId === session.id
                    ? "border-[#6daeff]/45 bg-[#162030]"
                    : "border-transparent bg-white/[0.02] hover:border-white/[0.08] hover:bg-white/[0.04]"
                }`}
                onClick={() => switchSession(session.id)}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {session.title}
                  </p>
                  <p className="mt-1 text-xs text-[#7f8796]">
                    {new Date(session.timestamp).toLocaleDateString()}
                  </p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(session.id);
                  }}
                  className="absolute right-2 top-2 rounded-full p-1.5 text-[#8891a0] opacity-0 transition-opacity hover:bg-red-500/15 hover:text-red-300 group-hover:opacity-100"
                  aria-label="Delete session"
                >
                  <Trash2 size={14} />
                </button>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>

      {sidebarOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setSidebarOpen(false)}
          className="absolute inset-0 z-30 bg-black/40 backdrop-blur-[2px]"
        />
      )}

      <div className="relative z-10 flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center px-4 pt-4 sm:px-6 sm:pt-5 lg:px-7">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-[#c1c7d3] transition-colors hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-white sm:h-10 sm:w-10"
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        <AppErrorModal error={error} onClose={() => setError(null)} title="Operation failed" />

        <div className="relative flex-1 min-h-0 overflow-hidden">
          <div
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="chat-scrollbar absolute inset-0 overflow-y-scroll overscroll-contain pr-1"
          >
            {hasMessages ? (
              <div className="mx-auto flex min-h-full w-full max-w-[46rem] flex-col gap-4 px-4 pb-8 pt-5 sm:px-6 sm:pb-32 sm:pt-7 lg:px-7">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${
                      msg.isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    {!msg.isUser && (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-[#10141b]">
                        <Image
                          src={chatLogo}
                          alt="Tower logo"
                          width={28}
                          height={28}
                          className="object-contain"
                        />
                      </div>
                    )}

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`relative max-w-[calc(100%-3.25rem)] sm:max-w-[80%] ${
                        msg.isUser
                          ? "rounded-[20px] bg-[#78b6ff] px-4 py-3 text-[#081019] sm:rounded-[22px] sm:px-5"
                          : msg.text === "Trading Volume"
                          ? "rounded-[20px] border border-white/[0.06] bg-[#14181f]/92 p-4 text-white backdrop-blur-xl sm:rounded-[24px]"
                          : "rounded-[20px] border border-white/[0.06] bg-[#14181f]/92 px-4 py-4 text-white backdrop-blur-xl sm:rounded-[24px] sm:px-5"
                      } ${msg.error ? "pr-10 sm:pr-11" : ""}`}
                    >
                      {msg.error && (
                        <button
                          type="button"
                          onClick={() => dismissMessage(msg.id)}
                          className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                          aria-label="Dismiss chat error"
                          title={msg.error}
                        >
                          <X size={15} />
                        </button>
                      )}

                      {msg.text === "Trading Volume" ? (
                        <div>
                          <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">Trading Volume</span>
                              <div className="relative group">
                                <button
                                  onClick={() => isTouchDevice && setShowInfoTooltip(!showInfoTooltip)}
                                  onMouseEnter={() => !isTouchDevice && setShowInfoTooltip(true)}
                                  onMouseLeave={() => !isTouchDevice && setShowInfoTooltip(false)}
                                  className="p-1 text-gray-400 group-hover:text-white transition-colors"
                                  aria-label="Trading volume information"
                                >
                                  <Info size={16} />
                                </button>
                                {showInfoTooltip && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="absolute top-full mt-2 left-0 z-50 w-48 rounded-lg bg-[#0f1419]/95 border border-white/[0.1] px-3 py-2 text-xs text-gray-300 backdrop-blur-md"
                                  >
                                    Your total trading volume across 24H, 7D, 30D, or all-time periods.
                                  </motion.div>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {["24H", "7D", "30D", "ALL"].map((tf, idx) => (
                                <button
                                  key={tf}
                                  className={`rounded-lg px-3 py-1 text-xs ${
                                    idx === 1
                                      ? "bg-[#7BB8FF] text-[#081019]"
                                      : "text-gray-400"
                                  }`}
                                >
                                  {tf}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="mb-1 text-2xl font-bold">$44,238 USD</div>
                          <div className="mb-4 text-sm text-gray-400">
                            Jan, 2026 8:00 AM
                          </div>
                          <div className="relative h-32">
                            <svg className="h-full w-full" viewBox="0 0 400 100">
                              <polyline
                                points="0,60 50,40 100,70 150,50 200,20 250,40 300,70 350,50 400,30"
                                fill="none"
                                stroke="#7bb8ff"
                                strokeWidth="2"
                              />
                            </svg>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm leading-6 sm:leading-7">{msg.text}</p>
                      )}
                    </motion.div>

                    {msg.isUser && (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/[0.08] bg-[#2a313d]">
                        {profilePictureUrl && !profileImageError ? (
                          <Image
                            src={profilePictureUrl}
                            alt="User avatar"
                            width={40}
                            height={40}
                            className="h-full w-full object-cover"
                            onError={() => {
                              console.error(
                                "Failed to load profile image:",
                                profilePictureUrl
                              );
                              setProfileImageError(true);
                            }}
                            unoptimized={true}
                          />
                        ) : (
                          <span className="text-sm font-semibold text-white">
                            {user?.wallet?.address?.substring(0, 1).toUpperCase() ||
                              "U"}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {showSwapConfirmation && (
                  <div className="flex justify-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-[#10141b]">
                      <Image
                        src={chatLogo}
                        alt="Tower logo"
                        width={28}
                        height={28}
                        className="object-contain"
                      />
                    </div>
                    <div className="w-full max-w-[calc(100%-3.25rem)] sm:max-w-[28rem]">
                      <TransactionConfirmation
                        status={swapExecution.status}
                        statusMessage={swapExecution.statusMessage}
                        transactionHash={swapExecution.transactionHash}
                        blockNumber={swapExecution.blockNumber}
                        error={swapExecution.error}
                        onClose={() => {
                          setShowSwapConfirmation(false);
                          swapExecution.resetState();
                        }}
                      />
                    </div>
                  </div>
                )}

                {isLoading && (
                  <div className="flex justify-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-[#10141b]">
                      <Image
                        src={chatLogo}
                        alt="Tower logo"
                        width={28}
                        height={28}
                        className="object-contain"
                      />
                    </div>
                    <div className="rounded-[24px] border border-white/[0.06] bg-[#14181f]/92 px-5 py-4 backdrop-blur-xl">
                      <div className="flex gap-1">
                        <motion.div
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                          className="h-2 w-2 rounded-full bg-gray-400"
                        />
                        <motion.div
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                          className="h-2 w-2 rounded-full bg-gray-400"
                        />
                        <motion.div
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                          className="h-2 w-2 rounded-full bg-gray-400"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mx-auto flex min-h-full w-full max-w-[52rem] items-start px-4 pb-8 pt-6 sm:min-h-[calc(100%+10rem)] sm:items-end sm:px-6 sm:pb-28 sm:pt-10 lg:px-7">
                <div className="w-full max-w-[24rem]">
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.35 }}
                    className="mb-8 flex h-20 w-20 items-center justify-center"
                  >
                    <Image
                      src={chatLogo}
                      alt="Tower chat logo"
                      width={48}
                      height={48}
                      className="object-contain"
                    />
                  </motion.div>

                  <div className="flex flex-col gap-3">
                    {quickPrompts.map((prompt, index) => (
                      <motion.button
                        key={prompt}
                        initial={{ opacity: 0, x: -24 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.08, duration: 0.3 }}
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        className={`w-full max-w-[22rem] rounded-[20px] border px-4 py-3 text-left text-[0.9rem] leading-6 transition-all sm:w-fit sm:min-w-[14rem] sm:max-w-none sm:whitespace-nowrap sm:rounded-full sm:px-5 sm:py-3.5 sm:text-[0.92rem] ${
                          activePrompt === prompt
                            ? "border-[#8ec3ff] bg-[#162234] text-white shadow-[0_0_0_1px_rgba(142,195,255,0.15)]"
                            : "border-[#5f9ef0]/70 bg-[#0f131a]/95 text-[#e6ebf3] hover:border-[#8ec3ff] hover:bg-[#141b25]"
                        }`}
                        onClick={() => handlePromptClick(prompt)}
                      >
                        {prompt}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {hasMessages && (!isAtBottom || !isAtTop) && (
            <motion.button
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onClick={isAtBottom ? scrollToTop : scrollToBottom}
              className="absolute bottom-5 left-1/2 z-10 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border border-white/[0.08] bg-[#11151c]/95 text-white shadow-[0_12px_32px_rgba(0,0,0,0.32)] backdrop-blur-xl transition-colors hover:border-white/[0.16] hover:bg-[#171d27] sm:bottom-28"
              aria-label={isAtBottom ? "Scroll to top" : "Scroll to bottom"}
            >
              {isAtBottom ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
            </motion.button>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#090b10] via-[#090b10]/95 to-transparent sm:block" />

        <div className="relative z-20 mt-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 sm:absolute sm:inset-x-0 sm:bottom-0 sm:mt-0 sm:px-6 sm:pb-6 sm:pt-8 lg:px-7">
          <div className="mx-auto w-full max-w-[52rem]">
            <div className="w-full max-w-none sm:max-w-[30rem]">
              <div
                className="tower-chat-input-shell relative rounded-[20px] border border-white/[0.06] px-3.5 py-2 shadow-[0_16px_44px_rgba(0,0,0,0.36)] focus-within:border-white/[0.06] focus-within:outline-none focus-within:ring-0 sm:rounded-[22px] sm:px-4 sm:py-2.5"
                style={{
                  backgroundColor: "#131314",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask Tower anything..."
                  className="tower-chat-input h-8 w-full appearance-none border-0 bg-transparent pr-12 text-[0.88rem] text-white outline-none ring-0 placeholder:text-[#6d7380] focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                  style={{
                    outline: "none",
                    boxShadow: "none",
                    borderRadius: 0,
                    caretColor: "#ffffff",
                    WebkitAppearance: "none",
                    appearance: "none",
                    WebkitTapHighlightColor: "transparent",
                  }}
                />
                <motion.button
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => handleSendMessage(message)}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black sm:right-2.5"
                  aria-label="Send message"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
