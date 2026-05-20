import { Router } from "express";
import { redis } from "../redis.js";
import { broadcast } from "../ws.js";
import { recordEscalationStats, recordIncomingStats, recordResponseMs } from "../stats-utils.js";
import type { ChatMessage } from "../types.js";

export const webhookRouter = Router();

function extractMessage(body: any): ChatMessage {
  const phone = String(body.phone ?? body.from ?? body.contact?.phone ?? body.messages?.[0]?.from ?? "");
  const text = String(body.message ?? body.text ?? body.body ?? body.messages?.[0]?.text?.body ?? "");
  if (!phone || !text) {
    throw new Error("phone and message are required");
  }
  return {
    id: String(body.id ?? body.messageId ?? crypto.randomUUID()),
    phone,
    text,
    direction: body.direction ?? "guest",
    timestamp: body.timestamp ?? new Date().toISOString(),
    source: "n8n",
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
    await recordEscalationStats(message.reason, new Date(message.timestamp));
  }
};

webhookRouter.post("/incoming", async (req, res, next) => {
  try {
    const message = extractMessage(req.body);
    await registerIncoming(message);
    broadcast({ type: "NEW_MESSAGE", phone: message.phone, message, timestamp: message.timestamp });
    res.json({ received: true });
  } catch (error) {
    next(error);
  }
});
