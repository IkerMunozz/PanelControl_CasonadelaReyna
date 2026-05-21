import { useCallback, useEffect, useState } from "react";
import { fetchDashboardStats } from "../api/client";
import type { DashboardStats } from "../types";

export function useStats(intervalMs = 30000) {
  const [stats, setStats] = useState<DashboardStats>();
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setStats(await fetchDashboardStats());
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, refresh]);

  return { stats, loading, refresh };
}

export function useStatsPolling(callback: () => void, intervalMs = 60000) {
  useEffect(() => {
    callback();
    const id = window.setInterval(callback, intervalMs);
    return () => window.clearInterval(id);
  }, [callback, intervalMs]);
}
