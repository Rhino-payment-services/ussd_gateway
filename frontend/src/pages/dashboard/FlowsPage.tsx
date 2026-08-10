import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../services/api";
import { PageHeader } from "../../components/ui/page-header";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "../../components/ui/panel";
import { EmptyState } from "../../components/ui/empty-state";
import { Badge } from "../../components/ui/badge";

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
  const [showImport, setShowImport] = useState(false);

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
    setShowImport(false);
    await load();
  };

  const removeFlow = async (id: string) => {
    if (!confirm("Delete this flow?")) return;
    await api.delete(`/api/flows/${id}`);
    await load();
  };

  return (
    <div>
      <PageHeader
        title="Saved flows"
        description="Open a flow in the builder to edit, or import/export JSON."
        actions={
          <div className="flex gap-2">
            <Button size="sm" type="button" variant="secondary" asChild>
              <Link to="/dashboard/flow-builder">New flow</Link>
            </Button>
            <Button size="sm" type="button" variant="outline" onClick={() => setShowImport((v) => !v)}>
              {showImport ? "Cancel" : "Import"}
            </Button>
          </div>
        }
      />

      {showImport ? (
        <Panel className="mb-6">
          <PanelHeader>
            <PanelTitle>Import JSON</PanelTitle>
            <Button
              size="sm"
              type="button"
              onClick={() => void importFlow().catch(() => alert("Import failed"))}
            >
              Import
            </Button>
          </PanelHeader>
          <PanelBody>
            <Textarea
              className="min-h-[160px]"
              placeholder='{"name":"My Flow","slug":"my-flow","flowJson":{...},"isDefault":false}'
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
          </PanelBody>
        </Panel>
      ) : null}

      {flows.length === 0 ? (
        <EmptyState
          title="No saved flows"
          description="Create one in the flow builder, or import a flow JSON file."
        />
      ) : (
        <div className="space-y-2">
          {flows.map((f) => (
            <Panel key={f.id}>
              <PanelBody className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    {f.name}
                    {f.isDefault ? <Badge variant="accent">default</Badge> : null}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{f.slug}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" type="button" asChild>
                    <Link to={`/dashboard/flow-builder?id=${f.id}`}>Open in builder</Link>
                  </Button>
                  <Button variant="outline" size="sm" type="button" onClick={() => exportFlow(f)}>
                    Export
                  </Button>
                  <Button variant="ghost" size="sm" type="button" onClick={() => void removeFlow(f.id)}>
                    Delete
                  </Button>
                </div>
              </PanelBody>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
