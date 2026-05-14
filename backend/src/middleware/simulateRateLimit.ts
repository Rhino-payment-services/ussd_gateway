import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

export const simulateRateLimiter = rateLimit({
  windowMs: env.SIMULATE_RATE_LIMIT_WINDOW_MS,
  max: env.SIMULATE_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many simulate requests, slow down." },
});
