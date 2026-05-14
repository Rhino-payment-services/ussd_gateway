import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../logger/logger.js";
import { HttpError } from "../errors/httpError.js";

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Validation failed", details: err.flatten() });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  logger.error("unhandled_error", { err: String(err) });
  res.status(500).json({ error: "Internal server error" });
}
