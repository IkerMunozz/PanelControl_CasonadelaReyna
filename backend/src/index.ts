import cors from "cors";
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import fs from "node:fs";
import path from "node:path";
import { WebSocketServer } from "ws";
import { connectRedis, redis, useMock } from "./redis.js";
import { conversationsRouter } from "./routes/conversations.js";
import { statsRouter } from "./routes/stats.js";
import { webhookRouter } from "./routes/webhook.js";
import { setWebSocketServer } from "./ws.js";
import { seedMockData } from "./seed.js";

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

const possiblePaths = [
  path.resolve(process.cwd(), "frontend-dist"),
  path.resolve(process.cwd(), "backend/frontend-dist"),
  path.resolve(import.meta.dirname, "../../frontend-dist"),
  path.resolve(import.meta.dirname, "../frontend-dist"),
  "/app/frontend-dist",
  "/app/backend/frontend-dist",
];

console.log("Current working directory:", process.cwd());
console.log("Looking for frontend in:", possiblePaths);

const frontendDist = possiblePaths.find((p) => {
  try {
    const exists = fs.existsSync(path.join(p, "index.html"));
    console.log(`Checking ${p}: ${exists ? "FOUND" : "NOT FOUND"}`);
    return exists;
  } catch {
    return false;
  }
}) || path.resolve(process.cwd(), "frontend-dist");

console.log("Final Frontend dist path:", frontendDist);
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
if (useMock) {
  await seedMockData();
}
server.listen(port, () => {
  console.log(`Casona dashboard API listening on http://localhost:${port}`);
});
