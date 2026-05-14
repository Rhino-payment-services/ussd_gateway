import type { Request, Response, NextFunction } from "express";
import { simulateInboundSchema } from "../types/simulate.js";
import { runSimulate } from "../services/simulateService.js";

/**
 * Legacy Africa's Talking-style path. Forwards to the same simulate / forward engine.
 */
export async function postUssd(req: Request, res: Response, next: NextFunction) {
  try {
    const body = simulateInboundSchema.parse(req.body);
    const result = await runSimulate(body, req.user?.sub ?? null);
    res.json({
      response: result.response,
      ended: result.ended,
      source: result.source,
      sessionId: result.sessionId,
      inspector: result.inspector,
    });
  } catch (e) {
    next(e);
  }
}
