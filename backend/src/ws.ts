import type { WebSocketServer } from "ws";
import type { WsEvent } from "./types.js";

let server: WebSocketServer | undefined;

export function setWebSocketServer(wsServer: WebSocketServer) {
  server = wsServer;
}

export function broadcast(event: WsEvent) {
  const payload = JSON.stringify(event);
  server?.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  });
}
