import { X } from "lucide-react";
import { useState } from "react";
import { sendMessage } from "../api/client";

export function SendMessageModal({ phone, onClose, onSent }: { phone: string; onClose: () => void; onSent: () => void }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setLoading(true);
    setError("");
    try {
      await sendMessage(phone, message);
      onSent();
      onClose();
    } catch {
      setError("No se pudo enviar el mensaje.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl dark:bg-gray-950">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-950 dark:text-white">Enviar mensaje</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-900" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={6} className="mt-4 w-full resize-none rounded-lg border border-gray-300 bg-white p-3 text-sm outline-none focus:border-casona-blue dark:border-gray-700 dark:bg-gray-900 dark:text-white" placeholder="Escribe la respuesta para el huésped" />
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">{message.length} caracteres</span>
          {error && <span className="text-casona-red">{error}</span>}
        </div>
        <button onClick={submit} disabled={!message.trim() || loading} className="mt-4 h-11 w-full rounded-lg bg-casona-teal font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? "Enviando..." : "Enviar"}
        </button>
      </div>
    </div>
  );
}
