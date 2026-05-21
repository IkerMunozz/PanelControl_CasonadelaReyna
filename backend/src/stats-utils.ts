import { redis } from "./redis.js";
import type { DailyStats } from "./types.js";

const DAY_TTL_SECONDS = 60 * 60 * 24 * 90;

const reasonLabels: Record<string, string> = {
  complaint: "Queja",
  cancellation: "Cancelación",
  special_price: "Precio especial",
  incident: "Incidencia",
  request_human: "Pedir agente",
  other: "Otro"
};

const intentPatterns: Array<[string, RegExp]> = [
  ["Disponibilidad", /disponib|libre|habitac/i],
  ["Precios", /precio|tarifa|costo|cu[aá]nto/i],
  ["Check-in/out", /check|entrada|salida|lleg/i],
  ["Restauración", /desayun|comida|restaur/i]
];

export function formatDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function hourOf(date = new Date()) {
  return String(date.getHours()).padStart(2, "0");
}

export function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function mapReason(reason?: string) {
  if (!reason) return "Otro";
  return reasonLabels[reason] ?? "Otro";
}

export function classifyIntent(text: string) {
  return intentPatterns.find(([, pattern]) => pattern.test(text))?.[0] ?? "Otros";
}

export async function expireStatsKey(key: string) {
  await redis.expire(key, DAY_TTL_SECONDS);
}

export async function recordIncomingStats(phone: string, text: string, escalated: boolean, date = new Date()) {
  const day = formatDate(date);
  const hour = hourOf(date);
  const base = `stats:daily:${day}`;
  const hourlyKey = `stats:hourly:${day}:${hour}:${escalated ? "escalated" : "normal"}`;
  const intentKey = `stats:intents:${day}`;

  await redis
    .multi()
    .incr(`${base}:total`)
    .expire(`${base}:total`, DAY_TTL_SECONDS)
    .incr(hourlyKey)
    .expire(hourlyKey, DAY_TTL_SECONDS)
    .zIncrBy(intentKey, 1, classifyIntent(text))
    .expire(intentKey, DAY_TTL_SECONDS)
    .sAdd(`stats:daily:${day}:phones`, phone)
    .expire(`stats:daily:${day}:phones`, DAY_TTL_SECONDS)
    .exec();
}

export async function recordEscalationStats(reason?: string, date = new Date()) {
  const day = formatDate(date);
  const daily = `stats:daily:${day}:escalated`;
  const reasonKey = `stats:escalation-reasons:${day}`;
  await redis
    .multi()
    .incr(daily)
    .expire(daily, DAY_TTL_SECONDS)
    .zIncrBy(reasonKey, 1, reason ?? "other")
    .expire(reasonKey, DAY_TTL_SECONDS)
    .exec();
}

export async function recordResolvedByAi(date = new Date()) {
  const key = `stats:daily:${formatDate(date)}:resolved_by_ai`;
  await redis.multi().incr(key).expire(key, DAY_TTL_SECONDS).exec();
}

export async function recordResponseMs(ms: number, date = new Date()) {
  const key = `stats:daily:${formatDate(date)}:response_ms`;
  await redis.multi().lPush(key, String(ms)).lTrim(key, 0, 999).expire(key, DAY_TTL_SECONDS).exec();
}

export async function getDailyStats(date: Date): Promise<DailyStats> {
  const day = formatDate(date);
  const [totalRaw, escalatedRaw, resolvedRaw, responseValues] = await Promise.all([
    redis.get(`stats:daily:${day}:total`),
    redis.get(`stats:daily:${day}:escalated`),
    redis.get(`stats:daily:${day}:resolved_by_ai`),
    redis.lRange(`stats:daily:${day}:response_ms`, 0, -1)
  ]);
  const total = Math.max(Number(totalRaw ?? 0), Number(escalatedRaw ?? 0));
  const escalated = Number(escalatedRaw ?? 0);
  const resolved_by_ai = Number(resolvedRaw ?? Math.max(total - escalated, 0));
  const values = responseValues.map(Number).filter(Number.isFinite);
  const avg_response_ms = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  const resolution_rate = total ? Math.min(Math.round((resolved_by_ai / total) * 100), 100) : 0;
  return { total, escalated, resolved_by_ai, avg_response_ms, resolution_rate };
}

export function pctDelta(today: number, yesterday: number) {
  if (!yesterday) return today ? 100 : 0;
  return Math.round(((today - yesterday) / yesterday) * 1000) / 10;
}

export async function aggregateSortedSets(keys: string[]) {
  const totals = new Map<string, number>();
  for (const key of keys) {
    const rows = await redis.zRangeWithScores(key, 0, -1);
    rows.forEach((row) => totals.set(row.value, (totals.get(row.value) ?? 0) + row.score));
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]);
}
