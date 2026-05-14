import type { Request, Response } from "express";
import { z } from "zod";
import { loginUser, registerUser } from "../services/authService.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().max(120).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function register(req: Request, res: Response) {
  const body = registerSchema.parse(req.body);
  try {
    const out = await registerUser(body);
    res.status(201).json(out);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
}

export async function login(req: Request, res: Response) {
  const body = loginSchema.parse(req.body);
  try {
    const out = await loginUser(body);
    res.json(out);
  } catch {
    res.status(401).json({ error: "Invalid credentials" });
  }
}

export async function me(req: Request, res: Response) {
  res.json({ user: req.user });
}
