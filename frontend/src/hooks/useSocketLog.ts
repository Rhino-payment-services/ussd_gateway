import { useEffect, useState } from "react";
import { getSocket } from "../services/socket";

export type LogEvent = {
  ts: string;
  event: string;
  payload: unknown;
};

export function useSocketLog() {
  const [events, setEvents] = useState<LogEvent[]>([]);

  useEffect(() => {
    const s = getSocket();
    const push = (event: string, payload: unknown) => {
      setEvents((prev) => [{ ts: new Date().toISOString(), event, payload }, ...prev].slice(0, 200));
    };
    const onReq = (p: unknown) => push("ussd:request", p);
    const onRes = (p: unknown) => push("ussd:response", p);
    const onErr = (p: unknown) => push("ussd:error", p);
    s.on("ussd:request", onReq);
    s.on("ussd:response", onRes);
    s.on("ussd:error", onErr);
    return () => {
      s.off("ussd:request", onReq);
      s.off("ussd:response", onRes);
      s.off("ussd:error", onErr);
    };
  }, []);

  return events;
}
