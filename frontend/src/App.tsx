import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import { AppShell } from "./components/layout/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { SimulatorPage } from "./pages/SimulatorPage";
import { DashboardLayout } from "./pages/dashboard/DashboardLayout";
import { SessionsPage } from "./pages/dashboard/SessionsPage";
import { LogsPage } from "./pages/dashboard/LogsPage";
import { ApiTestPage } from "./pages/dashboard/ApiTestPage";
import { FlowsPage } from "./pages/dashboard/FlowsPage";
import { FlowBuilderPage } from "./pages/dashboard/FlowBuilderPage";
import { ProfilesPage } from "./pages/dashboard/ProfilesPage";
import { TestingToolsPage } from "./pages/dashboard/TestingToolsPage";
import { MetricsPage } from "./pages/dashboard/MetricsPage";

function Private({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<SimulatorPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/dashboard"
          element={
            <Private>
              <DashboardLayout />
            </Private>
          }
        >
          <Route index element={<Navigate to="metrics" replace />} />
          <Route path="sessions" element={<SessionsPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="api-test" element={<ApiTestPage />} />
          <Route path="flows" element={<FlowsPage />} />
          <Route path="flow-builder" element={<FlowBuilderPage />} />
          <Route path="profiles" element={<ProfilesPage />} />
          <Route path="testing" element={<TestingToolsPage />} />
          <Route path="metrics" element={<MetricsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
