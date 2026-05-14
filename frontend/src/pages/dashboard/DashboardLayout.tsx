import { NavLink, Outlet } from "react-router-dom";

const sub = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm ${isActive ? "bg-accent text-accent-foreground" : "hover:bg-card"}`;

export function DashboardLayout() {
  return (
    <div className="grid gap-6 lg:grid-cols-[220px,1fr]">
      <aside className="rounded-2xl border border-border bg-card p-3">
        <p className="mb-2 px-2 text-xs font-semibold uppercase text-muted">Dashboard</p>
        <nav className="space-y-1">
          <NavLink to="/dashboard/metrics" className={sub}>
            Metrics &amp; analytics
          </NavLink>
          <NavLink to="/dashboard/sessions" className={sub}>
            Active sessions
          </NavLink>
          <NavLink to="/dashboard/logs" className={sub}>
            Session logs
          </NavLink>
          <NavLink to="/dashboard/api-test" className={sub}>
            API testing
          </NavLink>
          <NavLink to="/dashboard/flows" className={sub}>
            Saved flows
          </NavLink>
          <NavLink to="/dashboard/flow-builder" className={sub}>
            Flow builder
          </NavLink>
          <NavLink to="/dashboard/profiles" className={sub}>
            Webhook profiles
          </NavLink>
          <NavLink to="/dashboard/testing" className={sub}>
            Testing tools
          </NavLink>
        </nav>
      </aside>
      <section className="min-h-[320px] rounded-2xl border border-border bg-card/40 p-4">
        <Outlet />
      </section>
    </div>
  );
}
