import { Router } from "express";
import { redis, scanKeys } from "../redis.js";
import { addDays, aggregateSortedSets, formatDate, getDailyStats, mapReason, pctDelta } from "../stats-utils.js";
import { maskPhone } from "./conversations.js";

export const statsRouter = Router();

const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const shortDays = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

async function getCount(key: string) {
  return Number((await redis.get(key)) ?? 0);
}

statsRouter.get("/", async (_req, res, next) => {
  try {
    const keys = await scanKeys("hotel-escalation:*");
    const values = await Promise.all(keys.map((key) => redis.get(key)));
    const escalated = values.filter((value) => value === "escalated").length;
    const today = formatDate();
    res.json({
      totalActive: keys.length,
      escalated,
      normal: keys.length - escalated,
      resolvedToday: await getCount(`stats:resolved:${today}`)
    });
  } catch (error) {
    next(error);
  }
});

statsRouter.get("/overview", async (_req, res, next) => {
  try {
    const todayDate = new Date();
    const yesterdayDate = addDays(todayDate, -1);
    const today = await getDailyStats(todayDate);
    const yesterday = await getDailyStats(yesterdayDate);
    res.json({
      today,
      yesterday,
      deltas: {
        total_pct: pctDelta(today.total, yesterday.total),
        escalated_abs: today.escalated - yesterday.escalated,
        resolution_rate_pct: pctDelta(today.resolution_rate, yesterday.resolution_rate)
      }
    });
  } catch (error) {
    next(error);
  }
});

statsRouter.get("/hourly", async (req, res, next) => {
  try {
    const date = String(req.query.date ?? formatDate());
    const hours = Array.from({ length: 24 }, (_, index) => `${String(index).padStart(2, "0")}:00`);
    const normal = await Promise.all(hours.map((hour) => getCount(`stats:hourly:${date}:${hour.slice(0, 2)}:normal`)));
    const escalated = await Promise.all(hours.map((hour) => getCount(`stats:hourly:${date}:${hour.slice(0, 2)}:escalated`)));
    res.json({ hours, normal, escalated });
  } catch (error) {
    next(error);
  }
});

statsRouter.get("/weekly", async (_req, res, next) => {
  try {
    const build = async (startOffset: number) => {
      const dates = Array.from({ length: 7 }, (_, index) => formatDate(addDays(new Date(), startOffset + index)));
      const totals = await Promise.all(dates.map((date) => getCount(`stats:daily:${date}:total`)));
      const escalated = await Promise.all(dates.map((date) => getCount(`stats:daily:${date}:escalated`)));
      return { dates, totals, escalated };
    };
    res.json({ this_week: await build(-6), last_week: await build(-13) });
  } catch (error) {
    next(error);
  }
});

statsRouter.get("/escalation-reasons", async (_req, res, next) => {
  try {
    const keys = Array.from({ length: 7 }, (_, index) => `stats:escalation-reasons:${formatDate(addDays(new Date(), -index))}`);
    const aggregated = await aggregateSortedSets(keys);
    const collapsed = new Map<string, number>();
    aggregated.forEach(([reason, count]) => {
      const label = mapReason(reason);
      collapsed.set(label, (collapsed.get(label) ?? 0) + count);
    });
    res.json({ reasons: [...collapsed.entries()].map(([label, count]) => ({ label, count })) });
  } catch (error) {
    next(error);
  }
});

statsRouter.get("/top-intents", async (_req, res, next) => {
  try {
    const keys = Array.from({ length: 7 }, (_, index) => `stats:intents:${formatDate(addDays(new Date(), -index))}`);
    const rows = await aggregateSortedSets(keys);
    const total = rows.reduce((sum, [, count]) => sum + count, 0) || 1;
    res.json({ intents: rows.slice(0, 5).map(([label, count]) => ({ label, percentage: Math.round((count / total) * 1000) / 10 })) });
  } catch (error) {
    next(error);
  }
});

statsRouter.get("/peak-hours", async (_req, res, next) => {
  try {
    const hours = Array.from({ length: 15 }, (_, index) => 8 + index);
    const matrix = Array.from({ length: 7 }, () => Array.from({ length: hours.length }, () => 0));
    let max = 0;
    let peakDay = 0;
    let peakHour = 8;

    const now = new Date();
    const allKeys: string[] = [];
    const keyMap: { date: Date; dayIndex: number; hour: number }[] = [];
    for (let offset = 0; offset < 14; offset += 1) {
      const date = addDays(now, -offset);
      const day = formatDate(date);
      const dayIndex = date.getDay();
      for (const hour of hours) {
        const hh = String(hour).padStart(2, "0");
        allKeys.push(`stats:hourly:${day}:${hh}:normal`);
        allKeys.push(`stats:hourly:${day}:${hh}:escalated`);
        keyMap.push({ date, dayIndex, hour });
        keyMap.push({ date, dayIndex, hour });
      }
    }
    const values = await redis.mGet(allKeys);
    for (let i = 0; i < keyMap.length; i++) {
      const { dayIndex, hour } = keyMap[i];
      const val = Number(values[i] ?? 0);
      matrix[dayIndex][hour - 8] += val;
      if (matrix[dayIndex][hour - 8] > max) {
        max = matrix[dayIndex][hour - 8];
        peakDay = dayIndex;
        peakHour = hour;
      }
    }
    const normalized = matrix.map((row) => row.map((value) => (max ? Math.round((value / max) * 10) : 0)));
    res.json({
      peak_hour: `${String(peakHour).padStart(2, "0")}:00 - ${String(Math.min(peakHour + 3, 23)).padStart(2, "0")}:00`,
      peak_day: days[peakDay],
      heatmap: { days: shortDays.slice(1).concat(shortDays[0]), hours: hours.map((hour) => `${hour}h`), matrix: normalized.slice(1).concat([normalized[0]]) }
    });
  } catch (error) {
    next(error);
  }
});

statsRouter.get("/ai-performance", async (_req, res, next) => {
  try {
    const today = await getDailyStats(new Date());
    const messageKeys = await scanKeys("messages:*");
    const lengths = await Promise.all(messageKeys.map((key) => redis.lLen(key)));
    const avg = lengths.length ? Math.round((lengths.reduce((sum, value) => sum + value, 0) / lengths.length) * 10) / 10 : 0;
    res.json({
      resolution_rate: today.resolution_rate,
      escalation_rate: today.total ? Math.round((today.escalated / today.total) * 1000) / 10 : 0,
      avg_messages_per_conv: avg,
      escalation_ttl_hours: 2
    });
  } catch (error) {
    next(error);
  }
});

statsRouter.get("/export", async (req, res, next) => {
  try {
    const range = String(req.query.range ?? "today");
    const daysBack = range === "30d" ? 30 : range === "7d" ? 7 : 1;
    const messageKeys = await scanKeys("messages:*");
    const lines = ["fecha,hora,telefono_enmascarado,estado_final,escalada,motivo_escalacion,num_mensajes,resuelto_por_ia"];
    for (const key of messageKeys) {
      const phone = key.replace(/^messages:/, "");
      const values = await redis.lRange(key, 0, -1);
      const messages = values.map((value) => JSON.parse(value));
      const latest = messages[0];
      if (!latest) continue;
      const ageDays = (Date.now() - Date.parse(latest.timestamp)) / 86400000;
      if (ageDays > daysBack) continue;
      const escalated = (await redis.get(`hotel-escalation:${phone}`)) === "escalated";
      const date = new Date(latest.timestamp);
      lines.push([
        formatDate(date),
        String(date.getHours()).padStart(2, "0"),
        maskPhone(phone),
        escalated ? "escalada" : "normal",
        String(escalated),
        latest.reason ? mapReason(latest.reason) : "",
        messages.length,
        String(!escalated)
      ].join(","));
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="casona-stats-${formatDate()}.csv"`);
    res.send(lines.join("\n"));
  } catch (error) {
    next(error);
  }
});
