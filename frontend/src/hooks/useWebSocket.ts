import { useEffect } from "react";
import { wsURL } from "../api/client";
import type { WsEvent } from "../types";

export function useWebSocket(onEvent: (event: WsEvent) => void) {
  useEffect(() => {
    const socket = new WebSocket(wsURL);
    socket.onmessage = (message) => {
      try {
        onEvent(JSON.parse(message.data));
      } catch {
        // Ignorar mensajes no JSON.
      }
    };
    return () => socket.close();
  }, [onEvent]);
}
