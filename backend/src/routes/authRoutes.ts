import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { register, login, me } from "../controllers/authController.js";

export const authRouter = Router();

authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.get("/me", requireAuth, me);
