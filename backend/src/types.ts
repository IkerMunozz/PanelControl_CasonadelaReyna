export type ConversationStatus = "normal" | "escalated";

export interface ChatMessage {
  id: string;
  phone: string;
  text: string;
  direction: "guest" | "agent" | "ai";
  timestamp: string;
  source?: string;
  reason?: string;
}

export interface ConversationSummary {
  phone: string;
  status: ConversationStatus;
  ttl: number;
  lastMessage: string;
  timestamp: string;
  reason?: string;
}

export interface WsEvent {
  type: "NEW_MESSAGE" | "ESCALATION_CHANGED";
  phone: string;
  message?: ChatMessage;
  status?: ConversationStatus | "resolved";
  timestamp?: string;
}

export interface DailyStats {
  total: number;
  escalated: number;
  resolved_by_ai: number;
  avg_response_ms: number;
  resolution_rate: number;
}
