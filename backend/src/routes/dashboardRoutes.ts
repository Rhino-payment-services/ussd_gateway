import { Router } from "express";
import { requireAuth, optionalAuth } from "../middleware/authMiddleware.js";
import { listActiveSessions } from "../controllers/sessionController.js";
import { listLogs } from "../controllers/logsController.js";
import {
  listFlows,
  getFlow,
  createFlow,
  updateFlow,
  deleteFlow,
  getStarter,
  runFlow,
} from "../controllers/flowController.js";
import {
  listProfiles,
  getProfile,
  createProfile,
  updateProfile,
  deleteProfile,
} from "../controllers/profileController.js";
import {
  exportMetricsCsv,
  getMetricsBundle,
  getMetricsHealth,
  getMetricsSessions,
} from "../controllers/metricsController.js";

export const dashboardRouter = Router();

dashboardRouter.get("/sessions/active", requireAuth, listActiveSessions);
dashboardRouter.get("/logs", requireAuth, listLogs);
dashboardRouter.get("/metrics/bundle", requireAuth, getMetricsBundle);
dashboardRouter.get("/metrics/sessions", requireAuth, getMetricsSessions);
dashboardRouter.get("/metrics/export", requireAuth, exportMetricsCsv);
dashboardRouter.get("/metrics/health", requireAuth, getMetricsHealth);

dashboardRouter.get("/flows/starter", getStarter);
dashboardRouter.post("/flows/run", optionalAuth, runFlow);
dashboardRouter.get("/flows", requireAuth, listFlows);
dashboardRouter.get("/flows/:id", requireAuth, getFlow);
dashboardRouter.post("/flows", requireAuth, createFlow);
dashboardRouter.put("/flows/:id", requireAuth, updateFlow);
dashboardRouter.delete("/flows/:id", requireAuth, deleteFlow);

dashboardRouter.get("/profiles", requireAuth, listProfiles);
dashboardRouter.get("/profiles/:id", requireAuth, getProfile);
dashboardRouter.post("/profiles", requireAuth, createProfile);
dashboardRouter.put("/profiles/:id", requireAuth, updateProfile);
dashboardRouter.delete("/profiles/:id", requireAuth, deleteProfile);
