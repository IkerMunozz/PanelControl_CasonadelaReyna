import type { ConversationSummary } from "../types";
import { maskPhone, relativeTime } from "../utils";

export function ConversationList({
  items,
  selectedPhone,
  onSelect,
  loading
}: {
  items: ConversationSummary[];
  selectedPhone?: string;
  onSelect: (phone: string) => void;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-900" />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return <p className="p-4 text-sm text-gray-500 dark:text-gray-400">No hay conversaciones con ese filtro.</p>;
  }

  return (
    <div className="space-y-2 p-3">
      {items.map((item) => (
        <button
          key={item.phone}
          onClick={() => onSelect(item.phone)}
          className={`w-full rounded-lg border p-3 text-left transition ${
            selectedPhone === item.phone
              ? "border-casona-blue bg-blue-50 dark:border-casona-blue dark:bg-blue-950/30"
              : "border-transparent hover:bg-gray-100 dark:hover:bg-gray-900"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="font-medium text-gray-950 dark:text-white">{maskPhone(item.phone)}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.status === "escalated" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"}`}>
              {item.status === "escalated" ? "Escalada" : "Normal"}
            </span>
          </div>
          <p className="mt-2 truncate text-sm text-gray-600 dark:text-gray-300">{item.lastMessage || "Sin mensajes recientes"}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">{relativeTime(item.timestamp)}</p>
        </button>
      ))}
    </div>
  );
}
