/**
 * @deprecated Direct anon access to ai_chat_* tables is locked down.
 * These helpers are unused by the app. Prefer /api/user/* patterns with
 * service-role routes if chat session persistence is re-enabled.
 */

export interface ChatMessage {
  id: string;
  wallet_address: string;
  session_id: string;
  message_text: string;
  is_user_message: boolean;
  message_type: "text" | "chart" | "analysis";
  created_at: string;
  updated_at: string;
}

export interface ChatSession {
  id: string;
  wallet_address: string;
  title?: string;
  is_active: boolean;
  message_count: number;
  last_message_at?: string;
  created_at: string;
  updated_at: string;
}

const disabled = (name: string): never => {
  throw new Error(
    `${name} is disabled: ai_chat tables require service-role API access after RLS lockdown.`,
  );
};

export const createChatSession = async (): Promise<ChatSession> =>
  disabled("createChatSession");

export const getChatSessions = async (): Promise<ChatSession[]> =>
  disabled("getChatSessions");

export const getChatSession = async (): Promise<ChatSession | null> =>
  disabled("getChatSession");

export const addChatMessage = async (): Promise<ChatMessage> =>
  disabled("addChatMessage");

export const getChatMessages = async (): Promise<ChatMessage[]> =>
  disabled("getChatMessages");

export const deleteChatMessage = async (): Promise<void> =>
  disabled("deleteChatMessage");

export const closeChatSession = async (): Promise<void> =>
  disabled("closeChatSession");

export const updateSessionLastMessage = async (): Promise<void> =>
  disabled("updateSessionLastMessage");

export const saveChatLocally = (
  sessionId: string,
  messages: ChatMessage[],
): void => {
  try {
    localStorage.setItem(
      `tower-chat-${sessionId}`,
      JSON.stringify({
        sessionId,
        messages,
        savedAt: new Date().toISOString(),
      }),
    );
  } catch (error) {
    console.error("Error saving chat locally:", error);
  }
};

export const loadChatLocally = (
  sessionId: string,
): { messages: ChatMessage[]; savedAt: string } | null => {
  try {
    const data = localStorage.getItem(`tower-chat-${sessionId}`);
    if (data) {
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error("Error loading chat locally:", error);
    return null;
  }
};

export const clearChatLocalCache = (sessionId: string): void => {
  try {
    localStorage.removeItem(`tower-chat-${sessionId}`);
  } catch (error) {
    console.error("Error clearing chat cache:", error);
  }
};
