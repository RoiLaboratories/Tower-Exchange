import { supabase } from "./supabase";

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

/**
 * Create a new chat session
 */
export const createChatSession = async (
  walletAddress: string,
  title?: string
): Promise<ChatSession> => {
  const { data, error } = await supabase
    .from("ai_chat_sessions")
    .insert({
      wallet_address: walletAddress,
      title: title || "New Chat",
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating chat session:", error);
    throw error;
  }

  return data;
};

/**
 * Get all chat sessions for a wallet
 */
export const getChatSessions = async (
  walletAddress: string
): Promise<ChatSession[]> => {
  const { data, error } = await supabase
    .from("ai_chat_sessions")
    .select("*")
    .eq("wallet_address", walletAddress)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("Error fetching chat sessions:", error);
    throw error;
  }

  return data || [];
};

/**
 * Get a specific chat session by ID
 */
export const getChatSession = async (
  sessionId: string
): Promise<ChatSession | null> => {
  const { data, error } = await supabase
    .from("ai_chat_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (error) {
    console.error("Error fetching chat session:", error);
    return null;
  }

  return data;
};

/**
 * Add a message to a chat session
 */
export const addChatMessage = async (
  walletAddress: string,
  sessionId: string,
  messageText: string,
  isUserMessage: boolean,
  messageType: "text" | "chart" | "analysis" = "text"
): Promise<ChatMessage> => {
  const { data, error } = await supabase
    .from("ai_chat_messages")
    .insert({
      wallet_address: walletAddress,
      session_id: sessionId,
      message_text: messageText,
      is_user_message: isUserMessage,
      message_type: messageType,
    })
    .select()
    .single();

  if (error) {
    console.error("Error adding chat message:", error);
    throw error;
  }

  // Update session's last_message_at and message_count
  await updateSessionLastMessage(sessionId);

  return data;
};

/**
 * Get all messages for a chat session
 */
export const getChatMessages = async (
  sessionId: string
): Promise<ChatMessage[]> => {
  const { data, error } = await supabase
    .from("ai_chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching chat messages:", error);
    throw error;
  }

  return data || [];
};

/**
 * Delete a chat message
 */
export const deleteChatMessage = async (messageId: string): Promise<void> => {
  const { error } = await supabase
    .from("ai_chat_messages")
    .delete()
    .eq("id", messageId);

  if (error) {
    console.error("Error deleting chat message:", error);
    throw error;
  }
};

/**
 * Close/archive a chat session
 */
export const closeChatSession = async (sessionId: string): Promise<void> => {
  const { error } = await supabase
    .from("ai_chat_sessions")
    .update({ is_active: false })
    .eq("id", sessionId);

  if (error) {
    console.error("Error closing chat session:", error);
    throw error;
  }
};

/**
 * Update session's last message timestamp and message count
 */
export const updateSessionLastMessage = async (
  sessionId: string
): Promise<void> => {
  // Get current message count
  const { data: messages, error: fetchError } = await supabase
    .from("ai_chat_messages")
    .select("id", { count: "exact" })
    .eq("session_id", sessionId);

  if (fetchError) {
    console.error("Error fetching message count:", fetchError);
    return;
  }

  const messageCount = messages?.length || 0;

  // Update session
  const { error } = await supabase
    .from("ai_chat_sessions")
    .update({
      last_message_at: new Date().toISOString(),
      message_count: messageCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    console.error("Error updating session:", error);
  }
};

/**
 * Save chat to localStorage as backup
 */
export const saveChatLocally = (
  sessionId: string,
  messages: ChatMessage[]
): void => {
  try {
    localStorage.setItem(
      `tower-chat-${sessionId}`,
      JSON.stringify({
        sessionId,
        messages,
        savedAt: new Date().toISOString(),
      })
    );
  } catch (error) {
    console.error("Error saving chat locally:", error);
  }
};

/**
 * Load chat from localStorage
 */
export const loadChatLocally = (
  sessionId: string
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

/**
 * Clear local chat cache
 */
export const clearChatLocalCache = (sessionId: string): void => {
  try {
    localStorage.removeItem(`tower-chat-${sessionId}`);
  } catch (error) {
    console.error("Error clearing chat cache:", error);
  }
};
