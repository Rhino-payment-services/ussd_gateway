import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import type { AuthPayload } from "../middleware/authMiddleware.js";

export async function registerUser(input: { email: string; password: string; name?: string }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new Error("Email already registered");
  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name,
    },
  });
  return signUser(user.id, user.email);
}

export async function loginUser(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw new Error("Invalid credentials");
  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw new Error("Invalid credentials");
  return signUser(user.id, user.email);
}

function signUser(sub: string, email: string) {
  const payload: AuthPayload = { sub, email };
  const options: SignOptions = { expiresIn: 60 * 60 * 24 * 7 };
  const token = jwt.sign(payload, env.JWT_SECRET, options);
  return { token, user: { id: sub, email } };
}
