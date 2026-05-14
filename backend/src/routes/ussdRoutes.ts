import { Router } from "express";
import { optionalAuth } from "../middleware/authMiddleware.js";
import { postUssd } from "../controllers/ussdController.js";

export const ussdRouter = Router();

ussdRouter.post("/", optionalAuth, postUssd);
