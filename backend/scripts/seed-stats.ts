import { connectRedis, redis } from "../src/redis.js";
import { formatDate, recordEscalationStats, recordIncomingStats, recordResolvedByAi, recordResponseMs } from "../src/stats-utils.js";
import type { ChatMessage } from "../src/types.js";

const phones = ["+34600123789", "+34611999888", "+34622988777", "+34633444555", "+34644000123", "+34655111222"];
const samples = [
  "Hola, quería saber disponibilidad para este sábado",
  "¿Cuánto cuesta una habitación doble?",
  "Necesito cambiar la hora de llegada",
  "¿El desayuno está incluido?",
  "Quiero hablar con una persona del hotel"
];
const reasons = ["complaint", "cancellation", "special_price", "incident", "request_human"];

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function dateWith(dayOffset: number, hour: number) {
  const date = new Date();
  date.setDate(date.getDate() - dayOffset);
  date.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
  return date;
}

await connectRedis();

for (let offset = 0; offset < 30; offset += 1) {
  const dailyVolume = 8 + Math.floor(Math.random() * 24);
  for (let i = 0; i < dailyVolume; i += 1) {
    const phone = randomItem(phones);
    const escalated = Math.random() < 0.24;
    const timestamp = dateWith(offset, 8 + Math.floor(Math.random() * 15));
    const text = randomItem(samples);
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      phone,
      text,
      direction: "guest",
      timestamp: timestamp.toISOString(),
      source: "seed"
    };
    await redis.lPush(`messages:${phone}`, JSON.stringify(message));
    await redis.lTrim(`messages:${phone}`, 0, 99);
    await recordIncomingStats(phone, text, escalated, timestamp);
    await recordResponseMs(20000 + Math.floor(Math.random() * 220000), timestamp);
    if (escalated) {
      const reason = randomItem(reasons);
      await recordEscalationStats(reason, timestamp);
      if (offset < 2) {
        await redis.set(`hotel-escalation:${phone}`, "escalated", { EX: 7200 });
        await redis.set(`hotel-escalation-reason:${phone}`, reason, { EX: 7200 });
      }
    } else {
      await recordResolvedByAi(timestamp);
    }
  }
}

await redis.incrBy(`stats:resolved:${formatDate()}`, 9);
await redis.quit();
console.log("Seed de estadísticas completado.");
