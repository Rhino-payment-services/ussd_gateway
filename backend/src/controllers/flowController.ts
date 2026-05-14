import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { STARTER_FLOW } from "../engine/ussdEngine.js";

const flowBody = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
  flowJson: z.unknown(),
  isDefault: z.boolean().optional(),
});

export async function listFlows(req: Request, res: Response) {
  const userId = req.user!.sub;
  const flows = await prisma.savedFlow.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });
  res.json({ flows });
}

export async function getStarter(_req: Request, res: Response) {
  res.json({ flow: STARTER_FLOW });
}

export async function createFlow(req: Request, res: Response) {
  const userId = req.user!.sub;
  const body = flowBody.parse(req.body);
  if (body.isDefault) {
    await prisma.savedFlow.updateMany({ where: { userId }, data: { isDefault: false } });
  }
  const flow = await prisma.savedFlow.create({
    data: {
      userId,
      name: body.name,
      slug: body.slug,
      flowJson: body.flowJson as object,
      isDefault: body.isDefault ?? false,
    },
  });
  res.status(201).json({ flow });
}

export async function updateFlow(req: Request, res: Response) {
  const userId = req.user!.sub;
  const id = z.string().min(1).parse(req.params.id);
  const body = flowBody.partial().parse(req.body);
  if (body.isDefault) {
    await prisma.savedFlow.updateMany({ where: { userId }, data: { isDefault: false } });
  }
  const flow = await prisma.savedFlow.updateMany({
    where: { id, userId },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.slug ? { slug: body.slug } : {}),
      ...(body.flowJson !== undefined ? { flowJson: body.flowJson as object } : {}),
      ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
    },
  });
  if (flow.count === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const updated = await prisma.savedFlow.findFirst({ where: { id, userId } });
  res.json({ flow: updated });
}

export async function deleteFlow(req: Request, res: Response) {
  const userId = req.user!.sub;
  const id = z.string().min(1).parse(req.params.id);
  await prisma.savedFlow.deleteMany({ where: { id, userId } });
  res.status(204).send();
}
