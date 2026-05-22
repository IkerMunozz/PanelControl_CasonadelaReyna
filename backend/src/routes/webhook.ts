import { Router } from "express";
import { redis } from "../redis.js";
import { broadcast } from "../ws.js";
import { recordEscalationStats, recordIncomingStats, recordResponseMs } from "../stats-utils.js";
import type { ChatMessage } from "../types.js";

export const webhookRouter = Router();

function extractMessage(body: any): ChatMessage | undefined {
  const phone = String(body.phone ?? body.from ?? body.contact?.phone ?? body.messages?.[0]?.from ?? "");
  const text = String(body.message ?? body.text ?? body.body ?? body.messages?.[0]?.text?.body ?? "");
  if (!phone || !text) {
    return undefined;
  }

  let direction = body.direction;
  if (!direction) {
    const role = body.role || body.data?.role;
    const type = body.type || body.data?.type;
    if (role === "assistant" || type === "ai") direction = "ai";
    else if (role === "human" || role === "user" || type === "human") direction = "guest";
    else direction = "guest";
  }

  const timestampRaw = body.timestamp ?? body.createdAt ?? body.data?.additional_kwargs?.timestamp;
  const timestamp = (timestampRaw && !isNaN(Date.parse(timestampRaw))) ? timestampRaw : new Date().toISOString();

  return {
    id: String(body.id ?? body.messageId ?? body.data?.id ?? crypto.randomUUID()),
    phone,
    text,
    direction,
    timestamp,
    source: body.source ?? "n8n",
    reason: body.reason
  };
}

export const registerIncoming = async (message: ChatMessage) => {
  const isEscalated = (await redis.get(`hotel-escalation:${message.phone}`)) === "escalated";
  await redis.lPush(`messages:${message.phone}`, JSON.stringify(message));
  await redis.lTrim(`messages:${message.phone}`, 0, 99);
  await recordIncomingStats(message.phone, message.text, isEscalated, new Date(message.timestamp));

  if (message.direction === "ai" || message.direction === "agent") {
    const firstGuest = await redis.get(`stats:first-message:${message.phone}`);
    if (firstGuest) {
      await recordResponseMs(Date.parse(message.timestamp) - Date.parse(firstGuest));
      await redis.del(`stats:first-message:${message.phone}`);
    }
  } else {
    await redis.set(`stats:first-message:${message.phone}`, message.timestamp, { EX: 60 * 60 * 24 });
  }

  if (message.reason) {
    const alreadyEscalated = (await redis.get(`hotel-escalation:${message.phone}`)) === "escalated";
    if (!alreadyEscalated) {
      await redis.set(`hotel-escalation:${message.phone}`, "escalated", { EX: 7200 });
      await redis.set(`hotel-escalation-reason:${message.phone}`, message.reason, { EX: 7200 });
      await recordEscalationStats(message.reason, new Date(message.timestamp));
    }
  }
};

webhookRouter.post("/incoming", async (req, res, next) => {
  try {
    const message = extractMessage(req.body);
    if (!message) {
      return res.json({ received: true, ignored: true });
    }
    await registerIncoming(message);
    broadcast({ type: "NEW_MESSAGE", phone: message.phone, message, timestamp: message.timestamp });
    res.json({ received: true });
  } catch (error) {
    next(error);
  }
});
