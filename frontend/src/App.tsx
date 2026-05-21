import { Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChatPanel } from "./components/ChatPanel";
import { Sidebar } from "./components/Sidebar";
import { StatsBar } from "./components/StatsBar";
import { StatsPage } from "./components/StatsPage";
import { useConversations } from "./hooks/useConversations";
import { useStats } from "./hooks/useStats";
import { useWebSocket } from "./hooks/useWebSocket";

export default function App() {
  const [view, setView] = useState<"chat" | "stats">("chat");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [dark, setDark] = useState(false);
  const conversations = useConversations(search, status);
  const stats = useStats(30000);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const handleEvent = useCallback(() => {
    conversations.refresh();
    conversations.refreshDetail();
    stats.refresh();
  }, [conversations, stats]);

  useWebSocket(handleEvent);

  const main = useMemo(() => {
    if (view === "stats") {
      return <StatsPage onOpenConversation={(phone) => { conversations.setSelectedPhone(phone); setView("chat"); }} />;
    }
    return (
      <main className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
        <StatsBar stats={stats.stats} loading={stats.loading} />
        {conversations.error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"><span>{conversations.error}</span><button onClick={conversations.refresh} className="ml-3 font-semibold">Reintentar</button></div>}
        <div className="mt-4 h-[calc(100vh-190px)] min-h-[520px]">
          <ChatPanel detail={conversations.detail} loading={conversations.detailLoading} onChanged={() => { conversations.refresh(); conversations.refreshDetail(); stats.refresh(); }} />
        </div>
      </main>
    );
  }, [view, conversations, stats]);

  return (
    <div className="h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <div className="flex h-full flex-col lg:flex-row">
        <div className="max-h-[46vh] lg:max-h-none">
          <Sidebar view={view} setView={setView} search={search} setSearch={setSearch} status={status} setStatus={setStatus} conversations={conversations.items} selectedPhone={conversations.selectedPhone} onSelect={(phone) => { conversations.setSelectedPhone(phone); setView("chat"); }} loading={conversations.loading} />
        </div>
        <div className="relative flex min-h-0 flex-1 flex-col">
          <button onClick={() => setDark((value) => !value)} className="absolute right-4 top-4 z-10 rounded-lg border border-gray-200 bg-white p-2 text-gray-600 shadow-sm dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200" aria-label="Cambiar modo oscuro">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {main}
        </div>
      </div>
    </div>
  );
}
