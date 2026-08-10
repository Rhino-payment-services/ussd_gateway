import { Outlet } from "react-router-dom";

/** Pass-through — chrome lives in AppShell. Kept for route nesting. */
export function DashboardLayout() {
  return <Outlet />;
}
