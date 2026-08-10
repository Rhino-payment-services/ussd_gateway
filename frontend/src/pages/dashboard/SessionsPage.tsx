import { useEffect, useState } from "react";
import { api } from "../../services/api";
import { PageHeader } from "../../components/ui/page-header";
import { Table, THead, TBody, TR, TH, TD } from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { EmptyState } from "../../components/ui/empty-state";

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
    <div>
      <PageHeader
        title="Active sessions"
        description="Live Redis sessions. Refreshes every 5 seconds."
        actions={<Badge variant="accent">{sessions.length} active</Badge>}
      />
      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
      {sessions.length === 0 && !error ? (
        <EmptyState title="No active sessions" description="Open the simulator to create one." />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Session</TH>
              <TH>Phone</TH>
              <TH>Code</TH>
              <TH>Step</TH>
              <TH>Path</TH>
            </TR>
          </THead>
          <TBody>
            {sessions.map((s) => (
              <TR key={s.sessionId}>
                <TD className="font-mono text-xs">{s.sessionId.slice(0, 8)}…</TD>
                <TD>{s.phoneNumber}</TD>
                <TD>{s.serviceCode}</TD>
                <TD>{s.currentStep}</TD>
                <TD className="font-mono text-xs">{s.previousInputs.join("*") || "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
