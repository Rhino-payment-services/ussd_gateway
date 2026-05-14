import { useState } from "react";
import { isAxiosError } from "axios";
import { api } from "../../services/api";

type Row = { sessionId: string; text: string; response: string };

export function TestingToolsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [replay, setReplay] = useState("");
  const [inspect, setInspect] = useState("");

  const simulateMany = async () => {
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
    const out = await Promise.all(jobs);
    setRows(out);
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
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Simulate multiple users</h2>
        <p className="text-sm text-muted">Fires five parallel USSD calls with different MSISDNs.</p>
        <button
          type="button"
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
          onClick={() => void simulateMany()}
        >
          Run parallel simulation
        </button>
        <ul className="space-y-2 text-xs">
          {rows.map((r) => (
            <li key={r.sessionId} className="rounded-lg border border-border bg-background/60 p-2">
              <div className="font-mono">{r.sessionId}</div>
              <div>path: {r.text || "∅"}</div>
              <pre className="mt-1 whitespace-pre-wrap">{r.response}</pre>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Replay / inspect raw</h2>
        <textarea
          className="h-40 w-full rounded-xl border border-border bg-background p-3 font-mono text-xs"
          placeholder="Paste JSON for POST /api/simulate (include callbackUrl or profileId)"
          value={replay}
          onChange={(e) => setReplay(e.target.value)}
        />
        <button
          type="button"
          className="rounded-xl border border-border px-4 py-2 text-sm"
          onClick={() => void runReplay()}
        >
          Replay
        </button>
        {inspect && (
          <pre className="rounded-xl border border-border bg-card p-3 text-xs whitespace-pre-wrap">{inspect}</pre>
        )}
      </div>
    </div>
  );
}
