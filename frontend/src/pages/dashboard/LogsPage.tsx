import { useEffect, useState } from "react";
import { api } from "../../services/api";
import { useSocketLog } from "../../hooks/useSocketLog";
import { PageHeader } from "../../components/ui/page-header";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "../../components/ui/panel";
import { EmptyState } from "../../components/ui/empty-state";
import { cn } from "../../lib/utils";

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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showLive, setShowLive] = useState(false);
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
    <div>
      <PageHeader
        title="Session logs"
        description="Request history for your account."
        actions={
          <>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={failedOnly} onChange={(e) => setFailedOnly(e.target.checked)} />
              Failed only
            </label>
            <Button variant="outline" size="sm" type="button" onClick={() => setShowLive((v) => !v)}>
              {showLive ? "Hide live" : "Live feed"}
            </Button>
          </>
        }
      />

      <div className={cn("grid gap-4", showLive && "lg:grid-cols-[1fr_320px]")}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setPage((p) => Math.max(0, p - 1))}>
              Prev
            </Button>
            <Button variant="outline" size="sm" type="button" onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
            <span className="text-xs text-muted-foreground">Page {page}</span>
          </div>

          {items.length === 0 ? (
            <EmptyState title="No logs" description="Simulate traffic while logged in to populate history." />
          ) : (
            <div className="space-y-2">
              {items.map((row) => (
                <Panel key={row.id}>
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-sidebar-accent/30"
                    onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={row.success ? "success" : "danger"}>{row.success ? "OK" : "FAIL"}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleString()}</span>
                        <span className="text-xs text-muted-foreground">
                          {row.latencyMs ?? "—"}ms · HTTP {row.httpStatus ?? "—"}
                        </span>
                      </div>
                      <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
                        {row.sessionId.slice(0, 8)}… · {row.phoneNumber} · {row.serviceCode}
                      </div>
                    </div>
                    <span className="shrink-0 text-muted-foreground">{expanded === row.id ? "−" : "+"}</span>
                  </button>
                  {expanded === row.id ? (
                    <PanelBody className="space-y-2 border-t border-border-subtle pt-3 text-xs">
                      <div className="break-all text-muted-foreground">{row.callbackUrl ?? "—"}</div>
                      {row.errorMessage ? <p className="text-danger">{row.errorMessage}</p> : null}
                      <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-background p-2 font-mono">
                        {row.response || "(empty)"}
                      </pre>
                    </PanelBody>
                  ) : null}
                </Panel>
              ))}
            </div>
          )}
        </div>

        {showLive ? (
          <Panel className="h-fit max-h-[640px] overflow-hidden">
            <PanelHeader>
              <PanelTitle>Realtime</PanelTitle>
            </PanelHeader>
            <PanelBody className="max-h-[580px] space-y-2 overflow-y-auto p-2">
              {live.length === 0 ? (
                <p className="p-2 text-xs text-muted-foreground">Waiting for Socket.IO events…</p>
              ) : (
                live.map((e, i) => (
                  <div key={`${e.ts}-${i}`} className="rounded-lg border border-border-subtle p-2 text-xs">
                    <div className="text-muted-foreground">{e.ts.slice(11, 19)}</div>
                    <div className="font-medium">{e.event}</div>
                    <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-muted-foreground">
                      {JSON.stringify(e.payload, null, 2)}
                    </pre>
                  </div>
                ))
              )}
            </PanelBody>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
