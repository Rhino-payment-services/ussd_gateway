import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useThemeStore } from "../../store/themeStore";
import { useAuthStore } from "../../store/authStore";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

type NavItem = { to: string; label: string; end?: boolean };
type NavGroup = { label: string; items: NavItem[]; requireAuth?: boolean };

const groups: NavGroup[] = [
  {
    label: "Workspace",
    items: [{ to: "/", label: "Simulator", end: true }],
  },
  {
    label: "Observe",
    requireAuth: true,
    items: [
      { to: "/dashboard/metrics", label: "Metrics" },
      { to: "/dashboard/sessions", label: "Sessions" },
      { to: "/dashboard/logs", label: "Logs" },
    ],
  },
  {
    label: "Build",
    requireAuth: true,
    items: [
      { to: "/dashboard/flow-builder", label: "Flow builder" },
      { to: "/dashboard/flows", label: "Saved flows" },
    ],
  },
  {
    label: "Test",
    requireAuth: true,
    items: [
      { to: "/dashboard/api-test", label: "API testing" },
      { to: "/dashboard/testing", label: "Testing tools" },
    ],
  },
  {
    label: "Configure",
    requireAuth: true,
    items: [{ to: "/dashboard/profiles", label: "Webhook profiles" }],
  },
];

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    "block rounded-lg px-2.5 py-1.5 text-sm transition",
    isActive
      ? "bg-sidebar-accent text-foreground font-medium"
      : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-foreground",
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const token = useAuthStore((s) => s.token);
  const email = useAuthStore((s) => s.email);
  const logout = useAuthStore((s) => s.logout);
  const { theme, toggle } = useThemeStore();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <Link to="/" className="text-sm font-semibold tracking-tight" onClick={onNavigate}>
          Dial<span className="text-primary">Forge</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {groups.map((g) => {
          if (g.requireAuth && !token) return null;
          return (
            <div key={g.label}>
              <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {g.label}
              </p>
              <div className="space-y-0.5">
                {g.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={navClass}
                    onClick={onNavigate}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}

        {!token ? (
          <div>
            <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Account
            </p>
            <div className="space-y-0.5">
              <NavLink to="/login" className={navClass} onClick={onNavigate}>
                Login
              </NavLink>
              <NavLink to="/register" className={navClass} onClick={onNavigate}>
                Register
              </NavLink>
            </div>
          </div>
        ) : null}
      </nav>

      <div className="space-y-2 border-t border-sidebar-border p-3">
        {token ? (
          <div className="rounded-lg bg-sidebar-accent/50 px-2.5 py-2">
            <p className="truncate text-xs text-muted-foreground">Signed in</p>
            <p className="truncate text-sm font-medium">{email}</p>
          </div>
        ) : null}
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" className="flex-1" onClick={toggle} type="button">
            {theme === "dark" ? "Light" : "Dark"}
          </Button>
          {token ? (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              type="button"
              onClick={() => {
                logout();
                onNavigate?.();
              }}
            >
              Logout
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function AppShell() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isAuthPage = location.pathname === "/login" || location.pathname === "/register";

  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
        <SidebarNav />
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <aside className="relative z-50 h-full w-64 border-r border-sidebar-border bg-sidebar shadow-xl">
            <SidebarNav onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur lg:hidden">
          <Button variant="ghost" size="icon" type="button" onClick={() => setOpen(true)} aria-label="Open menu">
            <span className="text-lg leading-none">☰</span>
          </Button>
          <Link to="/" className="text-sm font-semibold">
            Dial<span className="text-primary">Forge</span>
          </Link>
        </header>
        <main className="flex-1 overflow-x-hidden p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
