import type { DashboardStats } from "../types";

export function StatsBar({ stats, loading }: { stats?: DashboardStats; loading: boolean }) {
  const cards = [
    ["Total activas", stats?.totalActive ?? 0],
    ["Escaladas", stats?.escalated ?? 0],
    ["En curso normal", stats?.normal ?? 0],
    ["Resueltas hoy", stats?.resolvedToday ?? 0]
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          {loading ? <div className="mt-3 h-8 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-800" /> : <p className="mt-2 text-3xl font-semibold text-gray-950 dark:text-white">{value}</p>}
        </div>
      ))}
    </div>
  );
}
