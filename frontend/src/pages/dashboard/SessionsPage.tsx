import { useEffect, useState } from "react";
import { api } from "../../services/api";

type SessionState = {
  sessionId: string;
  phoneNumber: string;
  serviceCode: string;
  currentStep: string;
  previousInputs: string[];
  menuHistory: string[];
  startedAt: string;
};

export function SessionsPage() {
  const [sessions, setSessions] = useState<SessionState[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get<{ sessions: SessionState[] }>("/api/sessions/active");
        setSessions(data.sessions);
        setError(null);
      } catch {
        setError("Failed to load sessions");
      }
    };
    void load();
    const id = setInterval(() => void load(), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Active Redis sessions</h2>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="overflow-auto rounded-xl border border-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-card text-muted">
            <tr>
              <th className="px-3 py-2">Session</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Step</th>
              <th className="px-3 py-2">Path</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.sessionId} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs">{s.sessionId.slice(0, 8)}…</td>
                <td className="px-3 py-2">{s.phoneNumber}</td>
                <td className="px-3 py-2">{s.serviceCode}</td>
                <td className="px-3 py-2">{s.currentStep}</td>
                <td className="px-3 py-2 font-mono text-xs">{s.previousInputs.join("*") || "—"}</td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-muted" colSpan={5}>
                  No active sessions. Open the simulator to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
