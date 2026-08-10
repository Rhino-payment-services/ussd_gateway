import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { io } from "socket.io-client";
import { api } from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { useMetricsFilters } from "../../store/metricsFiltersStore";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { cn } from "../../lib/utils";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Skeleton } from "../../components/ui/skeleton";
import { PageHeader } from "../../components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "../../components/ui/panel";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select } from "../../components/ui/native-select";
import { Table, THead, TBody, TR, TH, TD } from "../../components/ui/table";
import { EmptyState } from "../../components/ui/empty-state";
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
}: {
  title: string;
  value: ReactNode;
  sub?: string;
  trend?: number;
}) {
  return (
    <Panel>
      <PanelBody className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums text-foreground">{value}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {sub ? <span className="text-xs text-muted-foreground">{sub}</span> : null}
          {trend !== undefined ? <Trend v={trend} /> : null}
        </div>
      </PanelBody>
    </Panel>
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
  const [tab, setTab] = useState("overview");
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
      <PageHeader
        title="Metrics"
        description="USSD simulation analytics from your request logs."
        actions={
          <>
            <Button variant="outline" size="sm" type="button" onClick={() => window.print()}>
              Print
            </Button>
            <Button variant="secondary" size="sm" type="button" onClick={() => void exportCsv()}>
              Export CSV
            </Button>
            <Button size="sm" type="button" onClick={() => void loadBundle()}>
              Refresh
            </Button>
          </>
        }
      />

      <Panel className="mb-4">
        <PanelBody className="flex flex-wrap items-end gap-3 p-3">
          <div>
            <Label>Range</Label>
            <Select
              value={preset}
              onChange={(e) => setPreset(e.target.value as typeof preset)}
              className="w-40"
            >
              <option value="today">Today</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="custom">Custom</option>
            </Select>
          </div>
          {preset === "custom" ? (
            <>
              <div>
                <Label>From</Label>
                <Input type="datetime-local" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </div>
              <div>
                <Label>To</Label>
                <Input type="datetime-local" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            </>
          ) : null}
          <div>
            <Label>Provider</Label>
            <Input
              className="w-40"
              placeholder="All"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            />
          </div>
        </PanelBody>
      </Panel>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="health">Health & live</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {loading && !bundle ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : overview ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard
                title="Total sessions"
                value={<AnimatedNumber value={overview.totalSessions} />}
                trend={overview.trends.sessions}
              />
              <StatCard title="Active sessions" value={<AnimatedNumber value={overview.activeSessions} />} sub="CON within 10m" />
              <StatCard
                title="Success rate"
                value={
                  <>
                    <AnimatedNumber value={overview.successRate} decimals={1} />%
                  </>
                }
                trend={overview.trends.successRate}
              />
              <StatCard title="Failed requests" value={<AnimatedNumber value={overview.failedSessions} />} />
              <StatCard
                title="Avg response"
                value={
                  <>
                    <AnimatedNumber value={overview.avgResponseMs} /> ms
                  </>
                }
                sub={`p95 ${Math.round(overview.p95ResponseMs)} ms`}
              />
              <StatCard
                title="Simulations today"
                value={<AnimatedNumber value={overview.simulationsToday} />}
                sub={`${overview.avgSessionDurationSec}s avg duration`}
              />
            </div>
          ) : null}

          {empty ? (
            <EmptyState
              title="No metrics yet"
              description="Run USSD simulations while signed in to populate this dashboard."
            />
          ) : null}

          <Suspense fallback={<Skeleton className="h-72 rounded-xl" />}>
            {bundle?.charts ? <MetricsCharts charts={bundle.charts} /> : null}
          </Suspense>

          {bundle?.insights ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Panel>
                <PanelHeader>
                  <PanelTitle>Peak hour</PanelTitle>
                </PanelHeader>
                <PanelBody className="text-sm">
                  {bundle.insights.peakTrafficHour ? (
                    <p>
                      {bundle.insights.peakTrafficHour.hour}:00 · {bundle.insights.peakTrafficHour.requests} req
                    </p>
                  ) : (
                    <p className="text-muted-foreground">Not enough data</p>
                  )}
                </PanelBody>
              </Panel>
              <Panel>
                <PanelHeader>
                  <PanelTitle>Top provider</PanelTitle>
                </PanelHeader>
                <PanelBody className="text-sm">
                  {bundle.insights.mostUsedProvider ? (
                    <p>
                      <Badge className="mr-2">{bundle.insights.mostUsedProvider.provider}</Badge>
                      {bundle.insights.mostUsedProvider.count}
                    </p>
                  ) : (
                    <p className="text-muted-foreground">Not enough data</p>
                  )}
                </PanelBody>
              </Panel>
              <Panel>
                <PanelHeader>
                  <PanelTitle>Slowest webhook</PanelTitle>
                </PanelHeader>
                <PanelBody className="text-sm">
                  {bundle.insights.slowestWebhook ? (
                    <p className="truncate" title={bundle.insights.slowestWebhook.url}>
                      {Math.round(bundle.insights.slowestWebhook.avgMs)} ms
                    </p>
                  ) : (
                    <p className="text-muted-foreground">Not enough data</p>
                  )}
                </PanelBody>
              </Panel>
              <Panel>
                <PanelHeader>
                  <PanelTitle>Completion</PanelTitle>
                </PanelHeader>
                <PanelBody className="text-sm">
                  <p>{bundle.insights.completionRatePct.toFixed(1)}% END</p>
                </PanelBody>
              </Panel>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Input
              className="min-w-[200px] max-w-sm flex-1"
              placeholder="Search session ID or phone…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
            <Select
              className="w-40"
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
            </Select>
          </div>
          <Table>
            <THead>
              <TR>
                <TH>Session</TH>
                <TH>Provider</TH>
                <TH>Phone</TH>
                <TH className="cursor-pointer" onClick={() => toggleSort("duration")}>
                  Duration {sort === "duration" ? (dir === "asc" ? "↑" : "↓") : ""}
                </TH>
                <TH>Status</TH>
                <TH className="cursor-pointer" onClick={() => toggleSort("avgLatency")}>
                  Avg ms {sort === "avgLatency" ? (dir === "asc" ? "↑" : "↓") : ""}
                </TH>
                <TH className="cursor-pointer" onClick={() => toggleSort("retries")}>
                  Retries {sort === "retries" ? (dir === "asc" ? "↑" : "↓") : ""}
                </TH>
                <TH className="cursor-pointer" onClick={() => toggleSort("createdAt")}>
                  Started {sort === "createdAt" ? (dir === "asc" ? "↑" : "↓") : ""}
                </TH>
              </TR>
            </THead>
            <TBody>
              {sessLoading ? (
                <TR>
                  <TD colSpan={8} className="text-center text-muted-foreground">
                    Loading…
                  </TD>
                </TR>
              ) : sessions && sessions.items.length > 0 ? (
                sessions.items.map((r) => (
                  <TR key={r.sessionId}>
                    <TD className="max-w-[120px] truncate font-mono text-xs">{r.sessionId}</TD>
                    <TD>{r.provider}</TD>
                    <TD>{r.phoneNumber}</TD>
                    <TD>{r.durationSec != null ? `${r.durationSec}s` : "—"}</TD>
                    <TD>
                      <Badge
                        variant={
                          r.status === "failed" ? "danger" : r.status === "completed" ? "success" : "accent"
                        }
                      >
                        {r.status}
                      </Badge>
                    </TD>
                    <TD>{r.avgLatencyMs ?? "—"}</TD>
                    <TD>{r.retries}</TD>
                    <TD className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</TD>
                  </TR>
                ))
              ) : (
                <TR>
                  <TD colSpan={8} className="text-center text-muted-foreground">
                    No sessions in this range.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
          {sessions && sessions.total > take ? (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {page + 1} of {Math.ceil(sessions.total / take) || 1}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={(page + 1) * take >= sessions.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="health" className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <Panel>
            <PanelHeader>
              <PanelTitle>Traffic & health</PanelTitle>
            </PanelHeader>
            <PanelBody className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Redis</span>
                <Badge variant={health?.redis ? "success" : "danger"}>{health?.redis ? "OK" : "Down"}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">PostgreSQL</span>
                <Badge variant={health?.postgres ? "success" : "danger"}>{health?.postgres ? "OK" : "Down"}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Requests / min</span>
                <span className="font-mono">{overview?.requestsPerMinute.toFixed(2) ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Retries</span>
                <span className="font-mono">{overview?.totalRetries ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Timeouts</span>
                <span className="font-mono">{overview?.timeouts ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Live (last minute)</span>
                <span className="font-mono">{health?.liveRequestsLastMinute ?? "—"}</span>
              </div>
            </PanelBody>
          </Panel>
          <Panel>
            <PanelHeader>
              <PanelTitle>Live activity</PanelTitle>
            </PanelHeader>
            <PanelBody>
              <div className="max-h-[420px] space-y-2 overflow-y-auto">
                {activity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Waiting for simulation events…</p>
                ) : (
                  activity.map((a) => (
                    <div
                      key={a.id}
                      className={cn(
                        "rounded-lg border border-border-subtle px-3 py-2 text-xs",
                        a.tone === "err" && "border-danger/30 bg-danger/5",
                        a.tone === "warn" && "border-warning/30 bg-warning/5",
                      )}
                    >
                      <div className="font-medium text-foreground">{a.title}</div>
                      <div className="mt-0.5 text-muted-foreground">{a.detail}</div>
                      <div className="mt-1 text-[10px] text-muted-foreground">{new Date(a.ts).toLocaleTimeString()}</div>
                    </div>
                  ))
                )}
              </div>
            </PanelBody>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
