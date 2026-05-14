import type { Request, Response, NextFunction } from "express";
import { simulateInboundSchema, replayBodySchema } from "../types/simulate.js";
import { runSimulate, runReplay } from "../services/simulateService.js";

export async function postSimulate(req: Request, res: Response, next: NextFunction) {
  try {
    const body = simulateInboundSchema.parse(req.body);
    const result = await runSimulate(body, req.user?.sub ?? null);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

export async function postReplay(req: Request, res: Response, next: NextFunction) {
  try {
    const body = replayBodySchema.parse(req.body);
    const userId = req.user!.sub;
    const phone = body.phoneNumber ?? "256700000000";
    const code = body.serviceCode ?? "*182#";
    const results = await runReplay(userId, body.profileId, phone, code, body.steps);
    res.json({ sessionId: results[0]?.sessionId, results });
  } catch (e) {
    next(e);
  }
}
