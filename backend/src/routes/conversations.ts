import axios from "axios";
import { Router } from "express";
import { redis, scanKeys } from "../redis.js";
import { broadcast } from "../ws.js";
import { recordEscalationStats, recordIncomingStats, recordResolvedByAi } from "../stats-utils.js";
import type { ChatMessage, ConversationStatus, ConversationSummary } from "../types.js";

export const conversationsRouter = Router();

function phoneFromEscalationKey(key: string) {
  return key.replace(/^hotel-escalation:/, "");
}

function maskPhone(phone: string) {
  return phone.replace(/(\+\d{2})\d+(...$)/, "$1 *** *** $2");
}

function parseMessage(raw: string, phone: string): ChatMessage | undefined {
  try {
    const value = JSON.parse(raw);
    const text = value.text ?? value.message ?? value.content ?? value.kwargs?.content ?? value.data?.content ?? "";
    
    let direction = value.direction;
    if (!direction) {
      const role = String(value.role || value.data?.role || value.type || "").toLowerCase();
      const isAI = ["assistant", "ai", "bot", "system"].includes(role);
      direction = isAI ? "ai" : "guest";
    }

    const timestampRaw = value.timestamp ?? value.createdAt ?? value.data?.additional_kwargs?.timestamp;
    const timestamp = (timestampRaw && !isNaN(Date.parse(timestampRaw))) ? timestampRaw : new Date().toISOString();

    return {
      id: value.id ?? value.data?.id ?? crypto.randomUUID(),
      phone,
      text: String(text),
      direction,
      timestamp,
      source: value.source || value.data?.additional_kwargs?.source
    };
  } catch {
    return {
      id: crypto.randomUUID(),
      phone,
      text: raw,
      direction: "guest",
      timestamp: new Date().toISOString()
    };
  }
}

async function readListMessages(key: string, phone: string) {
  const values = await redis.lRange(key, 0, 99);
  return values.map((value: string) => parseMessage(value, phone)).filter(Boolean) as ChatMessage[];
}

async function readN8nMemory(phone: string) {
  const key = `lc:memory_buffer:${phone}`;
  const type = await redis.type(key);
  if (type === "none") return [];
  if (type === "list") return readListMessages(key, phone);
  const raw = await redis.get(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    const messages = parsed.messages ?? parsed.chat_history ?? parsed.history ?? parsed;
    if (Array.isArray(messages)) {
      return messages.map((item) => parseMessage(JSON.stringify(item), phone)).filter(Boolean) as ChatMessage[];
    }
  } catch {
    return [parseMessage(raw, phone)].filter(Boolean) as ChatMessage[];
  }
  return [];
}

async function getStatus(phone: string): Promise<{ status: ConversationStatus; ttl: number; reason?: string }> {
  const key = `hotel-escalation:${phone}`;
  const reasonKey = `hotel-escalation-reason:${phone}`;
  const [value, ttl, reasonRaw] = await Promise.all([redis.get(key), redis.ttl(key), redis.get(reasonKey)]);
  return { status: value === "escalated" ? "escalated" : "normal", ttl, reason: reasonRaw ?? undefined };
}

async function loadSummary(phone: string): Promise<ConversationSummary> {
  const [{ status, ttl, reason }, dashboardMessages, historyMessages, memoryMessages] = await Promise.all([
    getStatus(phone),
    readListMessages(`messages:${phone}`, phone),
    readListMessages(`chat_history:${phone}`, phone),
    readN8nMemory(phone)
  ]);
  const messages = [...dashboardMessages, ...historyMessages, ...memoryMessages].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const lastMsg = messages[0];
  let lastText = lastMsg?.text ?? "";
  if (lastMsg) {
    if (lastMsg.direction === "ai") lastText = `Bot: ${lastText}`;
    else if (lastMsg.direction === "agent") lastText = `Tú: ${lastText}`;
  }
  
  return {
    phone,
    status,
    ttl,
    lastMessage: lastText,
    timestamp: lastMsg?.timestamp ?? new Date(0).toISOString(),
    reason
  };
}

conversationsRouter.get("/", async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page ?? 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit ?? 25), 1), 100);
    const statusFilter = String(req.query.status ?? "");
    const search = String(req.query.search ?? "").toLowerCase();
    const escalationKeys = await scanKeys("hotel-escalation:*");
    const messageKeys = await scanKeys("messages:*");
    const chatHistoryKeys = await scanKeys("chat_history:*");
    const memoryKeys = await scanKeys("lc:memory_buffer:*");
    const phones = new Set<string>();

    escalationKeys.forEach((key) => phones.add(phoneFromEscalationKey(key)));
    messageKeys.forEach((key) => phones.add(key.replace(/^messages:/, "")));
    chatHistoryKeys.forEach((key) => phones.add(key.replace(/^chat_history:/, "")));
    memoryKeys.forEach((key) => phones.add(key.replace(/^lc:memory_buffer:/, "")));

    let conversations = await Promise.all([...phones].map(loadSummary));
    if (statusFilter) conversations = conversations.filter((conversation) => conversation.status === statusFilter);
    if (search) {
      conversations = conversations.filter((conversation) => {
        return conversation.phone.toLowerCase().includes(search) || conversation.status.includes(search);
      });
    }
    conversations.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    const total = conversations.length;
    const start = (page - 1) * limit;
    res.json({ data: conversations.slice(start, start + limit), page, limit, total });
  } catch (error) {
    next(error);
  }
});

conversationsRouter.get("/:phone", async (req, res, next) => {
  try {
    const phone = req.params.phone;
    const [{ status, ttl }, dashboardMessages, historyMessages, memoryMessages] = await Promise.all([
      getStatus(phone),
      readListMessages(`messages:${phone}`, phone),
      readListMessages(`chat_history:${phone}`, phone),
      readN8nMemory(phone)
    ]);
    const byId = new Map<string, ChatMessage>();
    [...memoryMessages, ...historyMessages, ...dashboardMessages].forEach((message) => byId.set(message.id, message));
    const messages = [...byId.values()].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    res.json({ phone, isEscalated: status === "escalated", escalationTTL: ttl, messages, status });
  } catch (error) {
    next(error);
  }
});

conversationsRouter.post("/:phone/escalate", async (req, res, next) => {
  try {
    const phone = req.params.phone;
    const reason = req.body?.reason ?? "request_human";
    await redis.set(`hotel-escalation:${phone}`, "escalated", { EX: 7200 });
    await redis.set(`hotel-escalation-reason:${phone}`, reason, { EX: 7200 });
    await recordEscalationStats(reason);
    broadcast({ type: "ESCALATION_CHANGED", phone, status: "escalated", timestamp: new Date().toISOString() });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

conversationsRouter.post("/:phone/resolve", async (req, res, next) => {
  try {
    const phone = req.params.phone;
    const now = new Date();
    await redis.del(`hotel-escalation:${phone}`);
    await redis.del(`hotel-escalation-reason:${phone}`);
    await redis.incr(`stats:resolved:${now.toISOString().slice(0, 10)}`);
    await recordResolvedByAi(now);
    broadcast({ type: "ESCALATION_CHANGED", phone, status: "resolved", timestamp: now.toISOString() });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

conversationsRouter.post("/:phone/send", async (req, res, next) => {
  try {
    const phone = req.params.phone;
    const message = String(req.body?.message ?? "").trim();
    if (!message) return res.status(400).json({ error: "message is required" });
    if (!process.env.N8N_SEND_WEBHOOK_URL) return res.status(500).json({ error: "N8N_SEND_WEBHOOK_URL is not configured" });

    const response = await axios.post(process.env.N8N_SEND_WEBHOOK_URL, { phone, message }, { timeout: 15000 });
    const chatMessage: ChatMessage = {
      id: response.data?.messageId ?? crypto.randomUUID(),
      phone,
      text: message,
      direction: "agent",
      timestamp: new Date().toISOString(),
      source: "dashboard"
    };
    const isEscalated = (await redis.get(`hotel-escalation:${phone}`)) === "escalated";
    await recordIncomingStats(phone, message, isEscalated, new Date(chatMessage.timestamp));
    await redis.lPush(`messages:${phone}`, JSON.stringify(chatMessage));
    await redis.lTrim(`messages:${phone}`, 0, 99);
    broadcast({ type: "NEW_MESSAGE", phone, message: chatMessage, timestamp: chatMessage.timestamp });
    res.json({ success: true, messageId: response.data?.messageId });
  } catch (error) {
    next(error);
  }
});

export { maskPhone };
