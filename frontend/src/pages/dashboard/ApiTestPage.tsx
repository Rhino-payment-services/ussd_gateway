import { useState } from "react";
import { isAxiosError } from "axios";
import { api } from "../../services/api";
import { PageHeader } from "../../components/ui/page-header";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "../../components/ui/panel";

export function ApiTestPage() {
  const [body, setBody] = useState(
    JSON.stringify(
      {
        phoneNumber: "256700000000",
        serviceCode: "*182#",
        text: "",
        callbackUrl: "http://127.0.0.1:4000/api/examples/mock-ussd",
        provider: "DIALFORGE",
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
    <div>
      <PageHeader
        title="API testing"
        description="POST /api/simulate with a raw JSON body. JWT is attached when logged in."
        actions={
          <Button size="sm" type="button" onClick={() => void send()}>
            Send request
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <PanelTitle>Request</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <Textarea className="min-h-[320px]" value={body} onChange={(e) => setBody(e.target.value)} />
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader>
            <PanelTitle>Response</PanelTitle>
          </PanelHeader>
          <PanelBody>
            {error ? (
              <pre className="whitespace-pre-wrap font-mono text-xs text-danger">{error}</pre>
            ) : out ? (
              <pre className="max-h-[400px] overflow-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">{out}</pre>
            ) : (
              <p className="text-sm text-muted-foreground">Send a request to see the response.</p>
            )}
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
