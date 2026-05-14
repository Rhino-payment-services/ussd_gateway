import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { redisPing } from "../redis/redisManager.js";
import {
  getOverviewStats,
  getTimeSeries,
  getRpmSeriesLastHour,
  getLatencyTrend,
  getDailyVolume,
  getProviderBreakdown,
  getSuccessVsFailed,
  getErrorRateTrend,
  getWebhookPerformance,
  getInsights,
  listSessionAggregates,
  listSessionAggregatesCsv,
  resolveRange,
  type MetricsPreset,
  type SessionSort,
} from "../services/metricsService.js";

const presetSchema = z.enum(["today", "24h", "7d", "30d", "custom"]);
const sortSchema = z.enum(["createdAt", "duration", "avgLatency", "retries"]);
const statusSchema = z.enum(["all", "active", "completed", "failed"]);

const bundleQuery = z.object({
  preset: presetSchema.default("7d"),
  from: z.string().optional(),
  to: z.string().optional(),
  provider: z.string().optional(),
});

const sessionsQuery = z.object({
  preset: presetSchema.default("7d"),
  from: z.string().optional(),
  to: z.string().optional(),
  provider: z.string().optional(),
  status: statusSchema.default("all"),
  page: z.coerce.number().min(0).default(0),
  take: z.coerce.number().min(1).max(100).default(25),
  search: z.string().optional(),
  sort: sortSchema.default("createdAt"),
  dir: z.enum(["asc", "desc"]).default("desc"),
});

const exportQuery = sessionsQuery.omit({ page: true, take: true }).extend({
  format: z.enum(["csv"]).default("csv"),
});

export async function getMetricsBundle(req: Request, res: Response) {
  const q = bundleQuery.parse(req.query);
  const userId = req.user!.sub;
  const { from, to } =
    q.preset === "custom" && q.from && q.to
      ? { from: new Date(q.from), to: new Date(q.to) }
      : resolveRange(q.preset as MetricsPreset, q.from, q.to);
  const provider = q.provider?.trim() || undefined;

  const [
    overview,
    sessionActivity,
    rpmLive,
    latencyTrend,
    dailyVolume,
    providers,
    successVsFail,
    errorRateTrend,
    webhookPerf,
    insights,
  ] = await Promise.all([
    getOverviewStats(userId, from, to, provider),
    getTimeSeries(userId, from, to, provider),
    getRpmSeriesLastHour(userId, provider),
    getLatencyTrend(userId, from, to, provider),
    getDailyVolume(userId, from, to, provider),
    getProviderBreakdown(userId, from, to),
    getSuccessVsFailed(userId, from, to, provider),
    getErrorRateTrend(userId, from, to, provider),
    getWebhookPerformance(userId, from, to),
    getInsights(userId, from, to),
  ]);

  res.json({
    range: { from: from.toISOString(), to: to.toISOString(), preset: q.preset },
    overview,
    charts: {
      sessionActivity,
      rpmLive,
      latencyTrend,
      dailyVolume,
      providers,
      successVsFail,
      errorRateTrend,
      webhookPerf,
    },
    insights,
  });
}

export async function getMetricsSessions(req: Request, res: Response) {
  const q = sessionsQuery.parse(req.query);
  const userId = req.user!.sub;
  const { from, to } =
    q.preset === "custom" && q.from && q.to
      ? { from: new Date(q.from), to: new Date(q.to) }
      : resolveRange(q.preset as MetricsPreset, q.from, q.to);
  const provider = q.provider?.trim() || undefined;

  const { rows, total } = await listSessionAggregates(userId, from, to, {
    page: q.page,
    take: q.take,
    search: q.search,
    provider,
    status: q.status,
    sort: q.sort as SessionSort,
    dir: q.dir,
  });

  res.json({
    items: rows.map((r) => ({
      sessionId: r.sessionId,
      provider: r.provider,
      phoneNumber: r.phoneNumber,
      durationSec: r.durationSec,
      status: r.status,
      avgLatencyMs: r.avgLatencyMs != null ? Math.round(r.avgLatencyMs) : null,
      responseTimeMs: r.lastLatencyMs != null ? Math.round(r.lastLatencyMs) : null,
      retries: r.retries,
      createdAt: r.createdAt.toISOString(),
      lastAt: r.lastAt.toISOString(),
    })),
    page: q.page,
    take: q.take,
    total,
  });
}

export async function exportMetricsCsv(req: Request, res: Response) {
  const q = exportQuery.parse(req.query);
  const userId = req.user!.sub;
  const { from, to } =
    q.preset === "custom" && q.from && q.to
      ? { from: new Date(q.from), to: new Date(q.to) }
      : resolveRange(q.preset as MetricsPreset, q.from, q.to);
  const provider = q.provider?.trim() || undefined;

  const rows = await listSessionAggregatesCsv(userId, from, to, {
    search: q.search,
    provider,
    status: q.status,
  });

  const header = [
    "sessionId",
    "provider",
    "phoneNumber",
    "durationSec",
    "status",
    "avgLatencyMs",
    "lastLatencyMs",
    "retries",
    "createdAt",
    "lastAt",
  ].join(",");

  const lines = rows.map((r) =>
    [
      r.sessionId,
      r.provider,
      r.phoneNumber,
      r.durationSec ?? "",
      r.status,
      r.avgLatencyMs != null ? Math.round(r.avgLatencyMs) : "",
      r.lastLatencyMs != null ? Math.round(r.lastLatencyMs) : "",
      r.retries,
      r.createdAt.toISOString(),
      r.lastAt.toISOString(),
    ]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(","),
  );

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="ussd-sessions-${Date.now()}.csv"`);
  res.send([header, ...lines].join("\n"));
}

export async function getMetricsHealth(req: Request, res: Response) {
  const userId = req.user!.sub;
  const redis = await redisPing();
  let postgres = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    postgres = true;
  } catch {
    postgres = false;
  }

  const since = new Date(Date.now() - 60_000);
  const recentLogs = await prisma.ussdRequestLog.count({
    where: { userId, createdAt: { gte: since } },
  });

  res.json({
    ok: redis && postgres,
    redis,
    postgres,
    liveRequestsLastMinute: recentLogs,
    at: new Date().toISOString(),
  });
}
