import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Panel, PanelBody } from "../components/ui/panel";

export function LoginPage() {
  const nav = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("demo@ussd.local");
  const [password, setPassword] = useState("demo-password");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const { data } = await api.post<{ token: string; user: { email: string } }>("/api/auth/login", {
        email,
        password,
      });
      setAuth(data.token, data.user.email);
      nav("/dashboard/metrics");
    } catch {
      setError("Login failed");
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
            <h1 className="text-lg font-semibold">Sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">Access metrics, profiles, and testing tools.</p>
          </div>
          <form className="space-y-3" onSubmit={(e) => void submit(e)}>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            No account?{" "}
            <Link className="font-medium text-primary hover:underline" to="/register">
              Register
            </Link>
          </p>
        </PanelBody>
      </Panel>
    </div>
  );
}
