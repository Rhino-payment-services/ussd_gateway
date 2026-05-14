import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";

type Inspector = {
  outgoingPayload: unknown;
  outgoingHeaders: Record<string, string>;
  httpStatus?: number;
  latencyMs: number;
  attempts: number;
  success: boolean;
  errorMessage?: string;
  profileId?: string | null;
  provider: string;
  callbackUrl: string;
};

type SimRes = {
  response: string;
  ended: boolean;
  source: string;
  sessionId: string;
  inspector: Inspector;
};

function parseDisplay(raw: string) {
  const t = raw.trim();
  if (t.toUpperCase().startsWith("CON ")) return { mode: "con" as const, body: t.slice(4) };
  if (t.toUpperCase().startsWith("END ")) return { mode: "end" as const, body: t.slice(4) };
  return { mode: "con" as const, body: t };
}

type ProfileOpt = { id: string; name: string; slug: string };

/** T9-style labels for a realistic dialer (Africa's Talking–style simulator). */
const KEYPAD: { digit: string; letters: string }[] = [
  { digit: "1", letters: "" },
  { digit: "2", letters: "ABC" },
  { digit: "3", letters: "DEF" },
  { digit: "4", letters: "GHI" },
  { digit: "5", letters: "JKL" },
  { digit: "6", letters: "MNO" },
  { digit: "7", letters: "PQRS" },
  { digit: "8", letters: "TUV" },
  { digit: "9", letters: "WXYZ" },
  { digit: "*", letters: "" },
  { digit: "0", letters: "+" },
  { digit: "#", letters: "" },
];

function StatusIcons() {
  return (
    <div className="flex items-center gap-1.5 text-white/95" aria-hidden>
      <svg className="h-3 w-4" viewBox="0 0 16 12" fill="currentColor">
        <rect x="0" y="8" width="3" height="4" rx="0.5" />
        <rect x="4" y="6" width="3" height="6" rx="0.5" />
        <rect x="8" y="4" width="3" height="8" rx="0.5" />
        <rect x="12" y="2" width="3" height="10" rx="0.5" />
      </svg>
      <svg className="h-3 w-4" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.2">
        <path d="M1 9c2-4 12-4 14 0" />
        <path d="M3 6c2.5-2 7.5-2 10 0" />
        <path d="M5 3c2-1 4-1 6 0" />
      </svg>
      <svg className="h-3.5 w-5" viewBox="0 0 20 12" fill="none" stroke="currentColor" strokeWidth="1.3">
        <rect x="1" y="2" width="14" height="8" rx="1.5" />
        <path d="M17 5v2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function PhoneSendIcon() {
  return (
    <svg className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
    </svg>
  );
}

export function SimulatorPage() {
  const token = useAuthStore((s) => s.token);
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
  const [phone, setPhone] = useState("256700000000");
  const [serviceCode, setServiceCode] = useState("*182#");
  /** Cumulative `text` last acknowledged by the backend (Africa's Talking style segments joined by *). */
  const [path, setPath] = useState("");
  /** Current entry buffer — not sent until Send/OK (real handset behavior). */
  const [draft, setDraft] = useState("");
  const [screenText, setScreenText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [ttlLeft, setTtlLeft] = useState(180);

  const inputRef = useRef<HTMLInputElement>(null);

  const [targetMode, setTargetMode] = useState<"inline" | "profile">("inline");
  const [callbackUrl, setCallbackUrl] = useState("http://127.0.0.1:4000/api/examples/mock-ussd");
  const [profiles, setProfiles] = useState<ProfileOpt[]>([]);
  const [profileId, setProfileId] = useState("");

  const [provider, setProvider] = useState("AFRICASTALKING");
  const [delayMs, setDelayMs] = useState(0);
  const [retries, setRetries] = useState(0);
  const [duplicate, setDuplicate] = useState(false);
  const [invalidInput, setInvalidInput] = useState(false);

  const [logLines, setLogLines] = useState<{ ts: string; summary: string; detail: string }[]>([]);
  /** False = lock / home screen; true = USSD session UI (after Connect). */
  const [ussdActive, setUssdActive] = useState(false);
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const statusTime = clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const homeDateLine = clock.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const homeClockLarge = clock.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const canInteract = ussdActive && !busy && !ended && ttlLeft > 0;

  useEffect(() => {
    if (!token) {
      setProfiles([]);
      setProfileId("");
      return;
    }
    const load = async () => {
      try {
        const { data } = await api.get<{ profiles: ProfileOpt[] }>("/api/profiles");
        setProfiles(data.profiles);
        const demo = data.profiles.find((p) => p.slug === "demo-mock");
        if (demo) setProfileId(demo.id);
        else if (data.profiles[0]) setProfileId(data.profiles[0].id);
      } catch {
        setProfiles([]);
      }
    };
    void load();
  }, [token]);

  const dial = async (nextPath: string, overrideSessionId?: string): Promise<boolean> => {
    const sid = overrideSessionId ?? sessionId;
    if (targetMode === "profile") {
      if (!token) {
        setError("Log in to use a saved profile.");
        return false;
      }
      if (!profileId) {
        setError("Select a webhook profile (or switch to Callback URL).");
        return false;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        sessionId: sid,
        phoneNumber: phone,
        serviceCode,
        text: nextPath,
        provider,
        simulation: {
          delayMs: delayMs || undefined,
          retries: retries || undefined,
          duplicate: duplicate || undefined,
          invalidInput: invalidInput || undefined,
        },
      };
      if (targetMode === "profile" && profileId && token) {
        body.profileId = profileId;
      } else {
        body.callbackUrl = callbackUrl;
      }

      const { data } = await api.post<SimRes>("/api/simulate", body);
      setSessionId(data.sessionId);
      const parsed = parseDisplay(data.response);
      setPath(nextPath);
      setDraft("");
      setScreenText(parsed.body);
      setEnded(data.ended || parsed.mode === "end");
      setTtlLeft(180);

      const ins = data.inspector;
      const summary = `${ins.success ? "OK" : "ERR"} ${ins.latencyMs}ms · ${ins.httpStatus ?? "—"} · ${ins.provider}`;
      const detail = JSON.stringify(
        {
          callbackUrl: ins.callbackUrl,
          outgoingPayload: ins.outgoingPayload,
          outgoingHeaders: ins.outgoingHeaders,
          response: data.response,
          errorMessage: ins.errorMessage,
        },
        null,
        2,
      );
      setLogLines((prev) =>
        [{ ts: new Date().toISOString(), summary, detail }, ...prev].slice(0, 40),
      );
      return true;
    } catch (e) {
      if (isAxiosError(e)) {
        setError((e.response?.data as { error?: string })?.error ?? e.message);
      } else {
        setError("Request failed");
      }
      return false;
    } finally {
      setBusy(false);
    }
  };

  /** Undo last committed segment (re-syncs with backend). */
  const popCommittedAndRedial = async () => {
    if (!ussdActive || !canInteract) return;
    const parts = path.split("*").filter(Boolean);
    if (parts.length === 0) return;
    parts.pop();
    const nextPath = parts.join("*");
    await dial(nextPath);
  };

  useEffect(() => {
    if (!ussdActive || ended) return;
    const id = setInterval(() => {
      setTtlLeft((s) => {
        if (s <= 1) {
          setError("Session timeout. Press Cancel or Reset.");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [ended, sessionId, ussdActive]);

  const goHome = () => {
    setUssdActive(false);
    setSessionId(crypto.randomUUID());
    setPath("");
    setDraft("");
    setScreenText("");
    setEnded(false);
    setError(null);
    setTtlLeft(180);
  };

  const connectUssd = async () => {
    setError(null);
    setUssdActive(true);
    setTtlLeft(180);
    const ok = await dial("");
    if (!ok) setUssdActive(false);
  };

  const appendKey = (k: string) => {
    if (!canInteract) return;
    setDraft((d) => d + k);
  };

  const deleteLastChar = () => {
    if (!canInteract) return;
    setDraft((d) => d.slice(0, -1));
  };

  const clearDraft = () => {
    if (!canInteract) return;
    setDraft("");
  };

  /** Commit draft as the next USSD segment (Send / OK). */
  const sendOk = async () => {
    if (!ussdActive || !canInteract) return;
    const segment = draft.trim();
    if (!segment) {
      setError("Type your choice or amount in the field, then press Send.");
      return;
    }
    const nextText = path ? `${path}*${segment}` : segment;
    await dial(nextText);
  };

  /** Leave USSD and return to the home screen (inspector log kept). */
  const cancelSession = () => {
    goHome();
  };

  const reset = () => {
    goHome();
    setLogLines([]);
  };

  const applyAndReconnect = () => {
    goHome();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">USSD Simulator</h1>
        <p className="text-sm text-muted">
          Traffic is forwarded to <strong>your</strong> callback URL (Africa&apos;s Talking style{" "}
          <code className="rounded bg-card px-1">CON</code> / <code className="rounded bg-card px-1">END</code>).
          This gateway does not host your menu logic.
        </p>
        <p className="text-sm text-muted">
          The handset starts on a <strong className="text-foreground">normal home screen</strong> (clock &amp;
          wallpaper). Tap <strong className="text-foreground">Open USSD</strong> to connect—nothing hits your
          callback until then. In USSD, type in the field or keypad; only the <strong className="text-foreground">green
          send</strong> key submits. <strong>Back</strong> removes the last confirmed step. <strong>Delete</strong> /{" "}
          <strong>Clear</strong> edit the draft. On <code className="rounded bg-card px-1">END</code>, tap{" "}
          <strong className="text-foreground">OK</strong> or <strong>Cancel</strong> to return home.{" "}
          <strong>Reset</strong> clears logs. <strong>Apply &amp; reconnect</strong> sends the handset home so you can
          connect again with new settings.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-2xl border border-border bg-card/40 p-4">
          <h2 className="text-sm font-semibold uppercase text-muted">Telecom target</h2>
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="tm"
                checked={targetMode === "inline"}
                onChange={() => setTargetMode("inline")}
              />
              Callback URL
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="tm"
                checked={targetMode === "profile"}
                onChange={() => setTargetMode("profile")}
                disabled={!token}
              />
              Saved profile {token ? "" : "(login)"}
            </label>
          </div>
          {targetMode === "inline" ? (
            <label className="block text-sm">
              <span className="text-muted">Callback URL</span>
              <input
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
                value={callbackUrl}
                onChange={(e) => setCallbackUrl(e.target.value)}
              />
            </label>
          ) : (
            <label className="block text-sm">
              <span className="text-muted">Profile</span>
              <select
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.slug})
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block text-sm">
            <span className="text-muted">Provider format</span>
            <select
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option value="AFRICASTALKING">Africa&apos;s Talking</option>
              <option value="MTN">MTN</option>
              <option value="AIRTEL">Airtel</option>
              <option value="NEXEN">Nexen</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm">
              <span className="text-muted">Phone</span>
              <input
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="text-muted">Service code</span>
              <input
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
                value={serviceCode}
                onChange={(e) => setServiceCode(e.target.value)}
              />
            </label>
          </div>
          <div className="rounded-lg border border-border bg-background/50 p-3 text-xs text-muted">
            <p className="font-medium text-foreground">Simulation</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label>
                Delay (ms)
                <input
                  type="number"
                  className="mt-1 w-full rounded border border-border bg-card px-2 py-1"
                  value={delayMs}
                  onChange={(e) => setDelayMs(Number(e.target.value))}
                  min={0}
                />
              </label>
              <label>
                Retries
                <input
                  type="number"
                  className="mt-1 w-full rounded border border-border bg-card px-2 py-1"
                  value={retries}
                  onChange={(e) => setRetries(Number(e.target.value))}
                  min={0}
                  max={10}
                />
              </label>
            </div>
            <label className="mt-2 flex items-center gap-2">
              <input type="checkbox" checked={duplicate} onChange={(e) => setDuplicate(e.target.checked)} />
              Duplicate request (second round-trip)
            </label>
            <label className="mt-1 flex items-center gap-2">
              <input type="checkbox" checked={invalidInput} onChange={(e) => setInvalidInput(e.target.checked)} />
              Invalid input path (append invalid segment)
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void applyAndReconnect()}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
            >
              Apply &amp; reconnect
            </button>
            <span className="self-center text-xs text-muted">
              Returns handset to home—tap <strong className="text-foreground">Open USSD</strong> to start with new
              settings
            </span>
          </div>
          <div className="rounded-xl border border-border bg-background/60 p-3 text-sm text-muted">
            <div>
              <span className="font-medium text-foreground">Session</span>{" "}
              <code className="break-all">{sessionId}</code>
            </div>
            <div className="mt-2">
              <span className="font-medium text-foreground">Handset</span>{" "}
              <span className="text-foreground">{ussdActive ? "USSD session" : "Home"}</span>
            </div>
            <div className="mt-2">
              <span className="font-medium text-foreground">Sent path</span> <code>{path || "∅"}</code>
            </div>
            <div className="mt-2">
              Timeout{" "}
              <span className="text-foreground">{ussdActive ? `${ttlLeft}s` : "— (not in USSD)"}</span>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[320px]">
          <p className="mb-3 text-center text-xs text-muted">Handset preview (Africa&apos;s Talking–style layout)</p>
          {/* Device chassis */}
          <div className="rounded-[2.75rem] bg-gradient-to-b from-zinc-800 via-zinc-950 to-black p-[10px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] ring-1 ring-zinc-700/80">
            <div className="overflow-hidden rounded-[2.35rem] bg-zinc-950 ring-1 ring-black/60">
              {/* Punch-hole + status */}
              <div className="relative flex h-7 items-center justify-center bg-zinc-950">
                <div className="absolute left-5 top-2 text-[10px] font-medium tabular-nums tracking-wide text-zinc-400">
                  {statusTime}
                </div>
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-950 ring-2 ring-zinc-800" aria-hidden />
                <div className="absolute right-4 top-1.5">
                  <StatusIcons />
                </div>
              </div>
              <div className="flex items-center justify-between bg-zinc-900 px-4 py-1.5 text-[11px] text-zinc-300">
                <span className="truncate font-medium text-zinc-100">
                  {ussdActive ? "USSD Gateway" : "Home"}
                </span>
                <span className="shrink-0 text-zinc-500">{ussdActive ? "VoLTE" : "Wi‑Fi"}</span>
              </div>
              <div className="relative flex min-h-[420px] flex-col bg-[#3d4046]">
                {!ussdActive ? (
                  <>
                    <div className="relative flex flex-1 flex-col overflow-hidden">
                      <div
                        className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(56,189,248,0.22),transparent_55%),radial-gradient(ellipse_at_80%_70%,rgba(167,139,250,0.18),transparent_50%),linear-gradient(165deg,#1e293b_0%,#0f172a_45%,#020617_100%)]"
                        aria-hidden
                      />
                      <div className="relative flex flex-1 flex-col items-center justify-center px-6 pb-6 pt-4 text-center">
                        <p className="text-[3.25rem] font-extralight leading-none tracking-tight text-white tabular-nums drop-shadow-sm sm:text-6xl">
                          {homeClockLarge}
                        </p>
                        <p className="mt-3 text-sm font-medium text-white/75">{homeDateLine}</p>
                        <p className="mt-10 max-w-[14rem] text-xs leading-relaxed text-white/45">
                          USSD stays off until you connect—like opening the dialer on a real phone.
                        </p>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void connectUssd()}
                          className="mt-8 min-h-[48px] w-full max-w-[220px] rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-950/50 ring-2 ring-emerald-400/25 transition hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50"
                        >
                          {busy ? "Connecting…" : "Open USSD"}
                        </button>
                        {error && (
                          <p className="mt-4 max-w-[240px] text-xs font-medium text-red-300" role="alert">
                            {error}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-auto flex justify-center pb-2 pt-1">
                      <div className="h-1 w-28 rounded-full bg-zinc-700/90" aria-hidden />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-1 flex-col items-center justify-center px-3 pb-2 pt-4">
                      <div className="relative w-full max-w-[260px] rounded-xl bg-white p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)] ring-1 ring-black/5">
                        {error && (
                          <p className="mb-2 text-xs font-medium text-red-600" role="alert">
                            {error}
                          </p>
                        )}
                        <div className="min-h-[72px] text-left text-[15px] leading-snug text-zinc-900">
                          {screenText ? (
                            <p className="whitespace-pre-wrap font-sans">{screenText}</p>
                          ) : busy ? (
                            <p className="text-zinc-500">Loading…</p>
                          ) : (
                            <p className="text-zinc-500">Waiting for response…</p>
                          )}
                        </div>
                        {!ended && (
                          <div className="mt-3 border-t border-zinc-200 pt-3">
                            <label className="sr-only" htmlFor="ussd-draft">
                              USSD input — press the green send key when ready
                            </label>
                            <input
                              id="ussd-draft"
                              ref={inputRef}
                              type="text"
                              inputMode="text"
                              autoComplete="off"
                              autoCorrect="off"
                              spellCheck={false}
                              disabled={!canInteract}
                              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 font-mono text-[15px] text-zinc-900 outline-none ring-2 ring-transparent placeholder:text-zinc-400 focus:border-orange-400/60 focus:ring-orange-400/25 disabled:opacity-50"
                              placeholder="Amount, PIN, choice…"
                              value={draft}
                              onChange={(e) => canInteract && setDraft(e.target.value)}
                            />
                          </div>
                        )}
                        {ended && (
                          <div className="mt-4 flex justify-end border-t border-zinc-100 pt-3">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={cancelSession}
                              className="text-sm font-semibold text-orange-500 hover:text-orange-600 disabled:opacity-40"
                            >
                              OK
                            </button>
                          </div>
                        )}
                        {busy && (
                          <div
                            className="pointer-events-none absolute inset-0 flex items-end justify-center rounded-xl bg-white/55 pb-3"
                            aria-live="polite"
                          >
                            <span className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white/95 px-3 py-1.5 text-[11px] font-medium text-zinc-600 shadow-md">
                              <span
                                className="inline-block h-2 w-2 animate-pulse rounded-full bg-orange-500"
                                aria-hidden
                              />
                              Waiting for callback…
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    {!ended && (
                      <>
                        <div className="px-3 pb-1">
                          <div className="mx-auto grid max-w-[280px] grid-cols-3 gap-x-2 gap-y-2">
                            {KEYPAD.map(({ digit, letters }) => (
                              <button
                                key={digit}
                                type="button"
                                disabled={!canInteract}
                                onClick={() => appendKey(digit)}
                                className="flex h-[52px] flex-col items-center justify-center rounded-full bg-zinc-800/95 text-white shadow-inner shadow-black/20 ring-1 ring-white/5 transition hover:bg-zinc-700 active:scale-95 disabled:opacity-35"
                              >
                                <span className="text-[22px] font-light leading-none">{digit}</span>
                                {letters ? (
                                  <span className="mt-0.5 text-[8px] font-medium tracking-[0.12em] text-zinc-400">
                                    {letters}
                                  </span>
                                ) : (
                                  <span className="mt-2 h-2" aria-hidden />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center justify-center gap-6 px-4 pb-2 pt-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={cancelSession}
                            className="text-[11px] font-medium text-zinc-400 underline-offset-2 hover:text-white disabled:opacity-40"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={!canInteract || busy}
                            onClick={() => void sendOk()}
                            title="Send / OK"
                            className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-900/40 ring-2 ring-emerald-400/30 transition hover:bg-emerald-400 active:scale-95 disabled:opacity-40"
                            aria-label={busy ? "Sending" : "Send"}
                          >
                            {busy ? (
                              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            ) : (
                              <PhoneSendIcon />
                            )}
                          </button>
                          <span className="w-10" aria-hidden />
                        </div>
                        <div className="mx-auto flex w-full max-w-[300px] items-stretch gap-3 px-5 pb-4 pt-1 sm:px-8">
                          <button
                            type="button"
                            disabled={!canInteract}
                            onClick={deleteLastChar}
                            className="min-h-[52px] flex-1 rounded-2xl bg-zinc-800/90 py-3.5 text-sm font-semibold text-zinc-100 shadow-inner shadow-black/25 ring-1 ring-white/10 transition hover:bg-zinc-700 active:scale-[0.98] disabled:opacity-35"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            disabled={!canInteract}
                            onClick={clearDraft}
                            className="min-h-[52px] flex-1 rounded-2xl bg-zinc-800/90 py-3.5 text-sm font-semibold text-zinc-100 shadow-inner shadow-black/25 ring-1 ring-white/10 transition hover:bg-zinc-700 active:scale-[0.98] disabled:opacity-35"
                          >
                            Clear
                          </button>
                          <button
                            type="button"
                            disabled={!canInteract || (!path && !draft)}
                            onClick={() => void popCommittedAndRedial()}
                            className="min-h-[52px] flex-1 rounded-2xl bg-zinc-800/90 py-3.5 text-sm font-semibold text-zinc-100 shadow-inner shadow-black/25 ring-1 ring-white/10 transition hover:bg-zinc-700 active:scale-[0.98] disabled:opacity-35 disabled:text-zinc-500"
                          >
                            Back
                          </button>
                        </div>
                      </>
                    )}
                    <div className="mt-auto flex justify-center pb-2 pt-1">
                      <div className="h-1 w-28 rounded-full bg-zinc-700/90" aria-hidden />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="mt-3 w-full rounded-xl border border-border bg-card/60 py-2 text-xs text-muted hover:bg-card"
            disabled={busy}
            onClick={reset}
          >
            Reset session &amp; clear inspector log
          </button>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card/40 p-4">
        <h2 className="text-sm font-semibold uppercase text-muted">Request inspector</h2>
        <ul className="mt-3 max-h-80 space-y-2 overflow-auto text-xs">
          {logLines.map((row, i) => (
            <li key={`${row.ts}-${i}`} className="rounded-lg border border-border bg-background/60 p-2">
              <div className="text-muted">{row.ts}</div>
              <div className="font-medium text-foreground">{row.summary}</div>
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap">{row.detail}</pre>
            </li>
          ))}
          {logLines.length === 0 && <li className="text-muted">No requests yet.</li>}
        </ul>
      </section>
    </div>
  );
}
