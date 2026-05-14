import { Link, NavLink, Outlet } from "react-router-dom";
import { useThemeStore } from "../../store/themeStore";
import { useAuthStore } from "../../store/authStore";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
  }`;

export function AppShell() {
  const { theme, toggle } = useThemeStore();
  const { token, email, logout } = useAuthStore();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            USSD<span className="text-accent">Sandbox</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-2">
            <NavLink to="/" className={linkClass} end>
              Simulator
            </NavLink>
            {token ? (
              <>
                <NavLink to="/dashboard/sessions" className={linkClass}>
                  Dashboard
                </NavLink>
                <span className="hidden text-sm text-muted sm:inline">{email}</span>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-card"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={linkClass}>
                  Login
                </NavLink>
                <NavLink to="/register" className={linkClass}>
                  Register
                </NavLink>
              </>
            )}
            <button
              type="button"
              onClick={toggle}
              className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-card"
              title="Toggle theme"
            >
              {theme === "dark" ? "Light" : "Dark"}
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
