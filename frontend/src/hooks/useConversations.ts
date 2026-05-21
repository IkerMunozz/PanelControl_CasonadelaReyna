import { useCallback, useEffect, useState } from "react";
import { fetchConversation, fetchConversations } from "../api/client";
import type { ConversationDetail, ConversationSummary } from "../types";

export function useConversations(search: string, status: string) {
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string>();
  const [detail, setDetail] = useState<ConversationDetail>();
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const result = await fetchConversations({ search, status: status === "all" ? undefined : status, limit: 50 });
      setItems(result.data);
      setSelectedPhone((current) => current ?? result.data[0]?.phone);
    } catch {
      setError("No se pudieron cargar las conversaciones.");
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  const refreshDetail = useCallback(async (phone = selectedPhone) => {
    if (!phone) return;
    setDetailLoading(true);
    try {
      setDetail(await fetchConversation(phone));
    } finally {
      setDetailLoading(false);
    }
  }, [selectedPhone]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    refreshDetail();
  }, [refreshDetail]);

  return { items, setItems, selectedPhone, setSelectedPhone, detail, setDetail, loading, detailLoading, error, refresh, refreshDetail };
}
