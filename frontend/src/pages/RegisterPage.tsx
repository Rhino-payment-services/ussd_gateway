import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Panel, PanelBody } from "../components/ui/panel";

export function RegisterPage() {
  const nav = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const { data } = await api.post<{ token: string; user: { email: string } }>("/api/auth/register", {
        email,
        password,
        name: name || undefined,
      });
      setAuth(data.token, data.user.email);
      nav("/dashboard/metrics");
    } catch {
      setError("Registration failed (email taken or weak password).");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <Link to="/" className="mb-8 text-lg font-semibold tracking-tight">
        Dial<span className="text-primary">Forge</span>
      </Link>
      <Panel className="w-full max-w-sm">
        <PanelBody className="space-y-5 p-6">
          <div>
            <h1 className="text-lg font-semibold">Create account</h1>
            <p className="mt-1 text-sm text-muted-foreground">Save webhook profiles and view session history.</p>
          </div>
          <form className="space-y-3" onSubmit={(e) => void submit(e)}>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password (min 8)</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" className="w-full">
              Register
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link className="font-medium text-primary hover:underline" to="/login">
              Sign in
            </Link>
          </p>
        </PanelBody>
      </Panel>
    </div>
  );
}
