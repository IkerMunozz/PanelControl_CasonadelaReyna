import { Send } from "lucide-react";
import { useState } from "react";
import { escalateConversation, resolveConversation } from "../api/client";
import type { ConversationDetail } from "../types";
import { maskPhone } from "../utils";
import { EscalationBanner } from "./EscalationBanner";
import { SendMessageModal } from "./SendMessageModal";

export function ChatPanel({
  detail,
  loading,
  onChanged
}: {
  detail?: ConversationDetail;
  loading: boolean;
  onChanged: () => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [optimisticStatus, setOptimisticStatus] = useState<"normal" | "escalated" | undefined>();

  if (loading) return <div className="h-96 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-900" />;
  if (!detail) return <div className="grid h-full place-items-center text-gray-500">Selecciona una conversación.</div>;

  const isEscalated = optimisticStatus ? optimisticStatus === "escalated" : detail.isEscalated;

  async function change(action: "resolve" | "escalate") {
    if (!detail) return;
    const previous = optimisticStatus;
    setBusy(true);
    setOptimisticStatus(action === "resolve" ? "normal" : "escalated");
    try {
      if (action === "resolve") await resolveConversation(detail.phone);
      else await escalateConversation(detail.phone, "request_human");
      onChanged();
    } catch {
      setOptimisticStatus(previous);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <header className="border-b border-gray-200 p-4 dark:border-gray-800">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Conversación</p>
            <h1 className="text-xl font-semibold text-gray-950 dark:text-white">{maskPhone(detail.phone)}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => change("resolve")} className="h-10 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200">Resolver escalación</button>
            <button disabled={busy} onClick={() => change("escalate")} className="h-10 rounded-lg bg-casona-amber px-3 text-sm font-medium text-white disabled:opacity-50">Escalar manualmente</button>
            <button onClick={() => setModalOpen(true)} className="flex h-10 items-center gap-2 rounded-lg bg-casona-teal px-3 text-sm font-medium text-white"><Send size={16} /> Enviar mensaje</button>
          </div>
        </div>
        {isEscalated && <div className="mt-4"><EscalationBanner /></div>}
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-gray-50 p-4 dark:bg-gray-900/60">
        {detail.messages.map((message) => {
          const isGuest = message.direction === "guest";
          const isAi = message.direction === "ai";
          const isAgent = message.direction === "agent";
          
          return (
            <div key={message.id} className={`flex ${isGuest ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[82%] rounded-lg px-4 py-2 shadow-sm ${
                isGuest 
                  ? "bg-white text-gray-950 dark:bg-gray-800 dark:text-white" 
                  : isAi 
                    ? "bg-indigo-600 text-white" 
                    : "bg-green-600 text-white"
              }`}>
                {!isGuest && (
                  <p className={`mb-1 text-[10px] font-bold uppercase tracking-wider ${isAi ? "text-indigo-200" : "text-green-100"}`}>
                    {isAi ? "Chatbot" : "Agente"}
                  </p>
                )}
                <p className="whitespace-pre-wrap text-sm leading-6">{message.text}</p>
                <p className={`mt-1 text-right text-[11px] ${isGuest ? "text-gray-500 dark:text-gray-400" : isAi ? "text-indigo-200" : "text-green-100"}`}>
                  {new Date(message.timestamp).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      {modalOpen && <SendMessageModal phone={detail.phone} onClose={() => setModalOpen(false)} onSent={onChanged} />}
    </section>
  );
}
