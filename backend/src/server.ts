import "dotenv/config";
import { createServer } from "http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { app } from "./app.js";
import { corsOrigins, env } from "./config/env.js";
import { attachIoInstance } from "./socket/ioHub.js";
import { logger } from "./logger/logger.js";

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: corsOrigins(),
    credentials: true,
  },
});

attachIoInstance(io);

io.use((socket, next) => {
  const token = (socket.handshake.auth as { token?: string } | undefined)?.token;
  if (!token) {
    (socket.data as { userId?: string }).userId = undefined;
    return next();
  }
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { sub: string };
    (socket.data as { userId?: string }).userId = decoded.sub;
    return next();
  } catch {
    (socket.data as { userId?: string }).userId = undefined;
    return next();
  }
});

io.on("connection", (socket) => {
  const userId = (socket.data as { userId?: string }).userId;
  if (userId) {
    void socket.join(`user:${userId}`);
  }
  logger.info("socket_connected", { id: socket.id, userId: userId ?? null });
  socket.emit("system:hello", { message: "Connected to USSD realtime stream", userId: userId ?? null });
});

httpServer.listen(env.PORT, () => {
  logger.info("server_listening", { port: env.PORT });
});
