import type { Request, Response } from "express";

/**
 * Minimal mock USSD backend for local integration testing only.
 * Not production business logic — developers replace with their own URL.
 */
export async function postMockUssd(req: Request, res: Response) {
  const text = typeof req.body?.text === "string" ? req.body.text : "";
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  if (!text) {
    res.status(200).send("CON Welcome\n1. Balance\n2. Exit");
    return;
  }
  const first = text.split("*").filter(Boolean)[0];
  if (first === "1") {
    res.status(200).send("END Your balance is UGX 0 (mock).");
    return;
  }
  if (first === "2") {
    res.status(200).send("END Goodbye (mock).");
    return;
  }
  res.status(200).send("CON Invalid choice\n1. Balance\n2. Exit");
}
