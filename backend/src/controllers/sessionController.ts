import type { Request, Response } from "express";
import { getRedis } from "../redis/redisManager.js";
import { getSession } from "../services/sessionService.js";

export async function listActiveSessions(_req: Request, res: Response) {
  const redis = getRedis();
  const keys: string[] = [];
  let cursor = "0";
  do {
    const [next, batch] = await redis.scan(cursor, "MATCH", "ussd:session:*", "COUNT", "100");
    cursor = next;
    keys.push(...batch);
  } while (cursor !== "0");

  const sessions = [];
  for (const k of keys.slice(0, 200)) {
    const id = k.replace("ussd:session:", "");
    const s = await getSession(id);
    if (s) sessions.push(s);
  }
  res.json({ sessions });
}
