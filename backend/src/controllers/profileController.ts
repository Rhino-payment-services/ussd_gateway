import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { telecomProviderSchema } from "../adapters/types.js";

const profileBody = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
  callbackUrl: z.string().url(),
  httpMethod: z.enum(["GET", "POST", "PUT", "PATCH"]).optional(),
  headers: z.record(z.string()).optional(),
  authToken: z.string().max(8192).optional().nullable(),
  authScheme: z.enum(["bearer", "header", "none"]).optional(),
  authHeaderName: z.string().max(128).optional(),
  provider: telecomProviderSchema.optional(),
  payloadMapping: z.record(z.string()).optional(),
  responseType: z.enum(["plain", "json"]).optional(),
  responseJsonPath: z.string().max(256).optional().nullable(),
  simulationDelayMs: z.number().min(0).max(120_000).optional(),
  simulationRetries: z.number().min(0).max(10).optional(),
});

function maskProfile<T extends { authToken: string | null }>(p: T) {
  const { authToken, ...rest } = p;
  return { ...rest, hasAuthToken: Boolean(authToken) };
}

export async function listProfiles(req: Request, res: Response) {
  const userId = req.user!.sub;
  const list = await prisma.webhookProfile.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  res.json({ profiles: list.map((p) => maskProfile(p)) });
}

export async function getProfile(req: Request, res: Response) {
  const userId = req.user!.sub;
  const id = z.string().cuid().parse(req.params.id);
  const p = await prisma.webhookProfile.findFirst({ where: { id, userId } });
  if (!p) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ profile: maskProfile(p) });
}

export async function createProfile(req: Request, res: Response) {
  const userId = req.user!.sub;
  const body = profileBody.parse(req.body);
  const p = await prisma.webhookProfile.create({
    data: {
      userId,
      name: body.name,
      slug: body.slug,
      callbackUrl: body.callbackUrl,
      httpMethod: body.httpMethod ?? "POST",
      headers: (body.headers ?? {}) as object,
      authToken: body.authToken ?? null,
      authScheme: body.authScheme ?? "bearer",
      authHeaderName: body.authHeaderName ?? "Authorization",
      provider: body.provider ?? "DIALFORGE",
      payloadMapping: (body.payloadMapping ?? {}) as object,
      responseType: body.responseType ?? "plain",
      responseJsonPath: body.responseJsonPath ?? null,
      simulationDelayMs: body.simulationDelayMs ?? 0,
      simulationRetries: body.simulationRetries ?? 0,
    },
  });
  res.status(201).json({ profile: maskProfile(p) });
}

export async function updateProfile(req: Request, res: Response) {
  const userId = req.user!.sub;
  const id = z.string().cuid().parse(req.params.id);
  const body = profileBody.partial().parse(req.body);
  const count = await prisma.webhookProfile.updateMany({
    where: { id, userId },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.slug !== undefined ? { slug: body.slug } : {}),
      ...(body.callbackUrl !== undefined ? { callbackUrl: body.callbackUrl } : {}),
      ...(body.httpMethod !== undefined ? { httpMethod: body.httpMethod } : {}),
      ...(body.headers !== undefined ? { headers: body.headers as object } : {}),
      ...(body.authToken !== undefined ? { authToken: body.authToken } : {}),
      ...(body.authScheme !== undefined ? { authScheme: body.authScheme } : {}),
      ...(body.authHeaderName !== undefined ? { authHeaderName: body.authHeaderName } : {}),
      ...(body.provider !== undefined ? { provider: body.provider } : {}),
      ...(body.payloadMapping !== undefined ? { payloadMapping: body.payloadMapping as object } : {}),
      ...(body.responseType !== undefined ? { responseType: body.responseType } : {}),
      ...(body.responseJsonPath !== undefined ? { responseJsonPath: body.responseJsonPath } : {}),
      ...(body.simulationDelayMs !== undefined ? { simulationDelayMs: body.simulationDelayMs } : {}),
      ...(body.simulationRetries !== undefined ? { simulationRetries: body.simulationRetries } : {}),
    },
  });
  if (count.count === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const p = await prisma.webhookProfile.findFirst({ where: { id, userId } });
  res.json({ profile: p ? maskProfile(p) : null });
}

export async function deleteProfile(req: Request, res: Response) {
  const userId = req.user!.sub;
  const id = z.string().cuid().parse(req.params.id);
  await prisma.webhookProfile.deleteMany({ where: { id, userId } });
  res.status(204).send();
}
