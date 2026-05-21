import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  ArcElement,
  PointElement,
  Tooltip
} from "chart.js";
import { Download } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import {
  baseURL,
  fetchAiPerformance,
  fetchHourly,
  fetchIntents,
  fetchOverview,
  fetchPeakHours,
  fetchReasons,
  fetchWeekly,
  fetchConversations,
  resolveConversation
} from "../api/client";
import { useStatsPolling } from "../hooks/useStats";
import type { ConversationSummary, OverviewStats } from "../types";
import { formatMs, mapReason, maskPhone, relativeTime, todayISO } from "../utils";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Filler, Tooltip, Legend);

const card = "rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950";

export function StatsPage({ onOpenConversation }: { onOpenConversation: (phone: string) => void }) {
  const [range, setRange] = useState("today");
  const [overview, setOverview] = useState<OverviewStats>();
  const [hourly, setHourly] = useState<{ hours: string[]; normal: number[]; escalated: number[] }>();
  const [weekly, setWeekly] = useState<any>();
  const [reasons, setReasons] = useState<{ label: string; count: number }[]>([]);
  const [intents, setIntents] = useState<{ label: string; percentage: number }[]>([]);
  const [peak, setPeak] = useState<any>();
  const [ai, setAi] = useState<any>();
  const [recent, setRecent] = useState<ConversationSummary[]>([]);

  const refreshFast = useCallback(async () => {
    const [overviewData, hourlyData] = await Promise.all([fetchOverview(), fetchHourly(todayISO())]);
    setOverview(overviewData);
    setHourly(hourlyData);
  }, []);

  const refreshHeavy = useCallback(async () => {
    const [w, r, i, p, a, c] = await Promise.all([fetchWeekly(), fetchReasons(), fetchIntents(), fetchPeakHours(), fetchAiPerformance(), fetchConversations({ status: "escalated", limit: 10 })]);
    setWeekly(w);
    setReasons(r.reasons);
    setIntents(i.intents);
    setPeak(p);
    setAi(a);
    setRecent(c.data);
  }, []);

  useStatsPolling(refreshFast, 60000);
  useStatsPolling(refreshHeavy, 120000);

  useEffect(() => {
    refreshHeavy();
  }, [range, refreshHeavy]);

  const doughnut = useMemo(() => {
    const today = overview?.today;
    return {
      labels: ["Resueltas IA", "Escaladas", "En curso"],
      datasets: [{ data: [today?.resolved_by_ai ?? 0, today?.escalated ?? 0, Math.max((today?.total ?? 0) - (today?.resolved_by_ai ?? 0) - (today?.escalated ?? 0), 0)], backgroundColor: ["#1D9E75", "#BA7517", "#378ADD"], borderWidth: 0 }]
    };
  }, [overview]);

  const reasonColors: Record<string, string> = { Queja: "#E24B4A", Cancelación: "#D85A30", "Precio especial": "#BA7517", Incidencia: "#378ADD", "Pedir agente": "#534AB7" };

  return (
    <main className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-lg bg-gray-100 p-1 dark:bg-gray-900">
          {["today", "7d", "30d", "custom"].map((value) => (
            <button key={value} onClick={() => setRange(value)} className={`h-9 rounded-md px-3 text-sm font-medium ${range === value ? "bg-white text-gray-950 shadow-sm dark:bg-gray-800 dark:text-white" : "text-gray-600 dark:text-gray-300"}`}>
              {value === "today" ? "Hoy" : value === "7d" ? "7 días" : value === "30d" ? "30 días" : "Personalizado"}
            </button>
          ))}
        </div>
        <a href={`${baseURL}/stats/export?range=${range === "today" ? "today" : range}&format=csv`} className="flex h-10 items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 text-sm font-medium text-white dark:bg-white dark:text-gray-950">
          <Download size={16} /> Exportar CSV
        </a>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Conversaciones totales" value={overview?.today.total ?? 0} delta={`${overview?.deltas.total_pct ?? 0}%`} good />
        <Metric label="Escaladas" value={overview?.today.escalated ?? 0} delta={`${overview?.deltas.escalated_abs ?? 0}`} good={(overview?.deltas.escalated_abs ?? 0) <= 0} />
        <Metric label="Tasa resolución IA" value={`${overview?.today.resolution_rate ?? 0}%`} delta={`${overview?.deltas.resolution_rate_pct ?? 0}%`} good={(overview?.deltas.resolution_rate_pct ?? 0) >= 0} />
        <Metric label="Tiempo medio respuesta" value={formatMs(overview?.today.avg_response_ms ?? 0)} delta="vs ayer" good={(overview?.today.avg_response_ms ?? 0) <= (overview?.yesterday.avg_response_ms ?? Infinity)} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className={card}>
          <ChartHeader title="Conversaciones por hora" items={[["Normales", "#378ADD"], ["Escaladas", "#BA7517"]]} />
          <Bar role="img" aria-label="Gráfica de conversaciones por hora" data={{ labels: hourly?.hours ?? [], datasets: [{ label: "Normales", data: hourly?.normal ?? [], backgroundColor: "#378ADD" }, { label: "Escaladas", data: hourly?.escalated ?? [], backgroundColor: "#BA7517" }] }} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } }} />
        </section>
        <section className={card}>
          <h2 className="text-base font-semibold text-gray-950 dark:text-white">Estado de conversaciones</h2>
          <div className="mt-4 grid items-center gap-4 sm:grid-cols-[220px_1fr]">
            <Doughnut role="img" aria-label="Gráfica circular de estado de conversaciones" data={doughnut} options={{ cutout: "70%", plugins: { legend: { display: false } } }} />
            <div className="grid gap-3">
              {doughnut.labels.map((label, index) => <Counter key={label} label={label} value={doughnut.datasets[0].data[index]} />)}
            </div>
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className={card}>
          <h2 className="text-base font-semibold text-gray-950 dark:text-white">Motivos de escalación</h2>
          <Bar role="img" aria-label="Gráfica de motivos de escalación" data={{ labels: reasons.map((r) => r.label), datasets: [{ data: reasons.map((r) => r.count), backgroundColor: reasons.map((r) => reasonColors[r.label] ?? "#378ADD") }] }} options={{ indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }} />
        </section>
        <section className={card}>
          <ChartHeader title="Actividad semanal" items={[["Esta semana", "#378ADD"], ["Semana anterior", "#9CA3AF"]]} />
          <Line role="img" aria-label="Gráfica de actividad semanal" data={{ labels: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"], datasets: [{ label: "Esta semana", data: weekly?.this_week.totals ?? [], borderColor: "#378ADD", backgroundColor: "rgba(55,138,221,.16)", fill: true, tension: 0.35 }, { label: "Semana anterior", data: weekly?.last_week.totals ?? [], borderColor: "#9CA3AF", borderDash: [6, 6], fill: false, tension: 0.35 }] }} options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />
        </section>
      </div>

      <section className={`${card} mt-4`}>
        <h2 className="text-base font-semibold text-gray-950 dark:text-white">Mapa de calor — actividad por hora y día</h2>
        <div className="mt-4 overflow-x-auto">
          <div className="grid min-w-[760px] gap-1" style={{ gridTemplateColumns: `70px repeat(${peak?.heatmap.hours.length ?? 15}, 1fr)` }}>
            <div />
            {peak?.heatmap.hours.map((hour: string) => <div key={hour} className="text-center text-xs text-gray-500">{hour}</div>)}
            {peak?.heatmap.days.map((day: string, dayIndex: number) => (
              <>
                <div key={`${day}-label`} className="py-2 text-sm text-gray-600 dark:text-gray-300">{day}</div>
                {peak.heatmap.matrix[dayIndex].map((value: number, hourIndex: number) => <div key={`${day}-${hourIndex}`} title={`${day} ${peak.heatmap.hours[hourIndex]}: ${value}`} className="h-8 rounded" style={{ backgroundColor: heat(value) }} />)}
              </>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <section className={card}>
          <h2 className="text-base font-semibold text-gray-950 dark:text-white">Consultas más frecuentes</h2>
          <div className="mt-4 space-y-3">{intents.map((intent) => <Progress key={intent.label} {...intent} />)}</div>
        </section>
        <section className={card}>
          <h2 className="text-base font-semibold text-gray-950 dark:text-white">Pico de actividad</h2>
          <p className="mt-4 text-3xl font-semibold text-gray-950 dark:text-white">{peak?.peak_hour ?? "Sin datos"}</p>
          <p className="mt-2 text-gray-500 dark:text-gray-400">{peak?.peak_day ?? "Aún no hay actividad"}</p>
        </section>
        <section className={card}>
          <h2 className="text-base font-semibold text-gray-950 dark:text-white">Rendimiento IA</h2>
          <div className="mt-4 space-y-3 text-sm text-gray-700 dark:text-gray-200">
            <Badge label="Tasa resolución" value={`${ai?.resolution_rate ?? 0}%`} color="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" />
            <Badge label="Tasa escalación" value={`${ai?.escalation_rate ?? 0}%`} color="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" />
            <p>Media mensajes: <strong>{ai?.avg_messages_per_conv ?? 0}</strong></p>
            <p>TTL escalación: <strong>{ai?.escalation_ttl_hours ?? 2} h</strong></p>
          </div>
        </section>
      </div>

      <section className={`${card} mt-4`}>
        <h2 className="text-base font-semibold text-gray-950 dark:text-white">Últimas escalaciones</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-gray-500 dark:text-gray-400"><tr><th className="py-2">Teléfono</th><th>Motivo</th><th>Hace cuánto</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {recent.map((row) => (
                <tr key={row.phone}>
                  <td className="py-3 text-gray-950 dark:text-white">{maskPhone(row.phone)}</td>
                  <td>{mapReason(row.reason)}</td>
                  <td>{relativeTime(row.timestamp)}</td>
                  <td><span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">Activa</span></td>
                  <td className="space-x-2"><button onClick={() => onOpenConversation(row.phone)} className="text-casona-blue">Ver conversación</button><button onClick={() => resolveConversation(row.phone).then(() => setRecent((items) => items.filter((item) => item.phone !== row.phone)))} className="text-casona-teal">Resolver</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value, delta, good }: { label: string; value: string | number; delta: string; good: boolean }) {
  return <div className={card}><p className="text-sm text-gray-500 dark:text-gray-400">{label}</p><p className="mt-2 text-2xl font-semibold text-gray-950 dark:text-white">{value}</p><p className={`mt-1 text-sm ${good ? "text-casona-teal" : "text-casona-red"}`}>{delta}</p></div>;
}

function ChartHeader({ title, items }: { title: string; items: [string, string][] }) {
  return <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold text-gray-950 dark:text-white">{title}</h2><div className="flex gap-3">{items.map(([label, color]) => <span key={label} className="flex items-center gap-1 text-xs text-gray-500"><span className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />{label}</span>)}</div></div>;
}

function Counter({ label, value }: { label: string; value: number }) {
  return <div><p className="text-2xl font-semibold text-gray-950 dark:text-white">{value}</p><p className="text-sm text-gray-500 dark:text-gray-400">{label}</p></div>;
}

function Progress({ label, percentage }: { label: string; percentage: number }) {
  return <div><div className="mb-1 flex justify-between text-sm"><span className="text-gray-700 dark:text-gray-200">{label}</span><span className="text-gray-500">{percentage}%</span></div><div className="h-2 rounded bg-gray-100 dark:bg-gray-800"><div className="h-2 rounded bg-casona-teal" style={{ width: `${percentage}%` }} /></div></div>;
}

function Badge({ label, value, color }: { label: string; value: string; color: string }) {
  return <p className="flex items-center justify-between"><span>{label}</span><span className={`rounded-full px-2 py-1 text-xs font-medium ${color}`}>{value}</span></p>;
}

function heat(value: number) {
  const colors = ["#E6F1FB", "#B9D9F5", "#7DB6EA", "#378ADD", "#0C447C"];
  return colors[Math.min(Math.floor(value / 2.5), 4)];
}
