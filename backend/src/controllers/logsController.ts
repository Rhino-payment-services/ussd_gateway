import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";

const querySchema = z.object({
  take: z.coerce.number().min(1).max(200).default(50),
  page: z.coerce.number().min(0).default(0),
  failed: z.enum(["true", "false"]).optional(),
  profileId: z.string().cuid().optional(),
});

export async function listLogs(req: Request, res: Response) {
  const q = querySchema.parse(req.query);
  const userId = req.user!.sub;

  const items = await prisma.ussdRequestLog.findMany({
    where: {
      userId,
      ...(q.failed === "true" ? { success: false } : {}),
      ...(q.profileId ? { profileId: q.profileId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: q.take,
    skip: q.page * q.take,
  });

  res.json({ items, page: q.page, take: q.take });
}
