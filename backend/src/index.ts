import cors from "cors";
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import path from "node:path";
import { WebSocketServer } from "ws";
import { connectRedis, redis } from "./redis.js";
import { conversationsRouter } from "./routes/conversations.js";
import { statsRouter } from "./routes/stats.js";
import { webhookRouter } from "./routes/webhook.js";
import { setWebSocketServer } from "./ws.js";

const app = express();
const server = createServer(app);
const wsServer = new WebSocketServer({ server });
setWebSocketServer(wsServer);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (_req, res) => {
  try {
    await redis.ping();
    res.json({ redis: "ok", uptime: process.uptime() });
  } catch {
    res.status(503).json({ redis: "error", uptime: process.uptime() });
  }
});

app.use("/api/conversations", conversationsRouter);
app.use("/api/stats", statsRouter);
app.use("/api/webhook", webhookRouter);

const frontendDist = path.resolve(import.meta.dirname, "../../frontend/dist");
app.use(express.static(frontendDist));

app.get("*", (_req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unexpected error";
  res.status(message.includes("required") ? 400 : 500).json({ error: message });
});

const port = Number(process.env.PORT ?? 3001);

await connectRedis();
server.listen(port, () => {
  console.log(`Casona dashboard API listening on http://localhost:${port}`);
});
