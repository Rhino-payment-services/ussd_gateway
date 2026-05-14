/** CON / END parsing (Africa's Talking style and variants). */

export function isConResponse(body: string): boolean {
  return body.trimStart().toUpperCase().startsWith("CON ");
}

export function isEndResponse(body: string): boolean {
  return body.trimStart().toUpperCase().startsWith("END ");
}

export function stripUssdPrefix(body: string): string {
  const t = body.trimStart();
  const upper = t.toUpperCase();
  if (upper.startsWith("CON ")) return t.slice(4).trimStart();
  if (upper.startsWith("END ")) return t.slice(4).trimStart();
  return t;
}

export function extractPlainUssdFromHttpBody(
  data: unknown,
  responseType: "plain" | "json",
  jsonPath?: string | null,
): string {
  if (responseType === "plain") {
    return typeof data === "string" ? data : JSON.stringify(data);
  }
  if (data && typeof data === "object" && jsonPath) {
    const parts = jsonPath.split(".").filter(Boolean);
    let cur: unknown = data;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in (cur as object)) {
        cur = (cur as Record<string, unknown>)[p];
      } else {
        cur = undefined;
        break;
      }
    }
    if (typeof cur === "string") return cur;
  }
  if (typeof data === "object" && data !== null && "message" in data && typeof (data as { message: unknown }).message === "string") {
    return (data as { message: string }).message;
  }
  return typeof data === "string" ? data : JSON.stringify(data);
}

export function parseConEndFromText(raw: string): { raw: string; ended: boolean; ok: boolean; error?: string } {
  const trimmed = raw.trim();
  if (isEndResponse(trimmed)) return { raw: trimmed, ended: true, ok: true };
  if (isConResponse(trimmed)) return { raw: trimmed, ended: false, ok: true };
  return {
    raw: trimmed,
    ended: true,
    ok: false,
    error: "External backend must return plain text starting with CON or END (after JSON extraction if configured).",
  };
}
