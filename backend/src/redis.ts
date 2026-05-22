import { createClient } from "redis";
import "dotenv/config";

class MockRedis {
  private data = new Map<string, any>();
  private ttls = new Map<string, number>();
  isOpen = false;

  async connect() {
    this.isOpen = true;
    console.log("Using In-Memory Redis Mock");
  }

  async quit() {
    this.isOpen = false;
  }

  on(event: string, callback: Function) {
    return this;
  }

  async ping() { return "PONG"; }

  async get(key: string) {
    const val = this.data.get(key);
    return val !== undefined ? String(val) : null;
  }

  async set(key: string, value: any, options?: any) {
    this.data.set(key, value);
    if (options?.EX) {
      this.ttls.set(key, Date.now() + options.EX * 1000);
    }
    return "OK";
  }

  async del(key: string) {
    this.data.delete(key);
    this.ttls.delete(key);
    return 1;
  }

  async incr(key: string) {
    const val = Number(this.data.get(key) || 0) + 1;
    this.data.set(key, val);
    return val;
  }

  async incrBy(key: string, amount: number) {
    const val = Number(this.data.get(key) || 0) + amount;
    this.data.set(key, val);
    return val;
  }

  async expire(key: string, seconds: number) {
    this.ttls.set(key, Date.now() + seconds * 1000);
    return 1;
  }

  async ttl(key: string) {
    const expiry = this.ttls.get(key);
    if (!expiry) return -1;
    const ttl = Math.floor((expiry - Date.now()) / 1000);
    return ttl > 0 ? ttl : -2;
  }

  async type(key: string) {
    const val = this.data.get(key);
    if (val === undefined) return "none";
    if (Array.isArray(val)) return "list";
    if (val instanceof Set) return "set";
    if (val instanceof Map) return "zset";
    return "string";
  }

  async mGet(keys: string[]) {
    return keys.map(key => {
      const val = this.data.get(key);
      return val !== undefined ? String(val) : null;
    });
  }

  async lPush(key: string, value: string) {
    if (!Array.isArray(this.data.get(key))) this.data.set(key, []);
    this.data.get(key).unshift(value);
    return this.data.get(key).length;
  }

  async lRange(key: string, start: number, end: number) {
    const list = this.data.get(key);
    if (!Array.isArray(list)) return [];
    if (end === -1) return list.slice(start);
    return list.slice(start, end + 1);
  }

  async lTrim(key: string, start: number, end: number) {
    const list = this.data.get(key);
    if (Array.isArray(list)) {
      this.data.set(key, list.slice(start, end === -1 ? undefined : end + 1));
    }
    return "OK";
  }

  async lLen(key: string) {
    const list = this.data.get(key);
    return Array.isArray(list) ? list.length : 0;
  }

  async sAdd(key: string, member: string) {
    let set = this.data.get(key);
    if (!(set instanceof Set)) {
      set = new Set();
      this.data.set(key, set);
    }
    set.add(member);
    return 1;
  }

  async zIncrBy(key: string, increment: number, member: string) {
    let map = this.data.get(key);
    if (!(map instanceof Map)) {
      map = new Map();
      this.data.set(key, map);
    }
    const score = (map.get(member) || 0) + increment;
    map.set(member, score);
    return score;
  }

  async zRangeWithScores(key: string, start: number, end: number) {
    const map = this.data.get(key);
    if (!(map instanceof Map)) return [];
    const entries = [...map.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([value, score]) => ({ value, score }));
    if (end === -1) return entries.slice(start);
    return entries.slice(start, end + 1);
  }

  async* scanIterator(options: any) {
    const pattern = options.MATCH.replace(/\*/g, ".*");
    const regex = new RegExp(`^${pattern}$`);
    for (const key of this.data.keys()) {
      if (regex.test(key)) yield key;
    }
  }

  multi() {
    const chain: any = {
      incr: (key: string) => { this.incr(key); return chain; },
      expire: (key: string, seconds: number) => { this.expire(key, seconds); return chain; },
      zIncrBy: (key: string, inc: number, mem: string) => { this.zIncrBy(key, inc, mem); return chain; },
      sAdd: (key: string, mem: string) => { this.sAdd(key, mem); return chain; },
      lPush: (key: string, val: string) => { this.lPush(key, val); return chain; },
      lTrim: (key: string, s: number, e: number) => { this.lTrim(key, s, e); return chain; },
      exec: async () => []
    };
    return chain;
  }
}

export const useMock = process.env.REDIS_URL === "mock" || !process.env.REDIS_URL;

export const redis = useMock ? (new MockRedis() as any) : createClient({
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  password: process.env.REDIS_PASSWORD || undefined,
  socket: process.env.REDIS_URL?.startsWith("rediss://") ? { tls: true } : undefined
});

if (!useMock) {
  redis.on("error", (error: any) => {
    console.error("Redis error", error);
  });
}

export async function connectRedis() {
  if (!redis.isOpen) {
    try {
      await redis.connect();
    } catch (error) {
      if (!useMock) {
        console.warn("Failed to connect to Redis, falling back to mock");
        const mock = new MockRedis();
        await mock.connect();
        Object.assign(redis, mock);
        // We need to overwrite the methods because the original client has its own methods
        Object.setPrototypeOf(redis, MockRedis.prototype);
      } else {
        throw error;
      }
    }
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
