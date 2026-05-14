import type { FlowDefinition, FlowNode, SessionState } from "../types/ussd.js";

const DEFAULT_ROOT = "main-menu";

export const STARTER_FLOW: FlowDefinition = {
  rootId: DEFAULT_ROOT,
  nodes: {
    "main-menu": {
      id: "main-menu",
      type: "menu",
      message: "Welcome\n1. Balance\n2. Send Money\n3. Exit",
      options: [
        { key: "1", label: "Balance", next: "balance" },
        { key: "2", label: "Send Money", next: "send-money" },
        { key: "3", label: "Exit", next: "goodbye" },
      ],
    },
    balance: {
      id: "balance",
      type: "end",
      message: "Your balance is UGX 125,000. Thank you.",
    },
    "send-money": {
      id: "send-money",
      type: "end",
      message: "Send Money is not configured in this demo.",
    },
    goodbye: {
      id: "goodbye",
      type: "end",
      message: "Thank you for using our service. Goodbye.",
    },
  },
};

function normalizeFlow(raw: unknown): FlowDefinition {
  const obj = raw as { rootId?: string; nodes?: Record<string, FlowNode> };
  if (!obj?.nodes || typeof obj.nodes !== "object") {
    return STARTER_FLOW;
  }
  const rootId = obj.rootId && obj.nodes[obj.rootId] ? obj.rootId : Object.keys(obj.nodes)[0];
  if (!rootId) return STARTER_FLOW;
  return { rootId, nodes: obj.nodes };
}

function formatMenu(node: FlowNode): string {
  if (node.type === "end") return node.message;
  if (node.options?.length) {
    const lines = node.options.map((o) => `${o.key}. ${o.label}`).join("\n");
    return `${node.message}\n${lines}`;
  }
  return node.message;
}

export function parseFlowJson(json: unknown): FlowDefinition {
  try {
    return normalizeFlow(json);
  } catch {
    return STARTER_FLOW;
  }
}

export type EngineResult = { response: string; ended: boolean; currentStep: string };

export function runEngine(
  flow: FlowDefinition,
  session: SessionState,
  newText: string,
): EngineResult {
  const pathKeys = newText
    .split("*")
    .map((s) => s.trim())
    .filter(Boolean);

  let nodeId = flow.rootId;
  const nodes = flow.nodes;

  for (const key of pathKeys) {
    const node = nodes[nodeId];
    if (!node || node.type === "end") {
      return {
        response: `END Invalid selection at step.`,
        ended: true,
        currentStep: nodeId,
      };
    }
    const opt = node.options?.find((o) => o.key === key);
    if (!opt) {
      return {
        response: `CON ${formatMenu(node)}\nInvalid choice. Try again.`,
        ended: false,
        currentStep: nodeId,
      };
    }
    nodeId = opt.next;
  }

  const current = nodes[nodeId];
  if (!current) {
    return { response: "END Unknown menu.", ended: true, currentStep: nodeId };
  }

  if (current.type === "end") {
    return {
      response: `END ${current.message}`,
      ended: true,
      currentStep: nodeId,
    };
  }

  return {
    response: `CON ${formatMenu(current)}`,
    ended: false,
    currentStep: nodeId,
  };
}
