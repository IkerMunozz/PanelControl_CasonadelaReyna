import { createClient } from "redis";
import "dotenv/config";

export const redis = createClient({
  url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  password: process.env.REDIS_PASSWORD || undefined,
  socket: process.env.REDIS_URL?.startsWith("rediss://") ? { tls: true } : undefined
});

redis.on("error", (error) => {
  console.error("Redis error", error);
});

export async function connectRedis() {
  if (!redis.isOpen) {
    await redis.connect();
  }
  return redis;
}

export async function scanKeys(pattern: string): Promise<string[]> {
  const client = await connectRedis();
  const keys: string[] = [];
  for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
    keys.push(String(key));
  }
  return keys;
}
