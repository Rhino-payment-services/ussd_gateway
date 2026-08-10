import type { TelecomProvider } from "./types.js";

export function normalizeProvider(p: string | undefined | null): TelecomProvider {
  const u = (p ?? "DIALFORGE").toUpperCase();
  if (u === "MTN") return "MTN";
  if (u === "AIRTEL") return "AIRTEL";
  if (u === "NEXEN") return "NEXEN";
  if (u === "CUSTOM") return "CUSTOM";
  if (u === "DIALFORGE") return "DIALFORGE";
  return "DIALFORGE";
}

export { buildOutboundBody } from "../telecom/payloadBuilder.js";
