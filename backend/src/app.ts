import express from "express";
import cors from "cors";
import helmet from "helmet";
import { corsOrigins, env } from "./config/env.js";
import { mountSwagger } from "./config/swagger.js";
import { errorMiddleware } from "./middleware/errorMiddleware.js";
import { authRouter } from "./routes/authRoutes.js";
import { ussdRouter } from "./routes/ussdRoutes.js";
import { simulateRouter } from "./routes/simulateRoutes.js";
import { examplesRouter } from "./routes/examplesRoutes.js";
import { dashboardRouter } from "./routes/dashboardRoutes.js";
import { redisPing } from "./redis/redisManager.js";

export const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: corsOrigins(),
    credentials: true,
  }),
);
app.use(express.json({ limit: "256kb" }));

mountSwagger(app);

app.get("/api/health", async (_req, res) => {
  const redis = await redisPing();
  res.json({ ok: true, redis, env: env.NODE_ENV });
});

app.use("/api/auth", authRouter);
app.use("/api/examples", examplesRouter);
app.use("/api/simulate", simulateRouter);
app.use("/api/ussd", ussdRouter);
app.use("/api", dashboardRouter);

app.use(errorMiddleware);
