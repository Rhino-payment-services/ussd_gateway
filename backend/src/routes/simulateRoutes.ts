import { Router } from "express";
import { optionalAuth } from "../middleware/authMiddleware.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { simulateRateLimiter } from "../middleware/simulateRateLimit.js";
import { postSimulate, postReplay } from "../controllers/simulateController.js";

export const simulateRouter = Router();

simulateRouter.post("/", simulateRateLimiter, optionalAuth, postSimulate);
simulateRouter.post("/replay", simulateRateLimiter, requireAuth, postReplay);
