import { useEffect, useState } from "react";
import { api } from "../../services/api";
import { useSocketLog } from "../../hooks/useSocketLog";

type LogRow = {
  id: string;
  sessionId: string;
  phoneNumber: string;
  serviceCode: string;
  text: string;
  response: string;
  source: string;
  success: boolean;
  httpStatus: number | null;
  latencyMs: number | null;
  errorMessage: string | null;
  callbackUrl: string | null;
  createdAt: string;
};

export function LogsPage() {
  const [items, setItems] = useState<LogRow[]>([]);
  const [page, setPage] = useState(0);
  const [failedOnly, setFailedOnly] = useState(false);
  const live = useSocketLog();

  useEffect(() => {
    const load = async () => {
      const { data } = await api.get<{ items: LogRow[] }>("/api/logs", {
        params: { page, take: 40, ...(failedOnly ? { failed: "true" } : {}) },
      });
      setItems(data.items);
    };
    void load();
  }, [page, failedOnly]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Request history</h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-1 text-sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Prev
            </button>
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-1 text-sm"
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
            <span className="text-sm text-muted">Page {page}</span>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={failedOnly} onChange={(e) => setFailedOnly(e.target.checked)} />
            Failed only
          </label>
        </div>
        <ul className="space-y-2 text-sm">
          {items.map((row) => (
            <li key={row.id} className="rounded-xl border border-border bg-background/60 p-3">
              <div className="flex flex-wrap justify-between gap-2 text-xs text-muted">
                <span>{new Date(row.createdAt).toLocaleString()}</span>
                <span>
                  {row.success ? "OK" : "FAIL"} · {row.latencyMs ?? "—"}ms · HTTP {row.httpStatus ?? "—"}
                </span>
              </div>
              <div className="mt-1 font-mono text-xs">sess {row.sessionId.slice(0, 8)}…</div>
              <div className="mt-1 break-all text-xs text-muted">{row.callbackUrl ?? "—"}</div>
              <div className="mt-1 text-xs">
                {row.serviceCode} · {row.phoneNumber} · path <code>{row.text || "∅"}</code>
              </div>
              {row.errorMessage && <p className="mt-1 text-xs text-danger">{row.errorMessage}</p>}
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-card p-2 text-xs">
                {row.response || "(empty)"}
              </pre>
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Realtime (Socket.IO)</h2>
        <ul className="max-h-[520px] space-y-2 overflow-auto text-xs">
          {live.map((e, i) => (
            <li key={`${e.ts}-${i}`} className="rounded-lg border border-border bg-background/60 p-2">
              <div className="text-muted">{e.ts}</div>
              <div className="font-semibold">{e.event}</div>
              <pre className="mt-1 overflow-auto whitespace-pre-wrap">{JSON.stringify(e.payload, null, 2)}</pre>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
