import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  Handle,
  Position,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { isAxiosError } from "axios";
import { api } from "../../services/api";
import { PageHeader } from "../../components/ui/page-header";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "../../components/ui/panel";
import { Badge } from "../../components/ui/badge";
import { useThemeStore } from "../../store/themeStore";
import { cn } from "../../lib/utils";

type FlowNodeDef = {
  id: string;
  type?: "menu" | "end";
  message: string;
  options?: { key: string; label: string; next: string }[];
};

type FlowDefinition = { rootId: string; nodes: Record<string, FlowNodeDef> };

type MenuNodeData = {
  label: string;
  message: string;
  isRoot?: boolean;
  optionsPreview?: string;
};

function MenuNode({ data, selected }: NodeProps) {
  const d = data as MenuNodeData;
  return (
    <div
      className={cn(
        "min-w-[180px] max-w-[240px] rounded-lg border bg-card p-2.5 text-xs text-foreground shadow-sm",
        selected ? "border-accent ring-2 ring-ring/30" : "border-border",
        d.isRoot && "border-accent/60",
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <div className="flex items-center justify-between gap-2">
        <div className="truncate font-semibold">{d.label}</div>
        {d.isRoot ? <Badge variant="accent">root</Badge> : null}
      </div>
      <div className="mt-1 whitespace-pre-wrap text-[11px] text-muted-foreground">{d.message}</div>
      {d.optionsPreview ? (
        <div className="mt-1.5 border-t border-border-subtle pt-1.5 font-mono text-[10px] text-muted-foreground whitespace-pre-wrap">
          {d.optionsPreview}
        </div>
      ) : null}
      <Handle type="source" position={Position.Bottom} id="out" className="!bg-accent" />
    </div>
  );
}

function EndNode({ data, selected }: NodeProps) {
  const d = data as MenuNodeData;
  return (
    <div
      className={cn(
        "min-w-[160px] max-w-[240px] rounded-lg border border-danger/40 bg-danger/10 p-2.5 text-xs text-foreground shadow-sm",
        selected && "ring-2 ring-danger/30",
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-danger" />
      <div className="font-semibold text-danger">END</div>
      <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{d.label}</div>
      <div className="mt-1 whitespace-pre-wrap text-[11px] text-muted-foreground">{d.message}</div>
    </div>
  );
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "flow";
}

function nextOptionKey(edges: Edge[], sourceId: string): string {
  const used = new Set(
    edges.filter((e) => e.source === sourceId).map((e) => String(e.label ?? "")),
  );
  for (let i = 1; i <= 9; i++) {
    if (!used.has(String(i))) return String(i);
  }
  return String(used.size + 1);
}

function flowToGraph(flow: FlowDefinition): { nodes: Node[]; edges: Edge[] } {
  const ids = Object.keys(flow.nodes);
  const positions: Record<string, { x: number; y: number }> = {};
  ids.forEach((id, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    positions[id] = { x: col * 280 + 40, y: row * 220 + 40 };
  });

  const nodes: Node[] = ids.map((id) => {
    const n = flow.nodes[id]!;
    const isEnd = n.type === "end";
    const optionsPreview = n.options?.map((o) => `${o.key}. ${o.label}`).join("\n") ?? "";
    return {
      id,
      position: positions[id] ?? { x: 0, y: 0 },
      data: {
        label: n.id,
        message: n.message,
        isRoot: id === flow.rootId,
        optionsPreview: isEnd ? "" : optionsPreview,
      },
      type: isEnd ? "end" : "menu",
    };
  });

  const edges: Edge[] = [];
  for (const n of Object.values(flow.nodes)) {
    if (!n.options) continue;
    for (const opt of n.options) {
      edges.push({
        id: `${n.id}-${opt.key}-${opt.next}`,
        source: n.id,
        target: opt.next,
        label: opt.key,
        data: { optionLabel: opt.label },
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      });
    }
  }
  return { nodes, edges };
}

function graphToFlow(nodes: Node[], edges: Edge[], rootIdHint?: string): FlowDefinition {
  const incoming = new Set(edges.map((e) => e.target));
  const rootGuess =
    (rootIdHint && nodes.some((n) => n.id === rootIdHint) ? rootIdHint : null) ??
    nodes.find((n) => (n.data as MenuNodeData).isRoot)?.id ??
    nodes.find((n) => !incoming.has(n.id) && n.type !== "end")?.id ??
    nodes[0]?.id ??
    "main-menu";

  const map: Record<string, FlowNodeDef> = {};
  for (const n of nodes) {
    if (n.type === "end") {
      map[n.id] = { id: n.id, type: "end", message: String((n.data as MenuNodeData).message ?? "") };
    } else {
      const outgoing = edges.filter((e) => e.source === n.id);
      map[n.id] = {
        id: n.id,
        type: "menu",
        message: String((n.data as MenuNodeData).message ?? ""),
        options: outgoing.map((e, idx) => ({
          key: String(e.label ?? idx + 1),
          label: String((e.data as { optionLabel?: string } | undefined)?.optionLabel ?? `Option ${e.label ?? idx + 1}`),
          next: e.target,
        })),
      };
    }
  }
  return { rootId: rootGuess, nodes: map };
}

function parseDisplay(raw: string) {
  const t = raw.trim();
  if (t.toUpperCase().startsWith("CON ")) return { mode: "con" as const, body: t.slice(4) };
  if (t.toUpperCase().startsWith("END ")) return { mode: "end" as const, body: t.slice(4) };
  return { mode: "con" as const, body: t };
}

function withOptionPreviews(nodes: Node[], edges: Edge[]): Node[] {
  return nodes.map((n) => {
    if (n.type === "end") return n;
    const outgoing = edges.filter((e) => e.source === n.id);
    const optionsPreview = outgoing
      .map((e) => {
        const label = String((e.data as { optionLabel?: string } | undefined)?.optionLabel ?? "");
        return `${e.label ?? "?"}. ${label || e.target}`;
      })
      .join("\n");
    return { ...n, data: { ...n.data, optionsPreview } };
  });
}

export function FlowBuilderPage() {
  const theme = useThemeStore((s) => s.theme);
  const [searchParams, setSearchParams] = useSearchParams();
  const nodeTypes = useMemo(() => ({ menu: MenuNode, end: EndNode }), []);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [rootId, setRootId] = useState("main-menu");
  const [flowId, setFlowId] = useState<string | null>(null);
  const [name, setName] = useState("My USSD flow");
  const [slug, setSlug] = useState("my-ussd-flow");
  const [isDefault, setIsDefault] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const [previewSession, setPreviewSession] = useState<string>(() => crypto.randomUUID());
  const [previewPath, setPreviewPath] = useState("");
  const [previewDraft, setPreviewDraft] = useState("");
  const [previewScreen, setPreviewScreen] = useState("");
  const [previewEnded, setPreviewEnded] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);

  const selectedNode = nodes.find((n) => n.selected) ?? null;
  const selectedEdge = edges.find((e) => e.selected) ?? null;

  const refreshPreviews = useCallback(
    (nds: Node[], eds: Edge[]) => {
      setNodes(withOptionPreviews(nds, eds));
    },
    [setNodes],
  );

  const applyGraph = useCallback(
    (flow: FlowDefinition) => {
      const g = flowToGraph(flow);
      setRootId(flow.rootId);
      setNodes(g.nodes);
      setEdges(g.edges);
    },
    [setEdges, setNodes],
  );

  const loadStarter = useCallback(async () => {
    setBusy(true);
    try {
      const { data } = await api.get<{ flow: FlowDefinition }>("/api/flows/starter");
      applyGraph(data.flow);
      setFlowId(null);
      setName("Starter flow");
      setSlug("starter-flow");
      setIsDefault(false);
      setSearchParams({});
      setStatus("Loaded starter template");
      resetPreview();
    } catch {
      setStatus("Failed to load starter");
    } finally {
      setBusy(false);
    }
  }, [applyGraph, setSearchParams]);

  const loadSaved = useCallback(
    async (id: string) => {
      setBusy(true);
      try {
        const { data } = await api.get<{
          flow: { id: string; name: string; slug: string; isDefault: boolean; flowJson: FlowDefinition };
        }>(`/api/flows/${id}`);
        const def = data.flow.flowJson;
        applyGraph(def);
        setFlowId(data.flow.id);
        setName(data.flow.name);
        setSlug(data.flow.slug);
        setIsDefault(data.flow.isDefault);
        setStatus(`Loaded “${data.flow.name}”`);
        resetPreview();
      } catch {
        setStatus("Failed to load flow");
      } finally {
        setBusy(false);
      }
    },
    [applyGraph],
  );

  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      void loadSaved(id);
      return;
    }
    if (nodes.length === 0) {
      void loadStarter();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load when ?id= changes
  }, [searchParams]);

  useEffect(() => {
    setNodes((nds) => {
      const next = withOptionPreviews(nds, edges);
      const changed = next.some((n, i) => {
        const a = (n.data as MenuNodeData).optionsPreview ?? "";
        const b = (nds[i]?.data as MenuNodeData | undefined)?.optionsPreview ?? "";
        return a !== b;
      });
      return changed ? next : nds;
    });
  }, [edges, setNodes]);

  function resetPreview() {
    setPreviewSession(crypto.randomUUID());
    setPreviewPath("");
    setPreviewDraft("");
    setPreviewScreen("");
    setPreviewEnded(false);
  }

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      const key = nextOptionKey(edges, params.source);
      setEdges((eds) => {
        const next = addEdge(
          {
            ...params,
            id: `${params.source}-${params.target}-${Date.now()}`,
            label: key,
            data: { optionLabel: `Option ${key}` },
            markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
          } as Edge,
          eds,
        );
        queueMicrotask(() => refreshPreviews(nodes, next));
        return next;
      });
    },
    [edges, nodes, refreshPreviews, setEdges],
  );

  const addNode = (type: "menu" | "end") => {
    const base = type === "menu" ? "menu" : "end";
    let i = nodes.filter((n) => n.type === type).length + 1;
    let id = `${base}-${i}`;
    while (nodes.some((n) => n.id === id)) {
      i += 1;
      id = `${base}-${i}`;
    }
    const node: Node = {
      id,
      type,
      position: { x: 80 + (nodes.length % 4) * 60, y: 80 + nodes.length * 24 },
      data: {
        label: id,
        message: type === "menu" ? "Choose an option" : "Thank you. Goodbye.",
        isRoot: false,
        optionsPreview: "",
      },
    };
    setNodes((nds) => [...nds, node]);
    setStatus(`Added ${type} node “${id}”`);
  };

  const deleteSelected = () => {
    if (selectedEdge) {
      setEdges((eds) => {
        const next = eds.filter((e) => e.id !== selectedEdge.id);
        queueMicrotask(() => refreshPreviews(nodes, next));
        return next;
      });
      setStatus("Deleted connection");
      return;
    }
    if (!selectedNode) {
      setStatus("Select a node or connection first");
      return;
    }
    if (selectedNode.id === rootId) {
      setStatus("Cannot delete the root node — set another root first");
      return;
    }
    const id = selectedNode.id;
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => {
      const next = eds.filter((e) => e.source !== id && e.target !== id);
      queueMicrotask(() => refreshPreviews(nodes.filter((n) => n.id !== id), next));
      return next;
    });
    setStatus(`Deleted “${id}”`);
  };

  const markRoot = () => {
    if (!selectedNode || selectedNode.type === "end") {
      setStatus("Select a menu node to set as root");
      return;
    }
    setRootId(selectedNode.id);
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, isRoot: n.id === selectedNode.id },
      })),
    );
    setStatus(`Root set to “${selectedNode.id}”`);
  };

  const updateSelectedNode = (patch: Partial<MenuNodeData> & { newId?: string }) => {
    if (!selectedNode) return;
    const oldId = selectedNode.id;
    const newId = patch.newId?.trim();

    if (newId && newId !== oldId) {
      if (nodes.some((n) => n.id === newId)) {
        setStatus("Node id already exists");
        return;
      }
      setNodes((nds) =>
        nds.map((n) =>
          n.id === oldId
            ? {
                ...n,
                id: newId,
                data: {
                  ...n.data,
                  label: newId,
                  message: patch.message ?? (n.data as MenuNodeData).message,
                  isRoot: rootId === oldId,
                },
              }
            : n,
        ),
      );
      setEdges((eds) => {
        const next = eds.map((e) => ({
          ...e,
          source: e.source === oldId ? newId : e.source,
          target: e.target === oldId ? newId : e.target,
        }));
        queueMicrotask(() =>
          refreshPreviews(
            nodes.map((n) =>
              n.id === oldId
                ? { ...n, id: newId, data: { ...n.data, label: newId } }
                : n,
            ),
            next,
          ),
        );
        return next;
      });
      if (rootId === oldId) setRootId(newId);
      return;
    }

    setNodes((nds) =>
      nds.map((n) =>
        n.id === oldId
          ? {
              ...n,
              data: {
                ...n.data,
                ...(patch.message !== undefined ? { message: patch.message } : {}),
              },
            }
          : n,
      ),
    );
  };

  const updateSelectedEdge = (patch: { key?: string; optionLabel?: string }) => {
    if (!selectedEdge) return;
    setEdges((eds) => {
      const next = eds.map((e) => {
        if (e.id !== selectedEdge.id) return e;
        return {
          ...e,
          label: patch.key ?? e.label,
          data: {
            ...(e.data as object),
            ...(patch.optionLabel !== undefined ? { optionLabel: patch.optionLabel } : {}),
          },
        };
      });
      queueMicrotask(() => refreshPreviews(nodes, next));
      return next;
    });
  };

  const currentFlow = () => graphToFlow(nodes, edges, rootId);

  const saveFlow = async () => {
    if (!name.trim() || !slug.trim()) {
      setStatus("Name and slug are required");
      return;
    }
    setBusy(true);
    try {
      const flowJson = currentFlow();
      if (flowId) {
        const { data } = await api.put<{ flow: { id: string } }>(`/api/flows/${flowId}`, {
          name: name.trim(),
          slug: slug.trim(),
          flowJson,
          isDefault,
        });
        setFlowId(data.flow.id);
        setSearchParams({ id: data.flow.id });
        setStatus("Flow saved");
      } else {
        const { data } = await api.post<{ flow: { id: string } }>("/api/flows", {
          name: name.trim(),
          slug: slug.trim(),
          flowJson,
          isDefault,
        });
        setFlowId(data.flow.id);
        setSearchParams({ id: data.flow.id });
        setStatus("Flow created");
      }
    } catch (e) {
      if (isAxiosError(e)) {
        setStatus((e.response?.data as { error?: string })?.error ?? "Save failed");
      } else {
        setStatus("Save failed");
      }
    } finally {
      setBusy(false);
    }
  };

  const runPreview = async (text: string) => {
    setPreviewBusy(true);
    try {
      const { data } = await api.post<{
        response: string;
        ended: boolean;
        sessionId: string;
      }>("/api/flows/run", {
        sessionId: previewSession,
        text,
        flowJson: currentFlow(),
      });
      setPreviewSession(data.sessionId);
      const parsed = parseDisplay(data.response);
      setPreviewScreen(parsed.body);
      setPreviewEnded(data.ended || parsed.mode === "end");
      setPreviewPath(text);
      setPreviewDraft("");
    } catch (e) {
      if (isAxiosError(e)) {
        setPreviewScreen((e.response?.data as { error?: string })?.error ?? "Preview failed");
      } else {
        setPreviewScreen("Preview failed");
      }
      setPreviewEnded(true);
    } finally {
      setPreviewBusy(false);
    }
  };

  const startPreview = async () => {
    resetPreview();
    const sid = crypto.randomUUID();
    setPreviewSession(sid);
    setPreviewBusy(true);
    try {
      const { data } = await api.post<{
        response: string;
        ended: boolean;
        sessionId: string;
      }>("/api/flows/run", {
        sessionId: sid,
        text: "",
        flowJson: currentFlow(),
      });
      setPreviewSession(data.sessionId);
      const parsed = parseDisplay(data.response);
      setPreviewScreen(parsed.body);
      setPreviewEnded(data.ended || parsed.mode === "end");
    } catch {
      setPreviewScreen("Preview failed");
      setPreviewEnded(true);
    } finally {
      setPreviewBusy(false);
    }
  };

  const sendPreview = async () => {
    const segment = previewDraft.trim();
    if (!segment) return;
    await runPreview(previewPath ? `${previewPath}*${segment}` : segment);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Flow builder"
        description="Drag nodes, connect options, edit in the side panel, then save and preview locally."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" type="button" disabled={busy} onClick={() => void loadStarter()}>
              Load starter
            </Button>
            <Button size="sm" variant="secondary" type="button" disabled={busy} onClick={() => void saveFlow()}>
              {flowId ? "Save" : "Save as new"}
            </Button>
            <Button size="sm" type="button" asChild>
              <Link to="/dashboard/flows">Saved flows</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-3">
        <div>
          <Label>Name</Label>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!flowId) setSlug(slugify(e.target.value));
            }}
          />
        </div>
        <div>
          <Label>Slug</Label>
          <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} className="font-mono text-xs" />
        </div>
        <div className="flex items-end gap-3 pb-1">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            Default flow
          </label>
          {status ? <span className="text-xs text-muted-foreground">{status}</span> : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" type="button" variant="secondary" onClick={() => addNode("menu")}>
          + Menu
        </Button>
        <Button size="sm" type="button" variant="secondary" onClick={() => addNode("end")}>
          + End
        </Button>
        <Button size="sm" type="button" variant="outline" onClick={markRoot}>
          Set as root
        </Button>
        <Button size="sm" type="button" variant="outline" onClick={deleteSelected}>
          Delete selected
        </Button>
        <Button
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => {
            setShowPreview((v) => !v);
            if (!showPreview) void startPreview();
          }}
        >
          {showPreview ? "Hide preview" : "Show preview"}
        </Button>
      </div>

      <div className={cn("grid gap-4", showPreview ? "xl:grid-cols-[1fr_280px_300px]" : "xl:grid-cols-[1fr_280px]")}>
        <Panel className="overflow-hidden">
          <div className="h-[560px] bg-background">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={(changes) => {
                onEdgesChange(changes);
              }}
              onConnect={onConnect}
              onEdgesDelete={(deleted) => {
                const ids = new Set(deleted.map((e) => e.id));
                const next = edges.filter((e) => !ids.has(e.id));
                refreshPreviews(nodes, next);
              }}
              nodeTypes={nodeTypes}
              fitView
              colorMode={theme}
              deleteKeyCode={["Backspace", "Delete"]}
            >
              <MiniMap />
              <Controls />
              <Background gap={16} size={1} />
            </ReactFlow>
          </div>
        </Panel>

        <Panel className="h-fit">
          <PanelHeader>
            <PanelTitle>Inspector</PanelTitle>
          </PanelHeader>
          <PanelBody className="space-y-3">
            {selectedNode ? (
              <>
                <div>
                  <Label>Node id</Label>
                  <Input
                    className="font-mono text-xs"
                    defaultValue={selectedNode.id}
                    key={selectedNode.id}
                    onBlur={(e) => updateSelectedNode({ newId: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Type</Label>
                  <p className="text-sm text-muted-foreground">{selectedNode.type === "end" ? "END" : "Menu"}</p>
                </div>
                <div>
                  <Label>{selectedNode.type === "end" ? "End message" : "Prompt"}</Label>
                  <Textarea
                    className="min-h-[100px] text-sm"
                    value={String((selectedNode.data as MenuNodeData).message ?? "")}
                    onChange={(e) => updateSelectedNode({ message: e.target.value })}
                  />
                </div>
                {selectedNode.type !== "end" ? (
                  <p className="text-[11px] text-muted-foreground">
                    Drag from the bottom handle to another node to add a dial option (1, 2, …).
                  </p>
                ) : null}
              </>
            ) : selectedEdge ? (
              <>
                <div>
                  <Label>Dial key</Label>
                  <Input
                    className="font-mono"
                    value={String(selectedEdge.label ?? "")}
                    onChange={(e) => updateSelectedEdge({ key: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Option label</Label>
                  <Input
                    value={String((selectedEdge.data as { optionLabel?: string } | undefined)?.optionLabel ?? "")}
                    onChange={(e) => updateSelectedEdge({ optionLabel: e.target.value })}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {selectedEdge.source} → {selectedEdge.target}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a node or connection to edit. Connect menu → menu/end to define dial paths.
              </p>
            )}
          </PanelBody>
        </Panel>

        {showPreview ? (
          <Panel className="h-fit">
            <PanelHeader>
              <PanelTitle>Preview</PanelTitle>
              <Button size="sm" variant="ghost" type="button" disabled={previewBusy} onClick={() => void startPreview()}>
                Restart
              </Button>
            </PanelHeader>
            <PanelBody className="space-y-3">
              <div className="min-h-[120px] rounded-lg border border-border bg-background p-3 text-sm whitespace-pre-wrap">
                {previewScreen || "Press Restart to open the root menu."}
              </div>
              {!previewEnded ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="Choice…"
                    value={previewDraft}
                    disabled={previewBusy}
                    onChange={(e) => setPreviewDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void sendPreview();
                    }}
                  />
                  <Button size="sm" type="button" disabled={previewBusy || !previewDraft.trim()} onClick={() => void sendPreview()}>
                    Send
                  </Button>
                </div>
              ) : (
                <Button size="sm" type="button" variant="secondary" onClick={() => void startPreview()}>
                  Dial again
                </Button>
              )}
              <p className="font-mono text-[10px] text-muted-foreground">path: {previewPath || "∅"}</p>
            </PanelBody>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
