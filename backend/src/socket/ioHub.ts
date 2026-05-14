import type { Server } from "socket.io";

let io: Server | null = null;

export function attachIoInstance(instance: Server) {
  io = instance;
}

export function emitLog(event: string, payload: unknown) {
  io?.emit(event, payload);
}

export function getIo(): Server | null {
  return io;
}

/** Push dashboard clients for this user to refetch metrics (debounced on client). */
export function notifyUserMetricsRefresh(userId: string | null) {
  if (!userId || !io) return;
  io.to(`user:${userId}`).emit("metrics:refresh", { at: Date.now() });
}

export function notifyUserActivity(userId: string | null, payload: Record<string, unknown>) {
  if (!userId || !io) return;
  io.to(`user:${userId}`).emit("metrics:activity", payload);
}