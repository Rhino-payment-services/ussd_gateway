import { useEffect, useState } from "react";
import { api } from "../../services/api";

type Flow = {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  flowJson: unknown;
};

export function FlowsPage() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [importText, setImportText] = useState("");

  const load = async () => {
    const { data } = await api.get<{ flows: Flow[] }>("/api/flows");
    setFlows(data.flows);
  };

  useEffect(() => {
    void load();
  }, []);

  const exportFlow = (f: Flow) => {
    const blob = new Blob([JSON.stringify(f.flowJson, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${f.slug}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFlow = async () => {
    const json = JSON.parse(importText) as { name: string; slug: string; flowJson: unknown; isDefault?: boolean };
    await api.post("/api/flows", json);
    setImportText("");
    await load();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Saved flows</h2>
      <ul className="space-y-2">
        {flows.map((f) => (
          <li
            key={f.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
          >
            <div>
              <div className="font-medium">
                {f.name}{" "}
                {f.isDefault && <span className="text-xs text-accent">(default)</span>}
              </div>
              <div className="text-xs text-muted">{f.slug}</div>
            </div>
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-1 text-xs"
              onClick={() => exportFlow(f)}
            >
              Export JSON
            </button>
          </li>
        ))}
      </ul>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Import JSON</h3>
        <textarea
          className="h-40 w-full rounded-xl border border-border bg-background p-3 font-mono text-xs"
          placeholder='{"name":"My Flow","slug":"my-flow","flowJson":{...},"isDefault":false}'
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
        />
        <button
          type="button"
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
          onClick={() => void importFlow().catch(() => alert("Import failed"))}
        >
          Import
        </button>
      </div>
    </div>
  );
}
