import { useEffect, useState } from "react";
import { api } from "../../services/api";
import { PageHeader } from "../../components/ui/page-header";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select } from "../../components/ui/native-select";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "../../components/ui/panel";
import { EmptyState } from "../../components/ui/empty-state";
import { Badge } from "../../components/ui/badge";

type Profile = {
  id: string;
  name: string;
  slug: string;
  callbackUrl: string;
  httpMethod: string;
  provider: string;
  hasAuthToken?: boolean;
};

export function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [callbackUrl, setCallbackUrl] = useState("https://");
  const [provider, setProvider] = useState("DIALFORGE");
  const [msg, setMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const { data } = await api.get<{ profiles: Profile[] }>("/api/profiles");
    setProfiles(data.profiles);
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    setMsg(null);
    await api.post("/api/profiles", {
      name,
      slug,
      callbackUrl,
      provider,
      httpMethod: "POST",
      headers: {},
      authScheme: "none",
      payloadMapping: {},
      responseType: "plain",
    });
    setName("");
    setSlug("");
    setCallbackUrl("https://");
    setMsg("Profile created");
    setShowForm(false);
    await load();
  };

  const remove = async (id: string) => {
    await api.delete(`/api/profiles/${id}`);
    await load();
  };

  return (
    <div>
      <PageHeader
        title="Webhook profiles"
        description="Saved callbacks for the simulator when logged in."
        actions={
          <Button size="sm" type="button" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "New profile"}
          </Button>
        }
      />

      {showForm ? (
        <Panel className="mb-6">
          <PanelHeader>
            <PanelTitle>New profile</PanelTitle>
          </PanelHeader>
          <PanelBody className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="RukaPay" />
            </div>
            <div>
              <Label>Slug</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="rukapay" />
            </div>
            <div className="sm:col-span-2">
              <Label>Callback URL</Label>
              <Input
                className="font-mono text-xs"
                value={callbackUrl}
                onChange={(e) => setCallbackUrl(e.target.value)}
              />
            </div>
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
            <div className="flex items-end">
              <Button
                type="button"
                onClick={() => void create().catch(() => setMsg("Create failed (unique slug?)"))}
              >
                Create
              </Button>
            </div>
            {msg ? <p className="text-sm text-primary sm:col-span-2">{msg}</p> : null}
          </PanelBody>
        </Panel>
      ) : null}

      {profiles.length === 0 ? (
        <EmptyState
          title="No profiles yet"
          description="Create a webhook profile to reuse callbacks in the simulator."
          action={
            <Button size="sm" type="button" onClick={() => setShowForm(true)}>
              New profile
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {profiles.map((p) => (
            <Panel key={p.id}>
              <PanelBody className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{p.name}</span>
                    <Badge>{p.provider}</Badge>
                    <Badge>{p.httpMethod}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{p.slug}</div>
                  <div className="mt-1 break-all font-mono text-xs text-muted-foreground">{p.callbackUrl}</div>
                </div>
                <Button variant="destructive" size="sm" type="button" onClick={() => void remove(p.id)}>
                  Delete
                </Button>
              </PanelBody>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
