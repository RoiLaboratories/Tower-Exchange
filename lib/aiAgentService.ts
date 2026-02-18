/**
 * AI Agent Service - Handles communication with the Vercel AI agent endpoint
 */

export interface AIAgentRequest {
  message: string;
  userid: string;
  session_id: string;
}

export interface AIAgentResponse {
  reply: string;
  userid: string;
  session_id: string;
}

export interface AIAgentError {
  error: string;
  code: string;
  message: string;
}

// Use local Next.js API proxy routes to avoid CORS issues
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URI || "http://localhost:3000";
const CHAT_ENDPOINT = "/api/ai/chat";
const SESSION_ENDPOINT = "/api/ai/session";
const HISTORY_ENDPOINT = "/api/ai/history";

/**
 * Send a message to the AI agent and get a response
 */
export const sendMessageToAIAgent = async (
  request: AIAgentRequest
): Promise<AIAgentResponse> => {
  const url = `${API_BASE_URL}${CHAT_ENDPOINT}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
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
    console.error("Error communicating with AI agent:", error);
    throw error;
  }
};

/**
 * Send a streaming message to the AI agent (for real-time responses)
 */
export const sendMessageToAIAgentStream = async (
  request: AIAgentRequest,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: Error) => void
): Promise<void> => {
  const url = `${API_BASE_URL}${CHAT_ENDPOINT}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Response body is not readable");
    }

    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          onComplete();
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        onChunk(chunk);
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    onError(err);
  }
};

/**
 * Get conversation history from the AI agent
 * Note: This endpoint may not be available in the current API version
 */
export const getConversationHistory = async (
  sessionId: string,
  walletAddress: string
): Promise<AIAgentResponse[]> => {
  const url = `${API_BASE_URL}${HISTORY_ENDPOINT}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Session-ID": sessionId,
        "X-Wallet-Address": walletAddress,
      },
    });

    if (!response.ok) {
      console.warn("History endpoint not available:", response.status);
      return [];
    }

    const data = (await response.json()) as AIAgentResponse[];
    return data;
  } catch (error) {
    console.warn("History endpoint not available:", error);
    return [];
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
