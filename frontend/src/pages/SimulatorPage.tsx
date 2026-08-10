import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/native-select";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "../components/ui/panel";
import { PageHeader } from "../components/ui/page-header";
import { Badge } from "../components/ui/badge";
import { EmptyState } from "../components/ui/empty-state";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";
import { cn } from "../lib/utils";

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
  const [path, setPath] = useState("");
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

  const [provider, setProvider] = useState("DIALFORGE");
  const [delayMs, setDelayMs] = useState(0);
  const [retries, setRetries] = useState(0);
  const [duplicate, setDuplicate] = useState(false);
  const [invalidInput, setInvalidInput] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showTargetDrawer, setShowTargetDrawer] = useState(false);
  const [showSimKnobs, setShowSimKnobs] = useState(false);
  const [expandedLog, setExpandedLog] = useState<number | null>(0);

  const [logLines, setLogLines] = useState<{ ts: string; summary: string; detail: string; ok: boolean }[]>([]);
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

  const providerLabel =
    (
      {
        DIALFORGE: "DialForge",
        MTN: "MTN",
        AIRTEL: "Airtel",
        NEXEN: "Nexen",
        CUSTOM: "Custom",
      } as Record<string, string>
    )[provider] ?? provider;

  const targetSummary =
    targetMode === "profile"
      ? profiles.find((p) => p.id === profileId)?.name ?? "Profile"
      : callbackUrl.replace(/^https?:\/\//, "").slice(0, 36) +
        (callbackUrl.replace(/^https?:\/\//, "").length > 36 ? "…" : "");

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
      const summary = `${ins.success ? "OK" : "ERR"} · ${ins.latencyMs}ms · ${ins.httpStatus ?? "—"} · ${ins.provider}`;
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
        [{ ts: new Date().toISOString(), summary, detail, ok: ins.success }, ...prev].slice(0, 40),
      );
      setExpandedLog(0);
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

  const popCommittedAndRedial = async () => {
    if (!ussdActive || !canInteract) return;
    const parts = path.split("*").filter(Boolean);
    if (parts.length === 0) return;
    parts.pop();
    await dial(parts.join("*"));
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

  const sendOk = async () => {
    if (!ussdActive || !canInteract) return;
    const segment = draft.trim();
    if (!segment) {
      setError("Type your choice or amount in the field, then press Send.");
      return;
    }
    await dial(path ? `${path}*${segment}` : segment);
  };

  const cancelSession = () => goHome();

  const reset = () => {
    goHome();
    setLogLines([]);
  };

  const applyAndClose = () => {
    goHome();
    setShowTargetDrawer(false);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Simulator"
        description="Forward USSD traffic to your callback. Responses must start with CON or END."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" type="button" onClick={() => setShowTargetDrawer(true)}>
              Configure target
            </Button>
            <Button variant="ghost" size="sm" type="button" onClick={() => setShowHelp((v) => !v)}>
              {showHelp ? "Hide help" : "How it works"}
            </Button>
          </div>
        }
      />

      {showHelp ? (
        <Panel>
          <PanelBody className="space-y-2 text-sm text-muted-foreground">
            <p>
              Use Configure target to set a callback URL (or saved profile), then open USSD on the handset. Only
              the green Send key submits input. Back removes the last confirmed step.
            </p>
            <p>
              Your backend must return plain text starting with <code className="text-foreground">CON </code> or{" "}
              <code className="text-foreground">END </code>.
            </p>
          </PanelBody>
        </Panel>
      ) : null}

      {/* Status strip */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        <span>
          Handset{" "}
          <Badge variant={ussdActive ? "accent" : "default"} className="ml-1">
            {ussdActive ? "USSD" : "Home"}
          </Badge>
        </span>
        <button
          type="button"
          className="max-w-[min(100%,280px)] truncate text-left hover:text-foreground"
          title={targetMode === "inline" ? callbackUrl : targetSummary}
          onClick={() => setShowTargetDrawer(true)}
        >
          Target <span className="text-foreground">{providerLabel}</span>
          <span className="mx-1 text-border">·</span>
          <code className="text-foreground">{targetSummary}</code>
        </button>
        <span>
          Path <code className="text-foreground">{path || "∅"}</code>
        </span>
        <span>TTL {ussdActive ? `${ttlLeft}s` : "—"}</span>
        <span className="truncate font-mono text-[10px]" title={sessionId}>
          {sessionId.slice(0, 8)}…
        </span>
      </div>

      <Sheet open={showTargetDrawer} onOpenChange={setShowTargetDrawer}>
        <SheetContent side="left" className="w-full gap-0 overflow-y-auto sm:max-w-md">
          <SheetHeader className="border-b border-border">
            <SheetTitle>Target</SheetTitle>
            <SheetDescription>
              Callback, provider, and handset identity used for simulated USSD traffic.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 p-4">
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                className={cn(
                  "rounded-md px-2.5 py-1.5 font-medium transition",
                  targetMode === "inline"
                    ? "bg-sidebar-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setTargetMode("inline")}
              >
                Callback URL
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-md px-2.5 py-1.5 font-medium transition disabled:opacity-40",
                  targetMode === "profile"
                    ? "bg-sidebar-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setTargetMode("profile")}
                disabled={!token}
              >
                Profile
              </button>
            </div>

            {targetMode === "inline" ? (
              <div>
                <Label>Callback URL</Label>
                <Input
                  className="font-mono text-xs"
                  value={callbackUrl}
                  onChange={(e) => setCallbackUrl(e.target.value)}
                />
              </div>
            ) : (
              <div>
                <Label>Profile</Label>
                <Select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.slug})
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div>
              <Label>Provider</Label>
              <Select value={provider} onChange={(e) => setProvider(e.target.value)}>
                <option value="DIALFORGE">DialForge</option>
                <option value="MTN">MTN</option>
                <option value="AIRTEL">Airtel</option>
                <option value="NEXEN">Nexen</option>
                <option value="CUSTOM">Custom</option>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div>
                <Label>Service code</Label>
                <Input value={serviceCode} onChange={(e) => setServiceCode(e.target.value)} />
              </div>
            </div>

            <button
              type="button"
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setShowSimKnobs((v) => !v)}
            >
              {showSimKnobs ? "Hide simulation options" : "Simulation options"}
            </button>

            {showSimKnobs ? (
              <div className="space-y-2 rounded-lg border border-border-subtle bg-background/50 p-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Delay (ms)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={delayMs}
                      onChange={(e) => setDelayMs(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>Retries</Label>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      value={retries}
                      onChange={(e) => setRetries(Number(e.target.value))}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-muted-foreground">
                  <input type="checkbox" checked={duplicate} onChange={(e) => setDuplicate(e.target.checked)} />
                  Duplicate request
                </label>
                <label className="flex items-center gap-2 text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={invalidInput}
                    onChange={(e) => setInvalidInput(e.target.checked)}
                  />
                  Invalid input path
                </label>
              </div>
            ) : null}
          </div>

          <SheetFooter className="border-t border-border">
            <Button type="button" variant="secondary" className="w-full" disabled={busy} onClick={applyAndClose}>
              Apply &amp; reconnect
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <div className="grid gap-4 xl:grid-cols-[minmax(320px,380px)_1fr]">
        {/* Handset */}
        <div className="mx-auto w-full max-w-[360px] xl:mx-0">
          <div className="rounded-[2.75rem] bg-gradient-to-b from-zinc-800 via-zinc-950 to-black p-[10px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] ring-1 ring-zinc-700/80">
            <div className="overflow-hidden rounded-[2.35rem] bg-zinc-950 ring-1 ring-black/60">
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
                  {ussdActive ? "DialForge" : "Home"}
                </span>
                <span className="shrink-0 text-zinc-500">{ussdActive ? "VoLTE" : "Wi‑Fi"}</span>
              </div>
              <div className="relative flex min-h-[360px] flex-col bg-[#3d4046]">
                {!ussdActive ? (
                  <>
                    <div className="relative flex flex-1 flex-col overflow-hidden">
                      <div
                        className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(56,189,248,0.22),transparent_55%),radial-gradient(ellipse_at_80%_70%,rgba(34,197,94,0.12),transparent_50%),linear-gradient(165deg,#1e293b_0%,#0f172a_45%,#020617_100%)]"
                        aria-hidden
                      />
                      <div className="relative flex flex-1 flex-col items-center justify-center px-6 pb-4 pt-3 text-center">
                        <p className="text-[3.25rem] font-extralight leading-none tracking-tight text-white tabular-nums drop-shadow-sm sm:text-6xl">
                          {homeClockLarge}
                        </p>
                        <p className="mt-3 text-sm font-medium text-white/75">{homeDateLine}</p>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void connectUssd()}
                          className="mt-8 min-h-[48px] w-full max-w-[220px] rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-950/50 ring-2 ring-emerald-400/25 transition hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50"
                        >
                          {busy ? "Connecting…" : "Open USSD"}
                        </button>
                        {error ? (
                          <p className="mt-4 max-w-[240px] text-xs font-medium text-red-300" role="alert">
                            {error}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-auto flex justify-center pb-2 pt-1">
                      <div className="h-1 w-28 rounded-full bg-zinc-700/90" aria-hidden />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-1 flex-col items-center justify-center px-3 pb-1 pt-2">
                      <div className="relative w-full max-w-[300px] rounded-xl bg-white p-3 shadow-[0_12px_40px_rgba(0,0,0,0.35)] ring-1 ring-black/5">
                        {error ? (
                          <p className="mb-2 text-xs font-medium text-red-600" role="alert">
                            {error}
                          </p>
                        ) : null}
                        <div className="min-h-[56px] text-left text-[15px] leading-snug text-zinc-900">
                          {screenText ? (
                            <p className="whitespace-pre-wrap font-sans">{screenText}</p>
                          ) : busy ? (
                            <p className="text-zinc-500">Loading…</p>
                          ) : (
                            <p className="text-zinc-500">Waiting for response…</p>
                          )}
                        </div>
                        {!ended ? (
                          <div className="mt-2 border-t border-zinc-200 pt-2">
                            <label className="sr-only" htmlFor="ussd-draft">
                              USSD input
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
                              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-[15px] text-zinc-900 outline-none ring-2 ring-transparent placeholder:text-zinc-400 focus:border-orange-400/60 focus:ring-orange-400/25 disabled:opacity-50"
                              placeholder="Amount, PIN, choice…"
                              value={draft}
                              onChange={(e) => canInteract && setDraft(e.target.value)}
                            />
                          </div>
                        ) : null}
                        {ended ? (
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
                        ) : null}
                        {busy ? (
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
                        ) : null}
                      </div>
                    </div>
                    {!ended ? (
                      <>
                        <div className="px-3 pb-1">
                          <div className="mx-auto grid max-w-[320px] grid-cols-3 gap-x-2 gap-y-1.5">
                            {KEYPAD.map(({ digit, letters }) => (
                              <button
                                key={digit}
                                type="button"
                                disabled={!canInteract}
                                onClick={() => appendKey(digit)}
                                className="flex h-[46px] flex-col items-center justify-center rounded-full bg-zinc-800/95 text-white shadow-inner shadow-black/20 ring-1 ring-white/5 transition hover:bg-zinc-700 active:scale-95 disabled:opacity-35"
                              >
                                <span className="text-[20px] font-light leading-none">{digit}</span>
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
                        <div className="flex items-center justify-center gap-6 px-4 pb-1 pt-0.5">
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
                            className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-900/40 ring-2 ring-emerald-400/30 transition hover:bg-emerald-400 active:scale-95 disabled:opacity-40"
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
                        <div className="mx-auto flex w-full max-w-[340px] items-stretch gap-3 px-5 pb-3 pt-0.5 sm:px-8">
                          <button
                            type="button"
                            disabled={!canInteract}
                            onClick={deleteLastChar}
                            className="min-h-[42px] flex-1 rounded-2xl bg-zinc-800/90 py-2.5 text-sm font-semibold text-zinc-100 shadow-inner shadow-black/25 ring-1 ring-white/10 transition hover:bg-zinc-700 active:scale-[0.98] disabled:opacity-35"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            disabled={!canInteract}
                            onClick={clearDraft}
                            className="min-h-[42px] flex-1 rounded-2xl bg-zinc-800/90 py-2.5 text-sm font-semibold text-zinc-100 shadow-inner shadow-black/25 ring-1 ring-white/10 transition hover:bg-zinc-700 active:scale-[0.98] disabled:opacity-35"
                          >
                            Clear
                          </button>
                          <button
                            type="button"
                            disabled={!canInteract || (!path && !draft)}
                            onClick={() => void popCommittedAndRedial()}
                            className="min-h-[42px] flex-1 rounded-2xl bg-zinc-800/90 py-2.5 text-sm font-semibold text-zinc-100 shadow-inner shadow-black/25 ring-1 ring-white/10 transition hover:bg-zinc-700 active:scale-[0.98] disabled:opacity-35 disabled:text-zinc-500"
                          >
                            Back
                          </button>
                        </div>
                      </>
                    ) : null}
                    <div className="mt-auto flex justify-center pb-2 pt-1">
                      <div className="h-1 w-28 rounded-full bg-zinc-700/90" aria-hidden />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          <Button variant="outline" className="mt-3 w-full" size="sm" disabled={busy} onClick={reset} type="button">
            Reset session &amp; clear log
          </Button>
        </div>

        {/* Inspector */}
        <Panel className="flex max-h-[720px] min-h-[280px] flex-col xl:min-h-0">
          <PanelHeader>
            <PanelTitle>Inspector</PanelTitle>
            <span className="text-[10px] text-muted-foreground">{logLines.length} requests</span>
          </PanelHeader>
          <PanelBody className="flex-1 space-y-1 overflow-y-auto p-2">
            {logLines.length === 0 ? (
              <EmptyState
                title="No requests yet"
                description="Open USSD on the handset to see outbound payloads and responses."
                className="border-0 py-10"
              />
            ) : (
              logLines.map((row, i) => (
                <div key={`${row.ts}-${i}`} className="rounded-lg border border-border-subtle">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-sidebar-accent/40"
                    onClick={() => setExpandedLog(expandedLog === i ? null : i)}
                  >
                    <span className="min-w-0 truncate">
                      <Badge variant={row.ok ? "success" : "danger"} className="mr-2">
                        {row.ok ? "OK" : "ERR"}
                      </Badge>
                      <span className="text-muted-foreground">{row.ts.slice(11, 19)}</span>
                      <span className="ml-2 text-foreground">{row.summary.replace(/^(OK|ERR)\s*·\s*/, "")}</span>
                    </span>
                    <span className="shrink-0 text-muted-foreground">{expandedLog === i ? "−" : "+"}</span>
                  </button>
                  {expandedLog === i ? (
                    <pre className="max-h-56 overflow-auto border-t border-border-subtle bg-background/60 p-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
                      {row.detail}
                    </pre>
                  ) : null}
                </div>
              ))
            )}
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
