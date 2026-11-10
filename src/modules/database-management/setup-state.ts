import { z } from "zod";

export const setupPath = "/setup";
export const setupWorkspacePath = "/setup/workspace";
export const organizationSchema = z.object({
  siteName: z.string().trim().min(2).max(120),
  appTitle: z.string().trim().min(2).max(80),
});
export type Organization = z.infer<typeof organizationSchema>;
export type Inspection = {
  version: string;
  fingerprint: string;
  status: "empty" | "compatible" | "partial" | "incompatible" | "failed";
  checkedAt: number;
  workspace: "created" | "existing" | null;
};
export type RuntimeState = {
  generation: string;
  revision: number;
  active: string | null;
  heartbeat: number;
  listening: boolean;
};
export type ReadyState = {
  generation: string;
  revision: number;
  profile: string;
  version: string;
  fingerprint: string;
  checkedAt: number;
};
export type ReadinessResult = {
  ready: boolean;
  verified?: boolean;
  message: string;
  profile?: string | null;
  revision?: number;
};
export function activationVerified(result: ReadinessResult, profile: string, revision: number) {
  return result.verified === true && result.profile === profile && result.revision === revision;
}
export function runtimeMatches(
  runtime: RuntimeState | null,
  selection: { active: string | null; revision: number },
  now = Date.now(),
) {
  return Boolean(
    runtime?.listening &&
      runtime.active === selection.active &&
      runtime.revision === selection.revision &&
      now - runtime.heartbeat < 10000 &&
      now >= runtime.heartbeat,
  );
}
export function isReady(
  ready: ReadyState | null,
  runtime: RuntimeState | null,
  selection: { active: string | null; revision: number },
  version: string | undefined,
  fingerprint: string,
  now = Date.now(),
) {
  return Boolean(
    runtimeMatches(runtime, selection, now) &&
      ready &&
      ready.profile === selection.active &&
      ready.revision === selection.revision &&
      ready.generation === runtime?.generation &&
      ready.version === version &&
      ready.fingerprint === fingerprint &&
      now - ready.checkedAt < 15000 &&
      now >= ready.checkedAt,
  );
}
