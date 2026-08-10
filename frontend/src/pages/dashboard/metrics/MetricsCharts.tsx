import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ChartsBundle = {
  sessionActivity: { t: string; requests: number; sessions: number }[];
  rpmLive: { minute: string; count: number }[];
  latencyTrend: { t: string; avgMs: number }[];
  dailyVolume: { day: string; count: number }[];
  providers: { provider: string; count: number }[];
  successVsFail: { name: string; value: number }[];
  errorRateTrend: { t: string; rate: number }[];
  webhookPerf: { callbackUrl: string; avgLatencyMs: number; requests: number; failures: number }[];
};

const COLORS = ["#34d399", "#f97316", "#38bdf8", "#a78bfa", "#f472b6", "#fbbf24", "#94a3b8"];

function fmtShort(iso: string) {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:00`;
  } catch {
    return iso;
  }
}

function fmtDay(iso: string) {
  try {
    return iso.slice(0, 10);
  } catch {
    return iso;
  }
}

export default function MetricsCharts({ charts }: { charts: ChartsBundle }) {
  const activity = charts.sessionActivity.map((r) => ({
    ...r,
    label: fmtShort(r.t),
  }));
  const rpm = charts.rpmLive.map((r) => ({
    ...r,
    label: new Date(r.minute).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  }));
  const latency = charts.latencyTrend.map((r) => ({ ...r, label: fmtShort(r.t) }));
  const daily = charts.dailyVolume.map((r) => ({ ...r, label: fmtDay(r.day) }));
  const errs = charts.errorRateTrend.map((r) => ({ ...r, label: fmtShort(r.t) }));

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Session activity</p>
        <p className="mb-3 text-sm font-medium text-foreground">Requests & sessions over time</p>
        <div className="h-[280px] w-full min-w-0">
          {activity.length === 0 ? (
            <p className="py-20 text-center text-sm text-muted-foreground">No data in this range.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activity} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
                <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} width={36} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="requests" name="Requests" stroke="#34d399" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="sessions" name="Sessions" stroke="#38bdf8" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Live traffic</p>
        <p className="mb-3 text-sm font-medium text-foreground">Requests per minute (last hour)</p>
        <div className="h-[280px] w-full min-w-0">
          {rpm.length === 0 ? (
            <p className="py-20 text-center text-sm text-muted-foreground">No traffic in the last hour.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rpm} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="rpmFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
                <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 9 }} interval={4} />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} width={32} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                  }}
                />
                <Area type="monotone" dataKey="count" name="RPM" stroke="#34d399" fill="url(#rpmFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Success mix</p>
        <p className="mb-3 text-sm font-medium text-foreground">Success vs failed requests</p>
        <div className="h-[260px] w-full min-w-0">
          {charts.successVsFail.every((x) => x.value === 0) ? (
            <p className="py-20 text-center text-sm text-muted-foreground">No requests yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.successVsFail}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                >
                  {charts.successVsFail.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? "#34d399" : "#f97316"} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Providers</p>
        <p className="mb-3 text-sm font-medium text-foreground">Usage distribution</p>
        <div className="h-[260px] w-full min-w-0">
          {charts.providers.length === 0 ? (
            <p className="py-20 text-center text-sm text-muted-foreground">No provider data.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.providers} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} horizontal={false} />
                <XAxis type="number" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                <YAxis type="category" dataKey="provider" width={100} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                  }}
                />
                <Bar dataKey="count" name="Requests" radius={[0, 6, 6, 0]}>
                  {charts.providers.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Latency</p>
        <p className="mb-3 text-sm font-medium text-foreground">Average response time trend</p>
        <div className="h-[260px] w-full min-w-0">
          {latency.length === 0 ? (
            <p className="py-20 text-center text-sm text-muted-foreground">No latency samples.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={latency} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
                <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} width={40} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                  }}
                  formatter={(value) => [`${Math.round(Number(value))} ms`, "Avg"]}
                />
                <Line type="monotone" dataKey="avgMs" name="Avg ms" stroke="#a78bfa" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Volume</p>
        <p className="mb-3 text-sm font-medium text-foreground">Daily simulation volume</p>
        <div className="h-[260px] w-full min-w-0">
          {daily.length === 0 ? (
            <p className="py-20 text-center text-sm text-muted-foreground">No daily aggregates.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
                <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} width={36} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                  }}
                />
                <Bar dataKey="count" fill="#38bdf8" name="Requests" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Errors</p>
        <p className="mb-3 text-sm font-medium text-foreground">Error rate trend (%)</p>
        <div className="h-[260px] w-full min-w-0">
          {errs.length === 0 ? (
            <p className="py-20 text-center text-sm text-muted-foreground">No error buckets.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={errs} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="errFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
                <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} width={36} domain={[0, "auto"]} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                  }}
                  formatter={(value) => [`${Number(value).toFixed(1)}%`, "Error rate"]}
                />
                <Area type="monotone" dataKey="rate" name="Error %" stroke="#f97316" fill="url(#errFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 xl:col-span-2">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Webhooks</p>
        <p className="mb-3 text-sm font-medium text-foreground">Callback performance (avg latency)</p>
        <div className="h-[280px] w-full min-w-0">
          {charts.webhookPerf.length === 0 ? (
            <p className="py-20 text-center text-sm text-muted-foreground">No callback URLs in this range.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.webhookPerf} margin={{ top: 8, right: 16, left: 8, bottom: 48 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
                <XAxis dataKey="callbackUrl" tick={{ fill: "var(--muted-foreground)", fontSize: 9 }} angle={-25} textAnchor="end" height={70} interval={0} />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} width={44} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                  }}
                  formatter={(value, name) =>
                    name === "avgLatencyMs" ? [`${Math.round(Number(value))} ms`, "Avg latency"] : [value, name]
                  }
                />
                <Legend />
                <Bar dataKey="avgLatencyMs" name="Avg latency (ms)" fill="#34d399" radius={[6, 6, 0, 0]} />
                <Bar dataKey="failures" name="Failures" fill="#f97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
