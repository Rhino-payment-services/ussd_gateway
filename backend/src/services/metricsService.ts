import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";

export type MetricsPreset = "today" | "24h" | "7d" | "30d" | "custom";

export function resolveRange(
  preset: MetricsPreset,
  customFrom?: string | null,
  customTo?: string | null,
): { from: Date; to: Date } {
  const to = new Date();
  let from = new Date(to);

  if (preset === "custom" && customFrom && customTo) {
    return { from: new Date(customFrom), to: new Date(customTo) };
  }

  switch (preset) {
    case "today":
      from.setHours(0, 0, 0, 0);
      break;
    case "24h":
      from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "7d":
      from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  return { from, to };
}

function prevWindow(from: Date, to: Date): { prevFrom: Date; prevTo: Date } {
  const span = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime());
  const prevFrom = new Date(from.getTime() - span);
  return { prevFrom, prevTo };
}

async function countDistinctSessions(
  userId: string,
  from: Date,
  to: Date,
  provider?: string,
): Promise<number> {
  const rows = await prisma.$queryRaw<{ c: bigint }[]>`
    SELECT COUNT(DISTINCT "sessionId")::bigint AS c
    FROM "UssdRequestLog"
    WHERE "userId" = ${userId}
      AND "createdAt" >= ${from}
      AND "createdAt" <= ${to}
      ${provider ? Prisma.sql`AND "provider" = ${provider}` : Prisma.empty}
  `;
  return Number(rows[0]?.c ?? 0);
}

async function countRequests(
  userId: string,
  from: Date,
  to: Date,
  provider?: string,
): Promise<number> {
  return prisma.ussdRequestLog.count({
    where: {
      userId,
      createdAt: { gte: from, lte: to },
      ...(provider ? { provider } : {}),
    },
  });
}

export async function getOverviewStats(
  userId: string,
  from: Date,
  to: Date,
  provider?: string,
) {
  const { prevFrom, prevTo } = prevWindow(from, to);
  const provClause = provider ? Prisma.sql`AND "provider" = ${provider}` : Prisma.empty;

  const [
    totalRequests,
    successCount,
    failCount,
    distinctSessions,
    avgLatencyRow,
    p95Row,
    avgSessionDurRow,
    activeSessionsRow,
    completedSessionsRow,
    failedSessionsRow,
    retriesRow,
    timeoutsCount,
    prevRequests,
    prevSuccess,
    prevDistinct,
    peakConcurrentRow,
    rpmRow,
  ] = await Promise.all([
    countRequests(userId, from, to, provider),
    prisma.ussdRequestLog.count({
      where: { userId, createdAt: { gte: from, lte: to }, success: true, ...(provider ? { provider } : {}) },
    }),
    prisma.ussdRequestLog.count({
      where: { userId, createdAt: { gte: from, lte: to }, success: false, ...(provider ? { provider } : {}) },
    }),
    countDistinctSessions(userId, from, to, provider),
    prisma.$queryRaw<{ avg: number | null }[]>`
      SELECT AVG("latencyMs")::float AS avg
      FROM "UssdRequestLog"
      WHERE "userId" = ${userId} AND "createdAt" >= ${from} AND "createdAt" <= ${to}
        AND "latencyMs" IS NOT NULL ${provClause}
    `,
    prisma.$queryRaw<{ p95: number | null }[]>`
      SELECT PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "latencyMs")::float AS p95
      FROM "UssdRequestLog"
      WHERE "userId" = ${userId} AND "createdAt" >= ${from} AND "createdAt" <= ${to}
        AND "latencyMs" IS NOT NULL ${provClause}
    `,
    prisma.$queryRaw<{ avg: number | null }[]>`
      SELECT AVG(sess_dur)::float AS avg FROM (
        SELECT EXTRACT(EPOCH FROM (MAX("createdAt") - MIN("createdAt"))) AS sess_dur
        FROM "UssdRequestLog"
        WHERE "userId" = ${userId} AND "createdAt" >= ${from} AND "createdAt" <= ${to}
          ${provClause}
        GROUP BY "sessionId"
      ) s
    `,
    prisma.$queryRaw<{ c: bigint }[]>`
      WITH last AS (
        SELECT DISTINCT ON ("sessionId") "sessionId", response, success, "createdAt"
        FROM "UssdRequestLog"
        WHERE "userId" = ${userId} AND "createdAt" >= ${from} AND "createdAt" <= ${to}
          ${provClause}
        ORDER BY "sessionId", "createdAt" DESC
      )
      SELECT COUNT(*)::bigint AS c FROM last
      WHERE success = true
        AND trim(upper(response)) LIKE 'CON%'
        AND "createdAt" >= ${new Date(Date.now() - 10 * 60 * 1000)}
    `,
    prisma.$queryRaw<{ c: bigint }[]>`
      WITH last AS (
        SELECT DISTINCT ON ("sessionId") "sessionId", response, success
        FROM "UssdRequestLog"
        WHERE "userId" = ${userId} AND "createdAt" >= ${from} AND "createdAt" <= ${to}
          ${provClause}
        ORDER BY "sessionId", "createdAt" DESC
      )
      SELECT COUNT(*)::bigint AS c FROM last
      WHERE success = true AND trim(upper(response)) LIKE 'END%'
    `,
    prisma.$queryRaw<{ c: bigint }[]>`
      WITH last AS (
        SELECT DISTINCT ON ("sessionId") "sessionId", success
        FROM "UssdRequestLog"
        WHERE "userId" = ${userId} AND "createdAt" >= ${from} AND "createdAt" <= ${to}
          ${provClause}
        ORDER BY "sessionId", "createdAt" DESC
      )
      SELECT COUNT(*)::bigint AS c FROM last WHERE success = false
    `,
    prisma.$queryRaw<{ s: bigint }[]>`
      SELECT COALESCE(SUM(GREATEST(COALESCE("attempts", 1) - 1, 0)), 0)::bigint AS s
      FROM "UssdRequestLog"
      WHERE "userId" = ${userId} AND "createdAt" >= ${from} AND "createdAt" <= ${to}
        ${provClause}
    `,
    prisma.ussdRequestLog.count({
      where: {
        userId,
        createdAt: { gte: from, lte: to },
        ...(provider ? { provider } : {}),
        errorMessage: { contains: "timeout", mode: "insensitive" },
      },
    }),
    countRequests(userId, prevFrom, prevTo, provider),
    prisma.ussdRequestLog.count({
      where: { userId, createdAt: { gte: prevFrom, lte: prevTo }, success: true, ...(provider ? { provider } : {}) },
    }),
    countDistinctSessions(userId, prevFrom, prevTo, provider),
    prisma.$queryRaw<{ m: number | null }[]>`
      WITH buckets AS (
        SELECT date_trunc('minute', "createdAt") AS b, COUNT(DISTINCT "sessionId")::int AS c
        FROM "UssdRequestLog"
        WHERE "userId" = ${userId} AND "createdAt" >= ${from} AND "createdAt" <= ${to}
          ${provClause}
        GROUP BY 1
      )
      SELECT MAX(c)::float AS m FROM buckets
    `,
    prisma.$queryRaw<{ rpm: number | null }[]>`
      SELECT (COUNT(*)::float / NULLIF(GREATEST(EXTRACT(EPOCH FROM (${to}::timestamptz - ${from}::timestamptz)) / 60.0, 1), 0)) AS rpm
      FROM "UssdRequestLog"
      WHERE "userId" = ${userId} AND "createdAt" >= ${from} AND "createdAt" <= ${to}
        ${provClause}
    `,
  ]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const simulationsToday = await prisma.ussdRequestLog.count({
    where: { userId, createdAt: { gte: todayStart }, ...(provider ? { provider } : {}) },
  });

  const avgResponseMs = avgLatencyRow[0]?.avg ?? 0;
  const p95ResponseMs = p95Row[0]?.p95 ?? 0;
  const avgSessionDurationSec = avgSessionDurRow[0]?.avg ?? 0;
  const activeSessions = Number(activeSessionsRow[0]?.c ?? 0);
  const completedSessions = Number(completedSessionsRow[0]?.c ?? 0);
  const failedSessionsAgg = Number(failedSessionsRow[0]?.c ?? 0);
  const totalRetries = Number(retriesRow[0]?.s ?? 0);
  const successRate = totalRequests > 0 ? (successCount / totalRequests) * 100 : 0;
  const peakConcurrentUsers = Math.round(peakConcurrentRow[0]?.m ?? 0);
  const requestsPerMinute = rpmRow[0]?.rpm ?? 0;

  const pct = (cur: number, prev: number) => {
    if (prev === 0) return cur > 0 ? 100 : 0;
    return ((cur - prev) / prev) * 100;
  };

  return {
    totalSessions: distinctSessions,
    totalRequests,
    activeSessions,
    completedSessions,
    failedSessions: failCount,
    failedSessionsLatest: failedSessionsAgg,
    successRate,
    avgResponseMs,
    p95ResponseMs,
    avgSessionDurationSec,
    peakConcurrentUsers,
    requestsPerMinute,
    totalRetries,
    timeouts: timeoutsCount,
    webhookFailures: failCount,
    simulationsToday,
    trends: {
      totalRequests: pct(totalRequests, prevRequests),
      successRate: pct(successCount, prevSuccess),
      sessions: pct(distinctSessions, prevDistinct),
    },
  };
}

export async function getTimeSeries(
  userId: string,
  from: Date,
  to: Date,
  provider?: string,
): Promise<{ t: string; requests: number; sessions: number }[]> {
  const spanH = (to.getTime() - from.getTime()) / (1000 * 60 * 60);
  const trunc = spanH > 72 ? "day" : "hour";
  const provClause = provider ? Prisma.sql`AND "provider" = ${provider}` : Prisma.empty;

  const rows = await prisma.$queryRaw<{ b: Date; requests: bigint; sessions: bigint }[]>`
    SELECT date_trunc(${trunc}, "createdAt") AS b,
           COUNT(*)::bigint AS requests,
           COUNT(DISTINCT "sessionId")::bigint AS sessions
    FROM "UssdRequestLog"
    WHERE "userId" = ${userId} AND "createdAt" >= ${from} AND "createdAt" <= ${to}
      ${provClause}
    GROUP BY 1
    ORDER BY 1 ASC
  `;
  return rows.map((r) => ({
    t: r.b.toISOString(),
    requests: Number(r.requests),
    sessions: Number(r.sessions),
  }));
}

export async function getRpmSeriesLastHour(userId: string, provider?: string) {
  const to = new Date();
  const from = new Date(to.getTime() - 60 * 60 * 1000);
  const provClause = provider ? Prisma.sql`AND "provider" = ${provider}` : Prisma.empty;
  const rows = await prisma.$queryRaw<{ b: Date; c: bigint }[]>`
    SELECT date_trunc('minute', "createdAt") AS b, COUNT(*)::bigint AS c
    FROM "UssdRequestLog"
    WHERE "userId" = ${userId} AND "createdAt" >= ${from} AND "createdAt" <= ${to}
      ${provClause}
    GROUP BY 1
    ORDER BY 1 ASC
  `;
  return rows.map((r) => ({ minute: r.b.toISOString(), count: Number(r.c) }));
}

export async function getLatencyTrend(
  userId: string,
  from: Date,
  to: Date,
  provider?: string,
): Promise<{ t: string; avgMs: number }[]> {
  const spanH = (to.getTime() - from.getTime()) / (1000 * 60 * 60);
  const trunc = spanH > 72 ? "day" : "hour";
  const provClause = provider ? Prisma.sql`AND "provider" = ${provider}` : Prisma.empty;
  const rows = await prisma.$queryRaw<{ b: Date; avg: number | null }[]>`
    SELECT date_trunc(${trunc}, "createdAt") AS b,
           AVG("latencyMs")::float AS avg
    FROM "UssdRequestLog"
    WHERE "userId" = ${userId} AND "createdAt" >= ${from} AND "createdAt" <= ${to}
      AND "latencyMs" IS NOT NULL ${provClause}
    GROUP BY 1
    ORDER BY 1 ASC
  `;
  return rows.map((r) => ({ t: r.b.toISOString(), avgMs: r.avg ?? 0 }));
}

export async function getDailyVolume(userId: string, from: Date, to: Date, provider?: string) {
  const provClause = provider ? Prisma.sql`AND "provider" = ${provider}` : Prisma.empty;
  const rows = await prisma.$queryRaw<{ d: Date; c: bigint }[]>`
    SELECT date_trunc('day', "createdAt") AS d, COUNT(*)::bigint AS c
    FROM "UssdRequestLog"
    WHERE "userId" = ${userId} AND "createdAt" >= ${from} AND "createdAt" <= ${to}
      ${provClause}
    GROUP BY 1
    ORDER BY 1 ASC
  `;
  return rows.map((r) => ({ day: r.d.toISOString().slice(0, 10), count: Number(r.c) }));
}

export async function getProviderBreakdown(userId: string, from: Date, to: Date) {
  const rows = await prisma.ussdRequestLog.groupBy({
    by: ["provider"],
    where: { userId, createdAt: { gte: from, lte: to } },
    _count: { _all: true },
  });
  return rows.map((r) => ({ provider: r.provider, count: r._count._all }));
}

export async function getSuccessVsFailed(userId: string, from: Date, to: Date, provider?: string) {
  const rows = await prisma.ussdRequestLog.groupBy({
    by: ["success"],
    where: { userId, createdAt: { gte: from, lte: to }, ...(provider ? { provider } : {}) },
    _count: { _all: true },
  });
  const ok = rows.find((r) => r.success)?._count._all ?? 0;
  const bad = rows.find((r) => !r.success)?._count._all ?? 0;
  return [
    { name: "Success", value: ok },
    { name: "Failed", value: bad },
  ];
}

export async function getErrorRateTrend(
  userId: string,
  from: Date,
  to: Date,
  provider?: string,
): Promise<{ t: string; rate: number }[]> {
  const spanH = (to.getTime() - from.getTime()) / (1000 * 60 * 60);
  const trunc = spanH > 72 ? "day" : "hour";
  const provClause = provider ? Prisma.sql`AND "provider" = ${provider}` : Prisma.empty;
  const rows = await prisma.$queryRaw<{ b: Date; fail: bigint; tot: bigint }[]>`
    SELECT date_trunc(${trunc}, "createdAt") AS b,
           SUM(CASE WHEN success THEN 0 ELSE 1 END)::bigint AS fail,
           COUNT(*)::bigint AS tot
    FROM "UssdRequestLog"
    WHERE "userId" = ${userId} AND "createdAt" >= ${from} AND "createdAt" <= ${to}
      ${provClause}
    GROUP BY 1
    ORDER BY 1 ASC
  `;
  return rows.map((r) => ({
    t: r.b.toISOString(),
    rate: Number(r.tot) > 0 ? (Number(r.fail) / Number(r.tot)) * 100 : 0,
  }));
}

export async function getWebhookPerformance(userId: string, from: Date, to: Date) {
  const rows = await prisma.$queryRaw<{ url: string; avg: number; n: bigint; fails: bigint }[]>`
    SELECT COALESCE("callbackUrl", '') AS url,
           AVG("latencyMs")::float AS avg,
           COUNT(*)::bigint AS n,
           SUM(CASE WHEN success THEN 0 ELSE 1 END)::bigint AS fails
    FROM "UssdRequestLog"
    WHERE "userId" = ${userId} AND "createdAt" >= ${from} AND "createdAt" <= ${to}
      AND "callbackUrl" IS NOT NULL AND "callbackUrl" != ''
    GROUP BY "callbackUrl"
    ORDER BY avg DESC NULLS LAST
    LIMIT 12
  `;
  return rows.map((r) => ({
    callbackUrl: r.url.length > 48 ? `${r.url.slice(0, 45)}…` : r.url,
    avgLatencyMs: r.avg ?? 0,
    requests: Number(r.n),
    failures: Number(r.fails),
  }));
}

export async function getInsights(userId: string, from: Date, to: Date) {
  const [peakHour, topProv, slowest, failures, completion] = await Promise.all([
    prisma.$queryRaw<{ h: number; c: bigint }[]>`
      SELECT EXTRACT(HOUR FROM "createdAt")::int AS h, COUNT(*)::bigint AS c
      FROM "UssdRequestLog"
      WHERE "userId" = ${userId} AND "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY 1
      ORDER BY c DESC
      LIMIT 1
    `,
    prisma.$queryRaw<{ provider: string; c: bigint }[]>`
      SELECT "provider", COUNT(*)::bigint AS c
      FROM "UssdRequestLog"
      WHERE "userId" = ${userId} AND "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY "provider"
      ORDER BY c DESC
      LIMIT 1
    `,
    prisma.$queryRaw<{ url: string; avg: number }[]>`
      SELECT "callbackUrl" AS url, AVG("latencyMs")::float AS avg
      FROM "UssdRequestLog"
      WHERE "userId" = ${userId} AND "createdAt" >= ${from} AND "createdAt" <= ${to}
        AND "callbackUrl" IS NOT NULL AND "latencyMs" IS NOT NULL
      GROUP BY "callbackUrl"
      ORDER BY avg DESC NULLS LAST
      LIMIT 1
    `,
    prisma.$queryRaw<{ msg: string; c: bigint }[]>`
      SELECT COALESCE("errorMessage", 'Unknown') AS msg, COUNT(*)::bigint AS c
      FROM "UssdRequestLog"
      WHERE "userId" = ${userId} AND "createdAt" >= ${from} AND "createdAt" <= ${to}
        AND success = false AND "errorMessage" IS NOT NULL
      GROUP BY "errorMessage"
      ORDER BY c DESC
      LIMIT 5
    `,
    prisma.$queryRaw<{ done: bigint; total: bigint }[]>`
      WITH last AS (
        SELECT DISTINCT ON ("sessionId") "sessionId", response, success
        FROM "UssdRequestLog"
        WHERE "userId" = ${userId} AND "createdAt" >= ${from} AND "createdAt" <= ${to}
        ORDER BY "sessionId", "createdAt" DESC
      )
      SELECT
        SUM(CASE WHEN success AND trim(upper(response)) LIKE 'END%' THEN 1 ELSE 0 END)::bigint AS done,
        COUNT(*)::bigint AS total
      FROM last
    `,
  ]);

  const done = Number(completion[0]?.done ?? 0);
  const total = Number(completion[0]?.total ?? 0);

  return {
    peakTrafficHour: peakHour[0] != null ? { hour: peakHour[0]!.h, requests: Number(peakHour[0]!.c) } : null,
    mostUsedProvider: topProv[0] ? { provider: topProv[0]!.provider, count: Number(topProv[0]!.c) } : null,
    slowestWebhook: slowest[0]?.url
      ? { url: slowest[0].url.length > 60 ? `${slowest[0].url.slice(0, 57)}…` : slowest[0].url, avgMs: slowest[0].avg }
      : null,
    topFailureReasons: failures.map((f) => ({ message: f.msg, count: Number(f.c) })),
    completionRatePct: total > 0 ? (done / total) * 100 : 0,
  };
}

export type SessionSort = "createdAt" | "duration" | "avgLatency" | "retries";

export async function listSessionAggregates(
  userId: string,
  from: Date,
  to: Date,
  opts: {
    page: number;
    take: number;
    search?: string;
    provider?: string;
    status?: "all" | "active" | "completed" | "failed";
    sort: SessionSort;
    dir: "asc" | "desc";
  },
) {
  const skip = opts.page * opts.take;
  const search = opts.search?.trim() || "";
  const searchClause =
    search.length > 0
      ? Prisma.sql`AND (
          f."phoneNumber" ILIKE ${"%" + search + "%"}
          OR l."sessionId" ILIKE ${"%" + search + "%"}
        )`
      : Prisma.empty;
  const provClause = opts.provider ? Prisma.sql`AND l.last_prov = ${opts.provider}` : Prisma.empty;

  const statusCase = Prisma.sql`
    CASE
      WHEN NOT l.success THEN 'failed'
      WHEN trim(upper(l.response)) LIKE 'END%' THEN 'completed'
      ELSE 'active'
    END
  `;

  const statusFilter =
    opts.status && opts.status !== "all"
      ? Prisma.sql`AND (${statusCase}) = ${opts.status}`
      : Prisma.empty;

  const orderSql =
    opts.sort === "duration"
      ? Prisma.raw(`cnt.dur_sec ${opts.dir.toUpperCase()} NULLS LAST`)
      : opts.sort === "avgLatency"
        ? Prisma.raw(`cnt.avg_lat ${opts.dir.toUpperCase()} NULLS LAST`)
        : opts.sort === "retries"
          ? Prisma.raw(`cnt.retries ${opts.dir.toUpperCase()} NULLS LAST`)
          : Prisma.raw(`l.last_at ${opts.dir.toUpperCase()} NULLS LAST`);

  const rows = await prisma.$queryRaw<
    {
      sessionId: string;
      provider: string;
      phoneNumber: string;
      durationSec: number | null;
      status: string;
      avgLatencyMs: number | null;
      lastLatencyMs: number | null;
      retries: number;
      createdAt: Date;
      lastAt: Date;
    }[]
  >`
    WITH first AS (
      SELECT DISTINCT ON ("sessionId") "sessionId", "phoneNumber", "createdAt" AS first_at
      FROM "UssdRequestLog"
      WHERE "userId" = ${userId} AND "createdAt" >= ${from} AND "createdAt" <= ${to}
      ORDER BY "sessionId", "createdAt" ASC
    ),
    last AS (
      SELECT DISTINCT ON ("sessionId") "sessionId", response, success, "latencyMs", provider AS last_prov, "createdAt" AS last_at
      FROM "UssdRequestLog"
      WHERE "userId" = ${userId} AND "createdAt" >= ${from} AND "createdAt" <= ${to}
      ORDER BY "sessionId", "createdAt" DESC
    ),
    cnt AS (
      SELECT "sessionId",
             EXTRACT(EPOCH FROM (MAX("createdAt") - MIN("createdAt")))::int AS dur_sec,
             AVG("latencyMs")::float AS avg_lat,
             SUM(GREATEST(COALESCE("attempts", 1) - 1, 0))::int AS retries
      FROM "UssdRequestLog"
      WHERE "userId" = ${userId} AND "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY "sessionId"
    )
    SELECT
      l."sessionId" AS "sessionId",
      l.last_prov AS provider,
      f."phoneNumber" AS "phoneNumber",
      cnt.dur_sec AS "durationSec",
      (${statusCase}) AS status,
      cnt.avg_lat AS "avgLatencyMs",
      l."latencyMs" AS "lastLatencyMs",
      cnt.retries AS retries,
      f.first_at AS "createdAt",
      l.last_at AS "lastAt"
    FROM last l
    JOIN first f ON f."sessionId" = l."sessionId"
    JOIN cnt ON cnt."sessionId" = l."sessionId"
    WHERE 1=1 ${searchClause} ${provClause} ${statusFilter}
    ORDER BY ${orderSql}
    LIMIT ${opts.take} OFFSET ${skip}
  `;

  const countRows = await prisma.$queryRaw<{ c: bigint }[]>`
    WITH first AS (
      SELECT DISTINCT ON ("sessionId") "sessionId", "phoneNumber"
      FROM "UssdRequestLog"
      WHERE "userId" = ${userId} AND "createdAt" >= ${from} AND "createdAt" <= ${to}
      ORDER BY "sessionId", "createdAt" ASC
    ),
    last AS (
      SELECT DISTINCT ON ("sessionId") "sessionId", response, success, provider AS last_prov
      FROM "UssdRequestLog"
      WHERE "userId" = ${userId} AND "createdAt" >= ${from} AND "createdAt" <= ${to}
      ORDER BY "sessionId", "createdAt" DESC
    ),
    cnt AS (
      SELECT "sessionId" FROM "UssdRequestLog"
      WHERE "userId" = ${userId} AND "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY "sessionId"
    )
    SELECT COUNT(*)::bigint AS c
    FROM last l
    JOIN first f ON f."sessionId" = l."sessionId"
    JOIN cnt ON cnt."sessionId" = l."sessionId"
    WHERE 1=1 ${searchClause} ${provClause} ${statusFilter}
  `;

  return { rows, total: Number(countRows[0]?.c ?? 0) };
}

export async function listSessionAggregatesCsv(
  userId: string,
  from: Date,
  to: Date,
  opts: { search?: string; provider?: string; status?: "all" | "active" | "completed" | "failed" },
) {
  const { rows } = await listSessionAggregates(userId, from, to, {
    page: 0,
    take: 50_000,
    search: opts.search,
    provider: opts.provider,
    status: opts.status ?? "all",
    sort: "createdAt",
    dir: "desc",
  });
  return rows;
}
