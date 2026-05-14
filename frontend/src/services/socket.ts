import { io, Socket } from "socket.io-client";

const url = import.meta.env.VITE_SOCKET_URL || "";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(url || undefined, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}
