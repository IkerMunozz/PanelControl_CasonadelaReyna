export function maskPhone(phone: string) {
  return phone.replace(/(\+\d{2})\d+(...$)/, "$1 *** *** $2");
}

export function relativeTime(value: string) {
  const diff = Date.now() - Date.parse(value);
  const minutes = Math.max(Math.floor(diff / 60000), 0);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

export function formatMs(ms: number) {
  if (!ms) return "0 s";
  if (ms < 60000) return `${Math.round(ms / 1000)} s`;
  return `${Math.round(ms / 6000) / 10} min`;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const reasonLabels: Record<string, string> = {
  complaint: "Queja",
  cancellation: "Cancelación",
  special_price: "Precio especial",
  incident: "Incidencia",
  request_human: "Pedir agente",
  other: "Otro"
};

export function mapReason(reason?: string) {
  if (!reason) return "Otro";
  return reasonLabels[reason] ?? "Otro";
}
