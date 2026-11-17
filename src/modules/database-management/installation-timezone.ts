import { z } from "zod";

export const timeZoneSchema = z.string().trim().min(1).max(120).refine(value => {
  // IANA identifiers/aliases (including UTC); reject numeric offset identifiers.
  if (/^[+-]/.test(value)) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; }
  catch { return false; }
}, "Enter a valid IANA timezone identifier.");

export function deploymentTimeZone() {
  const configured = process.env.APP_TIME_ZONE?.trim() || process.env.TZ?.trim() || "UTC";
  return timeZoneSchema.safeParse(configured).success ? configured : "UTC";
}
