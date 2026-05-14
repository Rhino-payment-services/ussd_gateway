import type { TelecomProvider } from "./types.js";

export function normalizeProvider(p: string | undefined | null): TelecomProvider {
  const u = (p ?? "AFRICASTALKING").toUpperCase();
  if (u === "MTN") return "MTN";
  if (u === "AIRTEL") return "AIRTEL";
  if (u === "NEXEN") return "NEXEN";
  if (u === "CUSTOM") return "CUSTOM";
  return "AFRICASTALKING";
}

export { buildOutboundBody } from "../telecom/payloadBuilder.js";
