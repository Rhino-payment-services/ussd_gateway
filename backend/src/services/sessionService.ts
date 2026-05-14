import { getRedis } from "../redis/redisManager.js";
import { env } from "../config/env.js";
import type { SessionState } from "../types/ussd.js";

const key = (sessionId: string) => `ussd:session:${sessionId}`;

export async function getSession(sessionId: string): Promise<SessionState | null> {
  const raw = await getRedis().get(key(sessionId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionState;
  } catch {
    return null;
  }
}

export async function saveSession(state: SessionState): Promise<void> {
  await getRedis().set(key(state.sessionId), JSON.stringify(state), "EX", env.SESSION_TTL_SECONDS);
}

export async function deleteSession(sessionId: string): Promise<void> {
  await getRedis().del(key(sessionId));
}

export function buildInitialSession(input: {
  sessionId: string;
  phoneNumber: string;
  serviceCode: string;
  userId?: string | null;
}): SessionState {
  return {
    sessionId: input.sessionId,
    phoneNumber: input.phoneNumber,
    serviceCode: input.serviceCode,
    currentStep: "root",
    previousInputs: [],
    menuHistory: [],
    startedAt: new Date().toISOString(),
    userId: input.userId ?? null,
  };
}

export function updateSessionFromText(state: SessionState, text: string): SessionState {
  const segments = text
    .split("*")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    ...state,
    previousInputs: segments,
    menuHistory:
      segments.length > 0
        ? [...state.menuHistory, segments[segments.length - 1]!]
        : state.menuHistory,
  };
}
