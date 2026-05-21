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

export interface ConversationDetail {
  phone: string;
  isEscalated: boolean;
  escalationTTL: number;
  status: ConversationStatus;
  messages: ChatMessage[];
}

export interface DashboardStats {
  totalActive: number;
  escalated: number;
  normal: number;
  resolvedToday: number;
}

export interface OverviewStats {
  today: { total: number; escalated: number; resolved_by_ai: number; avg_response_ms: number; resolution_rate: number };
  yesterday: { total: number; escalated: number; resolved_by_ai: number; avg_response_ms: number; resolution_rate: number };
  deltas: { total_pct: number; escalated_abs: number; resolution_rate_pct: number };
}

export interface WsEvent {
  type: "NEW_MESSAGE" | "ESCALATION_CHANGED";
  phone: string;
  message?: ChatMessage;
  status?: ConversationStatus | "resolved";
  timestamp?: string;
}
