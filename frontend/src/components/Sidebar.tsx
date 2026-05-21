import { BarChart3, MessageSquareText } from "lucide-react";
import type { ConversationSummary } from "../types";
import { ConversationList } from "./ConversationList";

export function Sidebar({
  view,
  setView,
  search,
  setSearch,
  status,
  setStatus,
  conversations,
  selectedPhone,
  onSelect,
  loading
}: {
  view: "chat" | "stats";
  setView: (view: "chat" | "stats") => void;
  search: string;
  setSearch: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  conversations: ConversationSummary[];
  selectedPhone?: string;
  onSelect: (phone: string) => void;
  loading: boolean;
}) {
  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950 lg:w-96">
      <div className="border-b border-gray-200 p-4 dark:border-gray-800">
        <div className="mb-4 flex items-center gap-3">
          <img src="/logo_casona.png" alt="Casona de la Reyna" className="h-10 w-10 rounded-lg object-cover" />
          <div>
            <h1 className="text-base font-semibold text-gray-950 dark:text-white">Casona de la Reyna</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Panel de control</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView("chat")} className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-medium ${view === "chat" ? "bg-gray-950 text-white dark:bg-white dark:text-gray-950" : "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-200"}`}>
            <MessageSquareText size={17} /> Chats
          </button>
          <button onClick={() => setView("stats")} className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-medium ${view === "stats" ? "bg-gray-950 text-white dark:bg-white dark:text-gray-950" : "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-200"}`}>
            <BarChart3 size={17} /> Estadísticas
          </button>
        </div>
        <div className="mt-4 flex gap-2">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar teléfono o estado" className="h-10 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-950 outline-none focus:border-casona-blue dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-lg border border-gray-300 bg-white px-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white">
            <option value="all">Todas</option>
            <option value="normal">Normal</option>
            <option value="escalated">Escaladas</option>
          </select>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ConversationList items={conversations} selectedPhone={selectedPhone} onSelect={onSelect} loading={loading} />
      </div>
    </aside>
  );
}
