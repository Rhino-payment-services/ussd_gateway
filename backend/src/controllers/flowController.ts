import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { parseFlowJson, runEngine, STARTER_FLOW } from "../engine/ussdEngine.js";

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

const runBody = z.object({
  sessionId: z.string().min(1).max(256).optional(),
  text: z.string().max(182).optional().default(""),
  flowId: z.string().min(1).optional(),
  flowJson: z.unknown().optional(),
});

export async function listFlows(req: Request, res: Response) {
  const userId = req.user!.sub;
  const flows = await prisma.savedFlow.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });
  res.json({ flows });
}

export async function getFlow(req: Request, res: Response) {
  const userId = req.user!.sub;
  const id = z.string().min(1).parse(req.params.id);
  const flow = await prisma.savedFlow.findFirst({ where: { id, userId } });
  if (!flow) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ flow });
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

/** Run a saved or inline flow through the local USSD engine (no external callback). */
export async function runFlow(req: Request, res: Response) {
  const userId = req.user?.sub ?? null;
  const body = runBody.parse(req.body);

  let flowJson: unknown = body.flowJson;
  if (body.flowId) {
    if (!userId) {
      res.status(401).json({ error: "Authentication required to run a saved flow" });
      return;
    }
    const saved = await prisma.savedFlow.findFirst({ where: { id: body.flowId, userId } });
    if (!saved) {
      res.status(404).json({ error: "Flow not found" });
      return;
    }
    flowJson = saved.flowJson;
  }
  if (flowJson == null) {
    res.status(400).json({ error: "Provide flowId or flowJson" });
    return;
  }

  const flow = parseFlowJson(flowJson);
  const sessionId = body.sessionId ?? randomUUID();
  const result = runEngine(
    flow,
    {
      sessionId,
      phoneNumber: "0000000000",
      serviceCode: "*000#",
      currentStep: flow.rootId,
      previousInputs: [],
      menuHistory: [],
      startedAt: new Date().toISOString(),
      userId,
    },
    body.text ?? "",
  );

  res.json({
    response: result.response,
    ended: result.ended,
    currentStep: result.currentStep,
    sessionId,
    source: "local-flow" as const,
  });
}
