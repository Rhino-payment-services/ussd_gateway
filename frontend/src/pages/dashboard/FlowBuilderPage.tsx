import { useCallback, useMemo, useState } from "react";
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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api } from "../../services/api";

type FlowNodeDef = {
  id: string;
  type?: "menu" | "end";
  message: string;
  options?: { key: string; label: string; next: string }[];
};

type FlowDefinition = { rootId: string; nodes: Record<string, FlowNodeDef> };

function MenuNode({ data, selected }: NodeProps) {
  return (
    <div
      className={`min-w-[160px] rounded-lg border bg-white p-2 text-xs text-black shadow ${
        selected ? "border-blue-500 ring-2 ring-blue-300" : "border-gray-300"
      }`}
    >
      <Handle type="target" position={Position.Top} />
      <div className="font-bold">{String(data.label)}</div>
      <div className="mt-1 whitespace-pre-wrap text-[11px]">{String(data.message)}</div>
      <Handle type="source" position={Position.Bottom} id="a" />
    </div>
  );
}

function EndNode({ data, selected }: NodeProps) {
  return (
    <div
      className={`min-w-[140px] rounded-lg border bg-rose-50 p-2 text-xs text-black shadow ${
        selected ? "border-rose-500 ring-2 ring-rose-200" : "border-rose-200"
      }`}
    >
      <Handle type="target" position={Position.Top} />
      <div className="font-bold">END</div>
      <div className="mt-1 whitespace-pre-wrap text-[11px]">{String(data.message)}</div>
    </div>
  );
}

function flowToGraph(flow: FlowDefinition): { nodes: Node[]; edges: Edge[] } {
  const ids = Object.keys(flow.nodes);
  const positions: Record<string, { x: number; y: number }> = {};
  ids.forEach((id, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    positions[id] = { x: col * 260 + 40, y: row * 200 + 40 };
  });

  const nodes: Node[] = ids.map((id) => {
    const n = flow.nodes[id];
    const isEnd = n.type === "end";
    return {
      id,
      position: positions[id] ?? { x: 0, y: 0 },
      data: { label: n.id, message: n.message },
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
      });
    }
  }
  return { nodes, edges };
}

function graphToFlow(nodes: Node[], edges: Edge[]): FlowDefinition {
  const incoming = new Set(edges.map((e) => e.target));
  const rootGuess = nodes.find((n) => !incoming.has(n.id))?.id ?? nodes[0]?.id ?? "main-menu";

  const map: Record<string, FlowNodeDef> = {};
  for (const n of nodes) {
    if (n.type === "end") {
      map[n.id] = { id: n.id, type: "end", message: String(n.data.message ?? "") };
    } else {
      const outgoing = edges.filter((e) => e.source === n.id);
      map[n.id] = {
        id: n.id,
        type: "menu",
        message: String(n.data.message ?? ""),
        options: outgoing.map((e, idx) => ({
          key: String(e.label ?? idx + 1),
          label: `Go to ${e.target}`,
          next: e.target,
        })),
      };
    }
  }
  return { rootId: rootGuess, nodes: map };
}

export function FlowBuilderPage() {
  const nodeTypes = useMemo(() => ({ menu: MenuNode, end: EndNode }), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [exportJson, setExportJson] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const loadStarter = useCallback(async () => {
    const { data } = await api.get<{ flow: FlowDefinition }>("/api/flows/starter");
    const g = flowToGraph(data.flow);
    setNodes(g.nodes);
    setEdges(g.edges);
    setMessage("Loaded starter flow");
  }, [setEdges, setNodes]);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            id: `${params.source}-${params.target}-${Date.now()}`,
            label: "1",
          } as Edge,
          eds,
        ),
      ),
    [setEdges],
  );

  const exportFlow = () => {
    const flow = graphToFlow(nodes, edges);
    setExportJson(JSON.stringify(flow, null, 2));
  };

  const applyMessage = () => {
    const selected = nodes.find((n) => n.selected);
    if (!selected) {
      setMessage("Select a node first");
      return;
    }
    const next = prompt("New message", String(selected.data.message ?? ""));
    if (next === null) return;
    setNodes((nds) =>
      nds.map((n) => (n.id === selected.id ? { ...n, data: { ...n.data, message: next } } : n)),
    );
    setMessage("Updated node message");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-xl bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
          onClick={() => void loadStarter()}
        >
          Load starter
        </button>
        <button type="button" className="rounded-xl border border-border px-3 py-2 text-sm" onClick={exportFlow}>
          Export JSON
        </button>
        <button type="button" className="rounded-xl border border-border px-3 py-2 text-sm" onClick={applyMessage}>
          Edit selected message
        </button>
      </div>
      {message && <p className="text-sm text-muted">{message}</p>}
      <div className="h-[520px] rounded-2xl border border-border bg-background">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
        >
          <MiniMap />
          <Controls />
          <Background />
        </ReactFlow>
      </div>
      {exportJson && (
        <textarea
          readOnly
          className="h-56 w-full rounded-xl border border-border bg-card p-3 font-mono text-xs"
          value={exportJson}
        />
      )}
    </div>
  );
}
