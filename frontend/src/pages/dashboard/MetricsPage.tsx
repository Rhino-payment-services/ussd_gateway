import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { io } from "socket.io-client";
import { api } from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { useMetricsFilters } from "../../store/metricsFiltersStore";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { cn } from "../../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Skeleton } from "../../components/ui/skeleton";
import type { ChartsBundle } from "./metrics/MetricsCharts";

const MetricsCharts = lazy(() => import("./metrics/MetricsCharts"));

type Overview = {
  totalSessions: number;
  totalRequests: number;
  activeSessions: number;
  completedSessions: number;
  failedSessions: number;
  successRate: number;
  avgResponseMs: number;
  p95ResponseMs: number;
  avgSessionDurationSec: number;
  peakConcurrentUsers: number;
  requestsPerMinute: number;
  totalRetries: number;
  timeouts: number;
  webhookFailures: number;
  simulationsToday: number;
  trends: { totalRequests: number; successRate: number; sessions: number };
};

type Insights = {
  peakTrafficHour: { hour: number; requests: number } | null;
  mostUsedProvider: { provider: string; count: number } | null;
  slowestWebhook: { url: string; avgMs: number } | null;
  topFailureReasons: { message: string; count: number }[];
  completionRatePct: number;
};

type BundleRes = {
  range: { from: string; to: string; preset: string };
  overview: Overview;
  charts: ChartsBundle;
  insights: Insights;
};

type SessionRow = {
  sessionId: string;
  provider: string;
  phoneNumber: string;
  durationSec: number | null;
  status: string;
  avgLatencyMs: number | null;
  responseTimeMs: number | null;
  retries: number;
  createdAt: string;
  lastAt: string;
};

type ActivityItem = { id: string; ts: string; title: string; detail: string; tone: "ok" | "warn" | "err" };

function Trend({ v }: { v: number }) {
  const up = v >= 0;
  return (
    <span className={cn("text-xs font-medium tabular-nums", up ? "text-emerald-400" : "text-orange-400")}>
      {up ? "▲" : "▼"} {Math.abs(v).toFixed(1)}%
    </span>
  );
}

function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const t = decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));
  return (
    <span key={t} className="tabular-nums motion-safe:animate-[pulse_0.4s_ease-out_1]">
      {t}
    </span>
  );
}

function StatCard({
  title,
  value,
  sub,
  trend,
  gradient,
  icon,
}: {
  title: string;
  value: ReactNode;
  sub?: string;
  trend?: number;
  gradient: string;
  icon: ReactNode;
}) {
  return (
    <Card
      className={cn(
        "group overflow-hidden border-border/80 bg-gradient-to-br shadow-lg transition-transform hover:-translate-y-0.5",
        gradient,
      )}
    >
      <CardContent className="relative p-5">
        <div className="absolute right-3 top-3 opacity-25 transition-opacity group-hover:opacity-40">{icon}</div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {sub && <span className="text-xs text-muted">{sub}</span>}
          {trend !== undefined && <Trend v={trend} />}
        </div>
      </CardContent>
    </Card>
  );
}

const socketBase = () => import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? window.location.origin : "");

export function MetricsPage() {
  const token = useAuthStore((s) => s.token);
  const { preset, customFrom, customTo, provider, tableStatus, setPreset, setCustomFrom, setCustomTo, setProvider, setTableStatus } =
    useMetricsFilters();

  const [bundle, setBundle] = useState<BundleRes | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<{ items: SessionRow[]; total: number } | null>(null);
  const [sessLoading, setSessLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [take] = useState(15);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const [sort, setSort] = useState<"createdAt" | "duration" | "avgLatency" | "retries">("createdAt");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [health, setHealth] = useState<{ redis: boolean; postgres: boolean; liveRequestsLastMinute: number } | null>(
    null,
  );
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);

  const queryParams = useMemo(() => {
    const p: Record<string, string> = { preset };
    if (preset === "custom" && customFrom && customTo) {
      p.from = customFrom;
      p.to = customTo;
    }
    if (provider) p.provider = provider;
    return p;
  }, [preset, customFrom, customTo, provider]);

  const loadBundle = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { data } = await api.get<BundleRes>("/api/metrics/bundle", { params: queryParams });
      setBundle(data);
    } catch {
      setBundle(null);
    } finally {
      setLoading(false);
    }
  }, [token, queryParams]);

  const loadSessions = useCallback(async () => {
    if (!token) return;
    setSessLoading(true);
    try {
      const { data } = await api.get<{ items: SessionRow[]; total: number }>("/api/metrics/sessions", {
        params: {
          ...queryParams,
          page,
          take,
          search: debouncedSearch || undefined,
          status: tableStatus,
          sort,
          dir,
        },
      });
      setSessions(data);
    } catch {
      setSessions(null);
    } finally {
      setSessLoading(false);
    }
  }, [token, queryParams, page, take, debouncedSearch, tableStatus, sort, dir]);

  const loadHealth = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await api.get<{ redis: boolean; postgres: boolean; liveRequestsLastMinute: number }>(
        "/api/metrics/health",
      );
      setHealth(data);
    } catch {
      setHealth(null);
    }
  }, [token]);

  useEffect(() => {
    void loadBundle();
  }, [loadBundle]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    void loadHealth();
    const id = setInterval(() => void loadHealth(), 15000);
    return () => clearInterval(id);
  }, [loadHealth]);

  useEffect(() => {
    const id = setInterval(() => void loadBundle(), 60000);
    return () => clearInterval(id);
  }, [loadBundle]);

  useEffect(() => {
    if (!token) return;
    const s = io(socketBase(), {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      auth: { token },
    });
    socketRef.current = s;
    const scheduleRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        void loadBundle();
        void loadSessions();
        void loadHealth();
      }, 400);
    };
    s.on("metrics:refresh", scheduleRefresh);
    s.on("metrics:activity", (payload: Record<string, unknown>) => {
      const id = crypto.randomUUID();
      const ts = new Date().toISOString();
      let title = "Simulation";
      let detail = "";
      let tone: ActivityItem["tone"] = "ok";
      const t = String(payload.type ?? "");
      if (t === "webhook_ok") {
        title = "Webhook OK";
        detail = `${payload.sessionId} · ${payload.provider}`;
        tone = "ok";
      } else if (t === "webhook_failed") {
        title = "Webhook failed";
        detail = `${payload.sessionId} · ${String(payload.error ?? "")}`;
        tone = "err";
      } else if (t === "request_failed") {
        title = "Request failed";
        detail = String(payload.sessionId ?? "");
        tone = "warn";
      }
      setActivity((prev) => [{ id, ts, title, detail, tone }, ...prev].slice(0, 80));
    });
    return () => {
      s.disconnect();
      socketRef.current = null;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [token, loadBundle, loadSessions, loadHealth]);

  const pushActivity = useCallback((item: Omit<ActivityItem, "id" | "ts">) => {
    setActivity((prev) => [{ id: crypto.randomUUID(), ts: new Date().toISOString(), ...item }, ...prev].slice(0, 80));
  }, []);

  const exportCsv = async () => {
    try {
      const res = await api.get("/api/metrics/export", {
        params: { ...queryParams, search: debouncedSearch || undefined, status: tableStatus, format: "csv" },
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ussd-metrics-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      pushActivity({ title: "Export", detail: "CSV downloaded", tone: "ok" });
    } catch {
      pushActivity({ title: "Export failed", detail: "Could not download CSV", tone: "err" });
    }
  };

  const toggleSort = (col: typeof sort) => {
    if (sort === col) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(col);
      setDir("desc");
    }
  };

  const overview = bundle?.overview;
  const empty = !loading && overview && overview.totalRequests === 0;

  return (
    <div className="metrics-dashboard print:px-4">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Metrics &amp; Analytics</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Live and historical USSD simulations from your stored request logs. Data updates in real time when you run
            simulations while logged in.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" type="button" onClick={() => window.print()}>
            Print report
          </Button>
          <Button variant="secondary" type="button" onClick={() => void exportCsv()}>
            Export CSV
          </Button>
          <Button type="button" onClick={() => void loadBundle()}>
            Refresh
          </Button>
        </div>
      </div>

      <Card className="mb-6 border-border/80 bg-card/60 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-medium text-muted">Range</label>
            <select
              className="mt-1 block rounded-xl border border-border bg-background px-3 py-2 text-sm"
              value={preset}
              onChange={(e) => setPreset(e.target.value as typeof preset)}
            >
              <option value="today">Today</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          {preset === "custom" && (
            <>
              <div>
                <label className="text-xs font-medium text-muted">From</label>
                <input
                  type="datetime-local"
                  className="mt-1 block rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted">To</label>
                <input
                  type="datetime-local"
                  className="mt-1 block rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>
            </>
          )}
          <div>
            <label className="text-xs font-medium text-muted">Provider</label>
            <input
              className="mt-1 block w-44 rounded-xl border border-border bg-background px-3 py-2 text-sm"
              placeholder="All"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {loading && !bundle ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : overview ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total sessions"
            value={<AnimatedNumber value={overview.totalSessions} />}
            trend={overview.trends.sessions}
            gradient="from-emerald-500/15 via-card to-card"
            icon={
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeWidth={1.5} d="M3 7h18M5 7V5a2 2 0 012-2h10a2 2 0 012 2v2M5 7v12a2 2 0 002 2h10a2 2 0 002-2V7" />
              </svg>
            }
          />
          <StatCard
            title="Active sessions"
            value={<AnimatedNumber value={overview.activeSessions} />}
            sub="CON within 10m"
            gradient="from-sky-500/15 via-card to-card"
            icon={
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
          />
          <StatCard
            title="Success rate"
            value={
              <>
                <AnimatedNumber value={overview.successRate} decimals={1} />%
              </>
            }
            trend={overview.trends.successRate}
            gradient="from-violet-500/15 via-card to-card"
            icon={
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            title="Failed requests"
            value={<AnimatedNumber value={overview.failedSessions} />}
            sub="HTTP / parse failures"
            gradient="from-orange-500/15 via-card to-card"
            icon={
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeWidth={1.5} d="M12 9v2m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z" />
              </svg>
            }
          />
          <StatCard
            title="Avg session duration"
            value={
              <>
                <AnimatedNumber value={overview.avgSessionDurationSec} />s
              </>
            }
            gradient="from-teal-500/15 via-card to-card"
            icon={
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            title="Avg response time"
            value={
              <>
                <AnimatedNumber value={overview.avgResponseMs} /> ms
              </>
            }
            sub={`p95 ${Math.round(overview.p95ResponseMs)} ms`}
            trend={overview.trends.totalRequests}
            gradient="from-fuchsia-500/15 via-card to-card"
            icon={
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeWidth={1.5} d="M7 12l3 3 7-7" />
              </svg>
            }
          />
          <StatCard
            title="Peak concurrent"
            value={<AnimatedNumber value={overview.peakConcurrentUsers} />}
            sub="Max distinct sessions / minute"
            gradient="from-amber-500/15 via-card to-card"
            icon={
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          />
          <StatCard
            title="Simulations today"
            value={<AnimatedNumber value={overview.simulationsToday} />}
            sub="Requests since midnight"
            gradient="from-cyan-500/15 via-card to-card"
            icon={
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h10" />
              </svg>
            }
          />
        </div>
      ) : null}

      {empty && (
        <Card className="mb-8 border-dashed border-border bg-card/40 p-10 text-center">
          <p className="text-lg font-medium text-foreground">No metrics yet</p>
          <p className="mt-2 text-sm text-muted">
            Run USSD simulations while signed in (saved profiles) to populate this dashboard. Anonymous simulator traffic
            is not tied to your account.
          </p>
        </Card>
      )}

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_320px]">
        <div>
          <h2 className="mb-4 text-lg font-semibold text-foreground">Charts</h2>
          <Suspense
            fallback={
              <div className="grid gap-4 xl:grid-cols-2">
                <Skeleton className="h-72 rounded-2xl" />
                <Skeleton className="h-72 rounded-2xl" />
              </div>
            }
          >
            {bundle?.charts && <MetricsCharts charts={bundle.charts} />}
          </Suspense>

          <h2 className="mb-4 mt-10 text-lg font-semibold text-foreground">Smart insights</h2>
          {bundle?.insights && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent">
                <CardHeader>
                  <CardTitle>Traffic pattern</CardTitle>
                </CardHeader>
                <CardContent>
                  {bundle.insights.peakTrafficHour ? (
                    <p className="text-sm text-foreground">
                      Peak hour <strong>{bundle.insights.peakTrafficHour.hour}:00</strong> with{" "}
                      <strong>{bundle.insights.peakTrafficHour.requests}</strong> requests.
                    </p>
                  ) : (
                    <p className="text-sm text-muted">Not enough data.</p>
                  )}
                </CardContent>
              </Card>
              <Card className="border-sky-500/20 bg-gradient-to-br from-sky-500/10 to-transparent">
                <CardHeader>
                  <CardTitle>Top provider</CardTitle>
                </CardHeader>
                <CardContent>
                  {bundle.insights.mostUsedProvider ? (
                    <p className="text-sm text-foreground">
                      <Badge className="mr-2">{bundle.insights.mostUsedProvider.provider}</Badge>
                      {bundle.insights.mostUsedProvider.count} requests
                    </p>
                  ) : (
                    <p className="text-sm text-muted">Not enough data.</p>
                  )}
                </CardContent>
              </Card>
              <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-transparent">
                <CardHeader>
                  <CardTitle>Slowest webhook</CardTitle>
                </CardHeader>
                <CardContent>
                  {bundle.insights.slowestWebhook ? (
                    <p className="text-sm text-foreground">
                      <span className="break-all">{bundle.insights.slowestWebhook.url}</span>
                      <br />
                      <span className="text-muted">Avg {Math.round(bundle.insights.slowestWebhook.avgMs)} ms</span>
                    </p>
                  ) : (
                    <p className="text-sm text-muted">Not enough data.</p>
                  )}
                </CardContent>
              </Card>
              <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-transparent">
                <CardHeader>
                  <CardTitle>Completion &amp; failures</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground">
                    Session completion rate (END):{" "}
                    <strong>{bundle.insights.completionRatePct.toFixed(1)}%</strong>
                  </p>
                  {bundle.insights.topFailureReasons.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-muted">
                      {bundle.insights.topFailureReasons.map((f) => (
                        <li key={f.message} className="truncate">
                          {f.message} · {f.count}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <h2 className="mb-4 mt-10 text-lg font-semibold text-foreground">Session analytics</h2>
          <Card>
            <CardContent className="space-y-4 pt-5">
              <div className="flex flex-wrap gap-3">
                <input
                  className="min-w-[200px] flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Search session ID or phone…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                />
                <select
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  value={tableStatus}
                  onChange={(e) => {
                    setTableStatus(e.target.value as typeof tableStatus);
                    setPage(0);
                  }}
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-card/80 text-xs uppercase text-muted">
                    <tr>
                      <th className="px-3 py-2">Session</th>
                      <th className="px-3 py-2">Provider</th>
                      <th className="px-3 py-2">Phone</th>
                      <th className="cursor-pointer px-3 py-2" onClick={() => toggleSort("duration")}>
                        Duration {sort === "duration" ? (dir === "asc" ? "↑" : "↓") : ""}
                      </th>
                      <th className="px-3 py-2">Status</th>
                      <th className="cursor-pointer px-3 py-2" onClick={() => toggleSort("avgLatency")}>
                        Avg ms {sort === "avgLatency" ? (dir === "asc" ? "↑" : "↓") : ""}
                      </th>
                      <th className="px-3 py-2">Last ms</th>
                      <th className="cursor-pointer px-3 py-2" onClick={() => toggleSort("retries")}>
                        Retries {sort === "retries" ? (dir === "asc" ? "↑" : "↓") : ""}
                      </th>
                      <th className="cursor-pointer px-3 py-2" onClick={() => toggleSort("createdAt")}>
                        Started {sort === "createdAt" ? (dir === "asc" ? "↑" : "↓") : ""}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessLoading ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-8 text-center text-muted">
                          Loading…
                        </td>
                      </tr>
                    ) : sessions && sessions.items.length > 0 ? (
                      sessions.items.map((r) => (
                        <tr key={r.sessionId} className="border-t border-border/60 hover:bg-card/50">
                          <td className="max-w-[140px] truncate px-3 py-2 font-mono text-xs">{r.sessionId}</td>
                          <td className="px-3 py-2">{r.provider}</td>
                          <td className="px-3 py-2">{r.phoneNumber}</td>
                          <td className="px-3 py-2">{r.durationSec != null ? `${r.durationSec}s` : "—"}</td>
                          <td className="px-3 py-2">
                            <Badge
                              className={cn(
                                r.status === "failed" && "border-danger/40 text-danger",
                                r.status === "completed" && "border-emerald-500/40 text-emerald-400",
                                r.status === "active" && "border-sky-500/40 text-sky-400",
                              )}
                            >
                              {r.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-2">{r.avgLatencyMs ?? "—"}</td>
                          <td className="px-3 py-2">{r.responseTimeMs ?? "—"}</td>
                          <td className="px-3 py-2">{r.retries}</td>
                          <td className="px-3 py-2 text-xs text-muted">{new Date(r.createdAt).toLocaleString()}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="px-3 py-8 text-center text-muted">
                          No sessions in this range.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {sessions && sessions.total > take && (
                <div className="flex items-center justify-between text-sm text-muted">
                  <span>
                    Page {page + 1} of {Math.ceil(sessions.total / take) || 1}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      type="button"
                      disabled={(page + 1) * take >= sessions.total}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border/80 bg-gradient-to-b from-card to-background">
            <CardHeader>
              <CardTitle>Traffic &amp; health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Redis</span>
                <Badge className={health?.redis ? "border-emerald-500/40 text-emerald-400" : "text-danger"}>
                  {health?.redis ? "OK" : "Down"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">PostgreSQL</span>
                <Badge className={health?.postgres ? "border-emerald-500/40 text-emerald-400" : "text-danger"}>
                  {health?.postgres ? "OK" : "Down"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Your requests / min</span>
                <span className="font-mono text-foreground">{overview?.requestsPerMinute.toFixed(2) ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Retries (range)</span>
                <span className="font-mono text-foreground">{overview?.totalRetries ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Timeouts (range)</span>
                <span className="font-mono text-foreground">{overview?.timeouts ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Live (last minute)</span>
                <span className="font-mono text-foreground">{health?.liveRequestsLastMinute ?? "—"}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Live activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {activity.length === 0 ? (
                  <p className="text-sm text-muted">Waiting for simulation events…</p>
                ) : (
                  activity.map((a) => (
                    <div
                      key={a.id}
                      className={cn(
                        "rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-xs transition",
                        a.tone === "err" && "border-danger/30 bg-danger/5",
                        a.tone === "warn" && "border-orange-500/20 bg-orange-500/5",
                      )}
                    >
                      <div className="font-medium text-foreground">{a.title}</div>
                      <div className="mt-0.5 text-muted">{a.detail}</div>
                      <div className="mt-1 text-[10px] text-muted/80">{new Date(a.ts).toLocaleTimeString()}</div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="mt-10 text-center text-[11px] text-muted">
        PDF export: use <strong>Print report</strong> and choose &quot;Save as PDF&quot; in your browser. Metrics are
        computed from <code className="rounded bg-card px-1">UssdRequestLog</code> for your account.
      </p>
    </div>
  );
}
