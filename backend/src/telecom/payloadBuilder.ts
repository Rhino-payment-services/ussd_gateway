import type { TelecomProvider } from "../adapters/types.js";

export type CanonicalUssdInput = {
  sessionId: string;
  phoneNumber: string;
  serviceCode: string;
  text: string;
};

export function applyFieldMapping(
  canonical: CanonicalUssdInput,
  mapping: Record<string, string>,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    sessionId: canonical.sessionId,
    phoneNumber: canonical.phoneNumber,
    serviceCode: canonical.serviceCode,
    text: canonical.text,
  };
  const out: Record<string, unknown> = {};
  for (const [canonicalKey, value] of Object.entries(base)) {
    const externalKey = mapping[canonicalKey] ?? canonicalKey;
    out[externalKey] = value;
  }
  return out;
}

export function buildOutboundBody(provider: TelecomProvider, canonical: CanonicalUssdInput, mapping: Record<string, string>) {
  switch (provider) {
    case "MTN": {
      const map = { phoneNumber: "msisdn", sessionId: "sessionId", serviceCode: "serviceCode", text: "input" };
      const merged = { ...map, ...mapping };
      const m = applyFieldMapping(canonical, merged);
      return { ...m, networkId: "MTN", ussdServiceCode: canonical.serviceCode };
    }
    case "AIRTEL": {
      const map = { phoneNumber: "MSISDN", sessionId: "sessionId", serviceCode: "serviceCode", text: "input" };
      const merged = { ...map, ...mapping };
      const m = applyFieldMapping(canonical, merged);
      return { ...m, transactionId: canonical.sessionId };
    }
    case "NEXEN": {
      const m = applyFieldMapping(canonical, mapping);
      return { payload: m, meta: { channel: "USSD" } };
    }
    case "CUSTOM":
    case "DIALFORGE":
    default:
      return applyFieldMapping(canonical, mapping);
  }
}
