import { Redis } from "ioredis";
import { env } from "../config/env.js";
import { logger } from "../logger/logger.js";

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    client.on("error", (err: Error) => logger.error("redis_error", { err: String(err) }));
  }
  return client;
}

export async function redisPing(): Promise<boolean> {
  try {
    const r = getRedis();
    const pong = await r.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}
