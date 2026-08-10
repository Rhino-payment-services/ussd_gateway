import { useState } from "react";
import { isAxiosError } from "axios";
import { api } from "../../services/api";
import { PageHeader } from "../../components/ui/page-header";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "../../components/ui/panel";
import { EmptyState } from "../../components/ui/empty-state";

type Row = { sessionId: string; text: string; response: string };

export function TestingToolsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [replay, setReplay] = useState("");
  const [inspect, setInspect] = useState("");
  const [busy, setBusy] = useState(false);

  const simulateMany = async () => {
    setBusy(true);
    try {
      const jobs = Array.from({ length: 5 }).map(async (_, i) => {
        const sessionId = crypto.randomUUID();
        const { data } = await api.post<{ response: string }>("/api/simulate", {
          sessionId,
          phoneNumber: `25670000000${i}`,
          serviceCode: "*182#",
          text: i % 2 === 0 ? "" : "1",
          callbackUrl: "http://127.0.0.1:4000/api/examples/mock-ussd",
        });
        return { sessionId, text: i % 2 === 0 ? "" : "1", response: data.response };
      });
      setRows(await Promise.all(jobs));
    } finally {
      setBusy(false);
    }
  };

  const runReplay = async () => {
    try {
      const payload = JSON.parse(replay) as Record<string, unknown>;
      const { data } = await api.post("/api/simulate", payload);
      setInspect(JSON.stringify({ request: payload, response: data }, null, 2));
    } catch (e) {
      if (isAxiosError(e)) {
        setInspect(JSON.stringify({ error: e.response?.data ?? e.message }, null, 2));
      } else {
        setInspect("Invalid JSON");
      }
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Testing tools"
        description="Parallel simulations and raw request replay."
      />

      <Panel>
        <PanelHeader>
          <PanelTitle>Parallel users</PanelTitle>
          <Button size="sm" type="button" disabled={busy} onClick={() => void simulateMany()}>
            {busy ? "Running…" : "Run 5 parallel"}
          </Button>
        </PanelHeader>
        <PanelBody>
          {rows.length === 0 ? (
            <EmptyState
              title="No parallel runs yet"
              description="Fires five concurrent calls to the mock USSD endpoint."
              className="border-0 py-8"
            />
          ) : (
            <ul className="space-y-2 text-xs">
              {rows.map((r) => (
                <li key={r.sessionId} className="rounded-lg border border-border-subtle p-3">
                  <div className="font-mono text-muted-foreground">{r.sessionId}</div>
                  <div className="mt-1">path: {r.text || "∅"}</div>
                  <pre className="mt-1 whitespace-pre-wrap font-mono text-muted-foreground">{r.response}</pre>
                </li>
              ))}
            </ul>
          )}
        </PanelBody>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <PanelTitle>Replay request</PanelTitle>
            <Button variant="secondary" size="sm" type="button" onClick={() => void runReplay()}>
              Replay
            </Button>
          </PanelHeader>
          <PanelBody>
            <Textarea
              className="min-h-[200px]"
              placeholder='{"phoneNumber":"…","serviceCode":"*182#","callbackUrl":"…"}'
              value={replay}
              onChange={(e) => setReplay(e.target.value)}
            />
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader>
            <PanelTitle>Inspect</PanelTitle>
          </PanelHeader>
          <PanelBody>
            {inspect ? (
              <pre className="max-h-[280px] overflow-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                {inspect}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">Replay a JSON body to inspect the response.</p>
            )}
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
