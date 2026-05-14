import { randomUUID } from "crypto";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { logger } from "../logger/logger.js";
import { HttpError } from "../errors/httpError.js";
import { buildOutboundBody, normalizeProvider } from "../adapters/index.js";
import type { TelecomProvider } from "../adapters/types.js";
import { forwardWebhookRequest } from "./webhookForwarder.js";
import {
  buildInitialSession,
  deleteSession,
  getSession,
  saveSession,
  updateSessionFromText,
} from "./sessionService.js";
import type { SimulateInbound } from "../types/simulate.js";
import { extractPlainUssdFromHttpBody, parseConEndFromText } from "../telecom/responseFormat.js";
import { emitLog, notifyUserActivity, notifyUserMetricsRefresh } from "../socket/ioHub.js";

type ResolvedTarget = {
  profileId: string | null;
  callbackUrl: string;
  httpMethod: "GET" | "POST" | "PUT" | "PATCH";
  headers: Record<string, string>;
  authToken: string | null;
  authScheme: "bearer" | "header" | "none";
  authHeaderName: string;
  provider: TelecomProvider;
  payloadMapping: Record<string, string>;
  responseType: "plain" | "json";
  responseJsonPath: string | null;
  simulationDelayMs: number;
  simulationRetries: number;
};

function asRecord(obj: unknown): Record<string, string> {
  if (!obj || typeof obj !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function applyAuth(headers: Record<string, string>, t: ResolvedTarget) {
  if (!t.authToken || t.authScheme === "none") return;
  if (t.authScheme === "bearer") {
    headers.Authorization = headers.Authorization ?? `Bearer ${t.authToken}`;
    return;
  }
  const name = t.authHeaderName || "Authorization";
  headers[name] = t.authToken;
}

async function resolveTarget(input: SimulateInbound, userId: string | null): Promise<ResolvedTarget> {
  if (input.profileId) {
    if (!userId) throw new HttpError(401, "Authentication required to use profileId");
    const p = await prisma.webhookProfile.findFirst({
      where: { id: input.profileId, userId },
    });
    if (!p) throw new HttpError(404, "Webhook profile not found");
    const headers = { ...asRecord(p.headers), ...(input.headers ?? {}) };
    return {
      profileId: p.id,
      callbackUrl: p.callbackUrl,
      httpMethod: (input.httpMethod ?? (p.httpMethod as ResolvedTarget["httpMethod"])) || "POST",
      headers,
      authToken: input.authToken ?? p.authToken,
      authScheme: (input.authScheme ?? (p.authScheme as ResolvedTarget["authScheme"])) || "bearer",
      authHeaderName: input.authHeaderName ?? p.authHeaderName,
      provider: normalizeProvider(input.provider ?? p.provider),
      payloadMapping: { ...asRecord(p.payloadMapping), ...(input.payloadMapping ?? {}) },
      responseType: (input.responseType ?? (p.responseType as "plain" | "json")) || "plain",
      responseJsonPath: input.responseJsonPath ?? p.responseJsonPath ?? null,
      simulationDelayMs: input.simulation?.delayMs ?? p.simulationDelayMs,
      simulationRetries: input.simulation?.retries ?? p.simulationRetries,
    };
  }

  if (input.callbackUrl) {
    if (!userId && !env.ALLOW_ANONYMOUS_SIMULATE) {
      throw new HttpError(403, "Anonymous callbackUrl simulate is disabled (set ALLOW_ANONYMOUS_SIMULATE=true)");
    }
    const headers = { ...(input.headers ?? {}) };
    return {
      profileId: null,
      callbackUrl: input.callbackUrl,
      httpMethod: input.httpMethod ?? "POST",
      headers,
      authToken: input.authToken ?? null,
      authScheme: input.authScheme ?? "none",
      authHeaderName: input.authHeaderName ?? "Authorization",
      provider: normalizeProvider(input.provider),
      payloadMapping: input.payloadMapping ?? {},
      responseType: input.responseType ?? "plain",
      responseJsonPath: input.responseJsonPath ?? null,
      simulationDelayMs: input.simulation?.delayMs ?? 0,
      simulationRetries: input.simulation?.retries ?? 0,
    };
  }

  throw new HttpError(
    400,
    "Provide profileId (with Authorization) or callbackUrl for the external USSD backend. This gateway does not run menu business logic.",
  );
}

export type SimulateResult = {
  response: string;
  ended: boolean;
  source: "forward";
  sessionId: string;
  inspector: {
    outgoingPayload: unknown;
    outgoingHeaders: Record<string, string>;
    httpStatus?: number;
    latencyMs: number;
    attempts: number;
    success: boolean;
    errorMessage?: string;
    profileId?: string | null;
    provider: TelecomProvider;
    callbackUrl: string;
  };
};

export async function runSimulate(input: SimulateInbound, userId: string | null): Promise<SimulateResult> {
  const sessionId = input.sessionId ?? randomUUID();
  let text = input.text ?? "";
  if (input.simulation?.invalidInput) {
    text = text ? `${text}*__INVALID__` : "__INVALID__";
  }

  const target = await resolveTarget(input, userId);

  const existing = await getSession(sessionId);
  const base =
    existing ??
    buildInitialSession({
      sessionId,
      phoneNumber: input.phoneNumber,
      serviceCode: input.serviceCode,
      userId,
    });
  const stateAfterText = updateSessionFromText(base, text);

  const canonical = { sessionId, phoneNumber: input.phoneNumber, serviceCode: input.serviceCode, text };
  const outboundPayload = buildOutboundBody(target.provider, canonical, target.payloadMapping);

  const outgoingHeaders: Record<string, string> = { ...target.headers };
  applyAuth(outgoingHeaders, target);

  const timeoutMs = input.simulation?.timeoutMs ?? env.WEBHOOK_TIMEOUT_MS;

  emitLog("ussd:request", {
    sessionId,
    phoneNumber: input.phoneNumber,
    serviceCode: input.serviceCode,
    text,
    profileId: target.profileId,
    provider: target.provider,
  });

  const fwd = await forwardWebhookRequest({
    url: target.callbackUrl,
    method: target.httpMethod,
    headers: outgoingHeaders,
    body: outboundPayload,
    timeoutMs,
    delayMs: target.simulationDelayMs,
    retries: target.simulationRetries,
    duplicate: input.simulation?.duplicate,
  });

  if (!fwd.ok) {
    const raw = `END Gateway error: ${fwd.error}`;
    await persistFailure({
      userId,
      profileId: target.profileId,
      sessionId,
      input,
      target,
      outboundPayload,
      outgoingHeaders,
      fwd,
    });
    emitLog("ussd:error", { sessionId, error: fwd.error });
    await deleteSession(sessionId);
    return {
      response: raw,
      ended: true,
      source: "forward",
      sessionId,
      inspector: {
        outgoingPayload: outboundPayload,
        outgoingHeaders,
        latencyMs: fwd.latencyMs,
        attempts: fwd.attempts,
        success: false,
        errorMessage: fwd.error,
        profileId: target.profileId,
        provider: target.provider,
        callbackUrl: target.callbackUrl,
      },
    };
  }

  const plain = extractPlainUssdFromHttpBody(fwd.parsedData, target.responseType, target.responseJsonPath);
  const parsed = parseConEndFromText(plain);

  if (!parsed.ok) {
    const raw = `END ${parsed.error ?? "Invalid response"}`;
    await persistParsed({
      userId,
      profileId: target.profileId,
      sessionId,
      input,
      target,
      outboundPayload,
      outgoingHeaders,
      fwd,
      response: raw,
      success: false,
      errorMessage: parsed.error,
    });
    emitLog("ussd:error", { sessionId, error: parsed.error });
    const nextState = { ...stateAfterText, currentStep: "error" };
    await saveSession(nextState);
    return {
      response: raw,
      ended: true,
      source: "forward",
      sessionId,
      inspector: {
        outgoingPayload: outboundPayload,
        outgoingHeaders,
        httpStatus: fwd.status,
        latencyMs: fwd.latencyMs,
        attempts: fwd.attempts,
        success: false,
        errorMessage: parsed.error,
        profileId: target.profileId,
        provider: target.provider,
        callbackUrl: target.callbackUrl,
      },
    };
  }

  const raw = parsed.raw;
  const ended = parsed.ended;
  const nextState = { ...stateAfterText, currentStep: ended ? "end" : "forward" };
  if (ended) await deleteSession(sessionId);
  else await saveSession(nextState);

  await persistParsed({
    userId,
    profileId: target.profileId,
    sessionId,
    input,
    target,
    outboundPayload,
    outgoingHeaders,
    fwd,
    response: raw,
    success: true,
  });

  emitLog("ussd:response", {
    sessionId,
    phoneNumber: input.phoneNumber,
    serviceCode: input.serviceCode,
    text,
    response: raw,
    source: "forward",
    latencyMs: fwd.latencyMs,
    httpStatus: fwd.status,
  });

  return {
    response: raw,
    ended,
    source: "forward",
    sessionId,
    inspector: {
      outgoingPayload: outboundPayload,
      outgoingHeaders,
      httpStatus: fwd.status,
      latencyMs: fwd.latencyMs,
      attempts: fwd.attempts,
      success: true,
      profileId: target.profileId,
      provider: target.provider,
      callbackUrl: target.callbackUrl,
    },
  };
}

async function persistParsed(ctx: {
  userId: string | null;
  profileId: string | null;
  sessionId: string;
  input: SimulateInbound;
  target: ResolvedTarget;
  outboundPayload: unknown;
  outgoingHeaders: Record<string, string>;
  fwd: { status: number; latencyMs: number; attempts: number };
  response: string;
  success: boolean;
  errorMessage?: string;
}) {
  try {
    await prisma.ussdRequestLog.create({
      data: {
        userId: ctx.userId ?? undefined,
        profileId: ctx.profileId ?? undefined,
        sessionId: ctx.sessionId,
        phoneNumber: ctx.input.phoneNumber,
        serviceCode: ctx.input.serviceCode,
        text: ctx.input.text ?? "",
        provider: ctx.target.provider,
        callbackUrl: ctx.target.callbackUrl,
        response: ctx.response,
        source: "forward",
        success: ctx.success,
        errorMessage: ctx.errorMessage,
        httpStatus: ctx.fwd.status,
        latencyMs: ctx.fwd.latencyMs,
        attempts: ctx.fwd.attempts,
        outgoingPayload: ctx.outboundPayload as object,
        outgoingHeaders: ctx.outgoingHeaders as object,
      },
    });
    notifyUserMetricsRefresh(ctx.userId);
    notifyUserActivity(ctx.userId, {
      type: ctx.success ? "webhook_ok" : "request_failed",
      sessionId: ctx.sessionId,
      provider: ctx.target.provider,
      latencyMs: ctx.fwd.latencyMs,
      ended: ctx.response.trim().toUpperCase().startsWith("END"),
    });
  } catch (e) {
    logger.error("persist_log_failed", { err: String(e) });
  }
}

async function persistFailure(ctx: {
  userId: string | null;
  profileId: string | null;
  sessionId: string;
  input: SimulateInbound;
  target: ResolvedTarget;
  outboundPayload: unknown;
  outgoingHeaders: Record<string, string>;
  fwd: { latencyMs: number; attempts: number; error: string };
}) {
  try {
    await prisma.ussdRequestLog.create({
      data: {
        userId: ctx.userId ?? undefined,
        profileId: ctx.profileId ?? undefined,
        sessionId: ctx.sessionId,
        phoneNumber: ctx.input.phoneNumber,
        serviceCode: ctx.input.serviceCode,
        text: ctx.input.text ?? "",
        provider: ctx.target.provider,
        callbackUrl: ctx.target.callbackUrl,
        response: "",
        source: "forward",
        success: false,
        errorMessage: ctx.fwd.error,
        httpStatus: null,
        latencyMs: ctx.fwd.latencyMs,
        attempts: ctx.fwd.attempts,
        outgoingPayload: ctx.outboundPayload as object,
        outgoingHeaders: ctx.outgoingHeaders as object,
      },
    });
    notifyUserMetricsRefresh(ctx.userId);
    notifyUserActivity(ctx.userId, {
      type: "webhook_failed",
      sessionId: ctx.sessionId,
      provider: ctx.target.provider,
      error: ctx.fwd.error,
    });
  } catch (e) {
    logger.error("persist_log_failed", { err: String(e) });
  }
}

export async function runReplay(
  userId: string,
  profileId: string,
  phoneNumber: string,
  serviceCode: string,
  steps: { text: string }[],
): Promise<SimulateResult[]> {
  const out: SimulateResult[] = [];
  const sessionId = randomUUID();
  for (const step of steps) {
    const r = await runSimulate(
      {
        sessionId,
        phoneNumber,
        serviceCode,
        text: step.text,
        profileId,
      },
      userId,
    );
    out.push(r);
  }
  return out;
}
