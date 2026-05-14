import { useEffect, useState } from "react";
import { api } from "../../services/api";

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
  const [provider, setProvider] = useState("AFRICASTALKING");
  const [msg, setMsg] = useState<string | null>(null);

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
    await load();
  };

  const remove = async (id: string) => {
    await api.delete(`/api/profiles/${id}`);
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Webhook profiles</h2>
        <p className="text-sm text-muted">
          Save multiple callback URLs (e.g. RukaPay, SACCO, wallet). Use <code className="rounded bg-card px-1">profileId</code>{" "}
          in the simulator when logged in.
        </p>
      </div>
      <ul className="space-y-2">
        {profiles.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
          >
            <div>
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-muted">
                {p.slug} · {p.provider} · {p.httpMethod}
              </div>
              <div className="mt-1 break-all font-mono text-xs">{p.callbackUrl}</div>
            </div>
            <button
              type="button"
              className="rounded-lg border border-border px-2 py-1 text-xs text-danger"
              onClick={() => void remove(p.id)}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
      <div className="rounded-xl border border-border bg-card/60 p-4">
        <h3 className="text-sm font-semibold">New profile</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            className="rounded-lg border border-border bg-background px-2 py-2 text-sm"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="rounded-lg border border-border bg-background px-2 py-2 text-sm"
            placeholder="slug (my-app)"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        </div>
        <input
          className="mt-2 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
          placeholder="https://your-backend.com/ussd"
          value={callbackUrl}
          onChange={(e) => setCallbackUrl(e.target.value)}
        />
        <select
          className="mt-2 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
        >
          <option value="AFRICASTALKING">Africa&apos;s Talking</option>
          <option value="MTN">MTN</option>
          <option value="AIRTEL">Airtel</option>
          <option value="NEXEN">Nexen</option>
          <option value="CUSTOM">Custom</option>
        </select>
        <button
          type="button"
          className="mt-3 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
          onClick={() => void create().catch(() => setMsg("Create failed (unique slug?)"))}
        >
          Create
        </button>
        {msg && <p className="mt-2 text-sm text-accent">{msg}</p>}
      </div>
    </div>
  );
}
