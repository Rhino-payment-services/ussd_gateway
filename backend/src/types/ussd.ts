import { z } from "zod";

export const ussdInboundSchema = z.object({
  sessionId: z.string().min(1).max(256),
  phoneNumber: z.string().min(8).max(20),
  serviceCode: z.string().min(1).max(32),
  text: z.string().max(182).optional().default(""),
});

export type UssdInbound = z.infer<typeof ussdInboundSchema>;

export type FlowNodeType = "menu" | "end";

export type FlowOption = {
  key: string;
  label: string;
  next: string;
};

export type FlowNode = {
  id: string;
  type?: FlowNodeType;
  message: string;
  options?: FlowOption[];
};

export type FlowDefinition = {
  rootId: string;
  nodes: Record<string, FlowNode>;
};

export type SessionState = {
  sessionId: string;
  phoneNumber: string;
  serviceCode: string;
  currentStep: string;
  previousInputs: string[];
  menuHistory: string[];
  startedAt: string;
  userId?: string | null;
};
