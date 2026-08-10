import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("7d"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  SESSION_TTL_SECONDS: z.coerce.number().default(180),
  WEBHOOK_TIMEOUT_MS: z.coerce.number().default(8000),
  ALLOW_ANONYMOUS_SIMULATE: z
    .string()
    .optional()
    .transform((v) => v === undefined || !["false", "0", "no", "off"].includes(String(v).toLowerCase())),
  SIMULATE_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  SIMULATE_RATE_LIMIT_MAX: z.coerce.number().default(300),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);

/** Browser Origin has no trailing slash; normalize env entries for exact cors matching. */
export function corsOrigins(raw: string = env.CORS_ORIGIN): string[] {
  return raw
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}
