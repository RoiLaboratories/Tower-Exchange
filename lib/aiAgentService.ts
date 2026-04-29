/**
 * AI Agent Service - Handles communication with Tower-Exchange-AI backend
 */

import { supabase } from "./supabase";

export interface AIAgentRequest {
  message: string;
  userid: string;
  session_id: string;
  wallet_address?: string;
  chain_id?: number;
  enable_wallet_access?: boolean;
  enable_swap_execution?: boolean;
  enable_portfolio_analysis?: boolean;
}

export interface AIAgentResponse {
  reply: string;
  userid: string;
  session_id: string;
  data?: {
    action?: string;
    balances?: Array<{
      token: string;
      address: string;
      balance: string;
      formatted_balance: string;
    }>;
    positions?: Array<{
      token: string;
      amount: string;
      value: string;
      change: string;
    }>;
    pnl?: {
      total: string;
      percentage: number;
      timeframe: string;
    };
    volume?: {
      one_day: string;
      seven_day: string;
      thirty_day: string;
    };
    quote?: {
      inputToken: string;
      outputToken: string;
      inputAmount: string;
      outputAmount: string;
      priceImpact: number;
      minOut: string;
      route: any;
    };
    swap_execution?: {
      quote: {
        inputToken: string;
        outputToken: string;
        inputAmount: string;
        outputAmount: string;
        priceImpact: number;
        minOut: string;
        route: any;
      };
      transaction: {
        to: string;
        data: string;
        value: string;
        from: string;
        gasLimit: string;
        chainId: number;
        platformFeeAmount?: string;
        expectedUserOutput?: string;
        expectedFeeCollectorOutput?: string;
      };
    };
  };
}

export interface AIAgentError {
  error: string;
  code: string;
  message: string;
}

export interface ChatHistoryItem {
  id: number;
  created_at: string;
  user_query: string | null;
  ai_response: string | null;
  session_id: string | null;
  user_id: string | null;
}

// Use Next.js API proxy route (keeps API key secret)
const CHAT_ENDPOINT = "/api/ai/chat";

/**
 * Send a message to the Tower AI Agent and get a response
 */
export const sendMessageToAIAgent = async (
  request: AIAgentRequest
): Promise<AIAgentResponse> => {
  const url = CHAT_ENDPOINT;

  try {
    // Prepare request with wallet context and defaults
    const payload = {
      ...request,
      chain_id: request.chain_id || 5042002, // Arc testnet
      enable_wallet_access: request.enable_wallet_access === true,
      enable_swap_execution: request.enable_swap_execution === true,
      enable_portfolio_analysis: request.enable_portfolio_analysis === true,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as AIAgentError;
      throw new Error(
        errorData.message || `HTTP error! status: ${response.status}`
      );
    }

    const data = (await response.json()) as AIAgentResponse;
    return data;
  } catch (error) {
    console.error("Error communicating with Tower AI agent:", error);
    throw error;
  }
};

/**
 * Send a message to the Tower AI Agent (streaming support for future use)
 * Currently uses regular response, will upgrade to streaming later
 */
export const sendMessageToAIAgentStream = async (
  request: AIAgentRequest,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: Error) => void
): Promise<void> => {
  try {
    const response = await sendMessageToAIAgent(request);
    // Emit the complete response as a single chunk
    onChunk(response.reply);
    onComplete();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    onError(err);
  }
};

/**
 * Get conversation history from Supabase
 */
export const getConversationHistory = async (
  sessionId: string,
  userId: string
): Promise<
  Pick<ChatHistoryItem, "created_at" | "user_query" | "ai_response">[]
> => {
  try {
    const { data, error } = await supabase
      .from("ai_db")
      .select("created_at, user_query, ai_response")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("Error fetching chat history from Supabase:", error);
      return [];
    }

    return (
      data as Pick<ChatHistoryItem, "created_at" | "user_query" | "ai_response">[]
    ) || [];
  } catch (error) {
    console.warn("Error fetching conversation history:", error);
    return [];
  }
};

/**
 * Save chat message to Supabase
 */
export const saveChatMessageToHistory = async (
  userId: string,
  sessionId: string,
  userQuery: string,
  aiResponse: string
): Promise<ChatHistoryItem | null> => {
  try {
    const { data, error } = await supabase
      .from("ai_db")
      .insert({
        user_id: userId,
        session_id: sessionId,
        user_query: userQuery,
        ai_response: aiResponse,
      })
      .select()
      .single();

    if (error) {
      console.error("Error saving chat to Supabase:", error);
      return null;
    }

    return data as ChatHistoryItem;
  } catch (error) {
    console.error("Error saving chat message:", error);
    return null;
  }
};

/**
 * Create a new chat session (generates a local session ID)
 */
export const createAIAgentSession = async (
  walletAddress: string
): Promise<{ sessionId: string }> => {
  // Generate a local session ID using UUID
  // The backend doesn't need a separate session creation call
  const sessionId = crypto.randomUUID ? crypto.randomUUID() : generateUUID();
  return { sessionId };
};

/**
 * Fallback UUID generator if crypto.randomUUID is not available
 */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
