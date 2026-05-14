import { useState } from "react";
import { isAxiosError } from "axios";
import { api } from "../../services/api";

export function ApiTestPage() {
  const [body, setBody] = useState(
    JSON.stringify(
      {
        phoneNumber: "256700000000",
        serviceCode: "*182#",
        text: "",
        callbackUrl: "http://127.0.0.1:4000/api/examples/mock-ussd",
        provider: "AFRICASTALKING",
      },
      null,
      2,
    ),
  );
  const [out, setOut] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setError(null);
    setOut("");
    try {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      const { data } = await api.post("/api/simulate", parsed);
      setOut(JSON.stringify(data, null, 2));
    } catch (e) {
      if (isAxiosError(e)) {
        setError(JSON.stringify(e.response?.data ?? e.message, null, 2));
      } else {
        setError("Invalid JSON or network error");
      }
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">API testing (Axios)</h2>
      <p className="text-sm text-muted">
        POST <code className="rounded bg-card px-1">/api/simulate</code> forwards to your callback. JWT is sent automatically
        when logged in (for <code className="rounded bg-card px-1">profileId</code>).
      </p>
      <textarea
        className="h-64 w-full rounded-xl border border-border bg-background p-3 font-mono text-xs"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <button
        type="button"
        onClick={() => void send()}
        className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
      >
        Send request
      </button>
      {error && (
        <pre className="rounded-xl border border-danger/40 bg-card p-3 text-xs text-danger whitespace-pre-wrap">
          {error}
        </pre>
      )}
      {out && (
        <pre className="rounded-xl border border-border bg-card p-3 text-xs whitespace-pre-wrap">{out}</pre>
      )}
    </div>
  );
}
