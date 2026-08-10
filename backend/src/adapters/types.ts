import { z } from "zod";

export const telecomProviderSchema = z.enum([
  "DIALFORGE",
  "MTN",
  "AIRTEL",
  "NEXEN",
  "CUSTOM",
]);

export type TelecomProvider = z.infer<typeof telecomProviderSchema>;

export const defaultProvider: TelecomProvider = "DIALFORGE";
