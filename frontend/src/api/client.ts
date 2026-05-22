import axios from "axios";
import type { ConversationDetail, ConversationSummary, DashboardStats, OverviewStats } from "../types";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";

export const api = axios.create({ baseURL });

export { baseURL };

const loc = typeof window !== "undefined" ? `${window.location.protocol.replace("http", "ws")}//${window.location.host}` : "";
export const wsURL = baseURL.startsWith("/") 
  ? `${loc}/ws` 
  : baseURL.replace(/^http/, "ws").replace(/\/api$/, "/ws");

export async function fetchConversations(params?: { status?: string; page?: number; limit?: number; search?: string }) {
  const { data } = await api.get<{ data: ConversationSummary[]; total: number; page: number; limit: number }>("/conversations", { params });
  return data;
}

export async function fetchConversation(phone: string) {
  const { data } = await api.get<ConversationDetail>(`/conversations/${encodeURIComponent(phone)}`);
  return data;
}

export async function escalateConversation(phone: string, reason?: string) {
  const { data } = await api.post(`/conversations/${encodeURIComponent(phone)}/escalate`, { reason });
  return data;
}

export async function resolveConversation(phone: string) {
  const { data } = await api.post(`/conversations/${encodeURIComponent(phone)}/resolve`);
  return data;
}

export async function sendMessage(phone: string, message: string) {
  const { data } = await api.post<{ success: boolean; messageId?: string }>(`/conversations/${encodeURIComponent(phone)}/send`, { message });
  return data;
}

export async function fetchDashboardStats() {
  const { data } = await api.get<DashboardStats>("/stats");
  return data;
}

export async function fetchOverview() {
  const { data } = await api.get<OverviewStats>("/stats/overview");
  return data;
}

export async function fetchHourly(date?: string) {
  const { data } = await api.get<{ hours: string[]; normal: number[]; escalated: number[] }>("/stats/hourly", { params: { date } });
  return data;
}

export async function fetchWeekly() {
  const { data } = await api.get<{ this_week: { dates: string[]; totals: number[]; escalated: number[] }; last_week: { dates: string[]; totals: number[]; escalated: number[] } }>("/stats/weekly");
  return data;
}

export async function fetchReasons() {
  const { data } = await api.get<{ reasons: { label: string; count: number }[] }>("/stats/escalation-reasons");
  return data;
}

export async function fetchIntents() {
  const { data } = await api.get<{ intents: { label: string; percentage: number }[] }>("/stats/top-intents");
  return data;
}

export async function fetchPeakHours() {
  const { data } = await api.get<{ peak_hour: string; peak_day: string; heatmap: { days: string[]; hours: string[]; matrix: number[][] } }>("/stats/peak-hours");
  return data;
}

export async function fetchAiPerformance() {
  const { data } = await api.get<{ resolution_rate: number; escalation_rate: number; avg_messages_per_conv: number; escalation_ttl_hours: number }>("/stats/ai-performance");
  return data;
}
