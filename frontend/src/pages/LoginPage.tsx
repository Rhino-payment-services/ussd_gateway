import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";

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
      nav("/dashboard/sessions");
    } catch {
      setError("Login failed");
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6 rounded-2xl border border-border bg-card p-6">
      <h1 className="text-xl font-semibold">Login</h1>
      <form className="space-y-4" onSubmit={(e) => void submit(e)}>
        <label className="block text-sm">
          <span className="text-muted">Email</span>
          <input
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Password</span>
          <input
            type="password"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          className="w-full rounded-xl bg-accent py-2 font-medium text-accent-foreground hover:opacity-90"
        >
          Sign in
        </button>
      </form>
      <p className="text-sm text-muted">
        No account?{" "}
        <Link className="text-accent underline" to="/register">
          Register
        </Link>
      </p>
    </div>
  );
}
