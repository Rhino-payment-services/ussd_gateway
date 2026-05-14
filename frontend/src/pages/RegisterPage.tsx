import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";

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
      nav("/dashboard/sessions");
    } catch {
      setError("Registration failed (email taken or weak password).");
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6 rounded-2xl border border-border bg-card p-6">
      <h1 className="text-xl font-semibold">Create account</h1>
      <form className="space-y-4" onSubmit={(e) => void submit(e)}>
        <label className="block text-sm">
          <span className="text-muted">Name</span>
          <input
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Email</span>
          <input
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            type="email"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Password (min 8)</span>
          <input
            type="password"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          className="w-full rounded-xl bg-accent py-2 font-medium text-accent-foreground hover:opacity-90"
        >
          Register
        </button>
      </form>
      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link className="text-accent underline" to="/login">
          Login
        </Link>
      </p>
    </div>
  );
}
