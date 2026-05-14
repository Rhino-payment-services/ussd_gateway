import axios, { type AxiosRequestConfig } from "axios";
import { logger } from "../logger/logger.js";

export type ForwardRequestArgs = {
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH";
  headers: Record<string, string>;
  body: unknown;
  timeoutMs: number;
  delayMs: number;
  retries: number;
  duplicate?: boolean;
};

export type ForwardSuccess = {
  ok: true;
  status: number;
  rawBody: string;
  parsedData: unknown;
  latencyMs: number;
  attempts: number;
};

export type ForwardFailure = {
  ok: false;
  status?: number;
  error: string;
  latencyMs: number;
  attempts: number;
};

export type ForwardResult = ForwardSuccess | ForwardFailure;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function serializeBodyForGet(body: unknown): Record<string, string> {
  if (!body || typeof body !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    if (v === undefined || v === null) continue;
    out[k] = typeof v === "object" ? JSON.stringify(v) : String(v);
  }
  return out;
}

async function oneAttempt(args: ForwardRequestArgs): Promise<{ status: number; rawBody: string; parsedData: unknown; ms: number }> {
  const started = Date.now();
  const headers = { ...args.headers };
  const config: AxiosRequestConfig = {
    url: args.url,
    method: args.method,
    timeout: args.timeoutMs,
    headers,
    validateStatus: () => true,
  };

  if (args.method === "GET") {
    config.params = serializeBodyForGet(args.body);
  } else {
    config.data = args.body;
    if (!headers["Content-Type"] && !headers["content-type"]) {
      headers["Content-Type"] = "application/json";
    }
  }

  const res = await axios.request(config);
  const rawBody =
    typeof res.data === "string" ? res.data : JSON.stringify(res.data ?? "");
  const ms = Date.now() - started;
  return { status: res.status, rawBody, parsedData: res.data, ms };
}

export async function forwardWebhookRequest(args: ForwardRequestArgs): Promise<ForwardResult> {
  if (args.delayMs > 0) await sleep(args.delayMs);

  let totalMs = 0;
  let lastError = "Request failed";
  const maxAttempts = Math.max(1, args.retries + 1);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const r1 = await oneAttempt(args);
      totalMs += r1.ms;
      let status = r1.status;
      let rawBody = r1.rawBody;
      let parsedData = r1.parsedData;
      if (args.duplicate) {
        const r2 = await oneAttempt(args);
        totalMs += r2.ms;
        status = r2.status;
        rawBody = r2.rawBody;
        parsedData = r2.parsedData;
        logger.info("webhook_duplicate_roundtrip", { url: args.url, status });
      }
      return {
        ok: true,
        status,
        rawBody,
        parsedData,
        latencyMs: totalMs,
        attempts: attempt,
      };
    } catch (e) {
      lastError = String((e as Error).message);
    }
  }

  return { ok: false, error: lastError, latencyMs: totalMs, attempts: maxAttempts };
}
