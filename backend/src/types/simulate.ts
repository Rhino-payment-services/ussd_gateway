import { z } from "zod";
import { telecomProviderSchema } from "../adapters/types.js";

export const simulationOptionsSchema = z.object({
  delayMs: z.number().min(0).max(120_000).optional(),
  retries: z.number().min(0).max(10).optional(),
  timeoutMs: z.number().min(500).max(120_000).optional(),
  duplicate: z.boolean().optional(),
  invalidInput: z.boolean().optional(),
});

export const simulateInboundSchema = z.object({
  sessionId: z.string().min(1).max(256).optional(),
  phoneNumber: z.string().min(8).max(20),
  serviceCode: z.string().min(1).max(32),
  text: z.string().max(182).optional().default(""),
  profileId: z.string().cuid().optional(),
  callbackUrl: z.string().url().optional(),
  httpMethod: z.enum(["GET", "POST", "PUT", "PATCH"]).optional(),
  headers: z.record(z.string()).optional(),
  authToken: z.string().max(8192).optional(),
  authScheme: z.enum(["bearer", "header", "none"]).optional(),
  authHeaderName: z.string().max(128).optional(),
  provider: telecomProviderSchema.optional(),
  payloadMapping: z.record(z.string()).optional(),
  responseType: z.enum(["plain", "json"]).optional(),
  responseJsonPath: z.string().max(256).optional(),
  simulation: simulationOptionsSchema.optional(),
});

export type SimulateInbound = z.infer<typeof simulateInboundSchema>;

export const replayBodySchema = z.object({
  profileId: z.string().cuid(),
  phoneNumber: z.string().min(8).max(20).optional(),
  serviceCode: z.string().min(1).max(32).optional(),
  steps: z.array(z.object({ text: z.string().max(182).default("") })).min(1).max(50),
});

export type ReplayBody = z.infer<typeof replayBodySchema>;
