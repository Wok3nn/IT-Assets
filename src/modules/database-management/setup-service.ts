import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { type ControlStore, ControlError } from "./control-store";
import { checkProfile, testConnection } from "./schema-service";
import { isReady, runtimeMatches } from "./setup-state";

export function schemaFingerprint(provider: string) {
  const folder = path.join(
    "prisma",
    provider === "sqlserver" ? "managed-migrations" : "migrations",
    provider,
  );
  const hash = createHash("sha256").update(
    readFileSync(`prisma/providers/${provider}/schema.prisma`),
  );
  for (const dir of readdirSync(folder, { withFileTypes: true })
    .filter((x) => x.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name)))
    hash
      .update(dir.name)
      .update(readFileSync(path.join(folder, dir.name, "migration.sql")));
  return hash.digest("hex");
}
export async function inspectConnection(
  store: ControlStore,
  id: string,
  created = false,
) {
  const profile = store.profiles().find((p) => p.id === id);
  if (!profile) throw new ControlError("Profile no longer exists.");
  const fingerprint = schemaFingerprint(profile.provider);
  try {
    const p = store.profile(id);
    await testConnection(p);
    const status = await checkProfile(p);
    store.recordInspection(id, {
      version: profile.version,
      fingerprint,
      status,
      checkedAt: Date.now(),
      workspace:
        status === "compatible"
          ? created || store.inspection(id)?.workspace === "created"
            ? "created"
            : "existing"
          : null,
    });
    return status;
  } catch (error) {
    store.recordInspection(id, {
      version: profile.version,
      fingerprint,
      status: "failed",
      checkedAt: Date.now(),
      workspace: null,
    });
    throw error;
  }
}
// Invoked only from an authenticated control request, never during offline startup.
export async function verifyReadiness(store: ControlStore) {
  const selection = store.state(),
    runtime = store.runtime();
  if (
    !selection.active ||
    !runtimeMatches(runtime, selection) ||
    String(selection.revision) !== process.env.IT_ASSETS_REVISION
  )
    return {
      ready: false,
      message:
        "Waiting for the selected application process. If it does not resume, use the deployment restart guidance.",
    };
  const profile = store.profiles().find((p) => p.id === selection.active);
  if (!profile) return { ready: false, message: "Select a saved connection." };
  const fingerprint = schemaFingerprint(profile.provider);
  try {
    // Every status request probes live connectivity. Full inspection is repeated
    // after generation/profile/schema changes, lease expiry, and at least once a
    // minute even while frequent probes keep the connectivity lease alive.
    if (
      !isReady(
        store.readiness(),
        runtime,
        selection,
        profile.version,
        fingerprint,
      ) ||
      Date.now() - (store.inspection(profile.id)?.checkedAt ?? 0) > 60000
    ) {
      if ((await inspectConnection(store, profile.id)) !== "compatible")
        throw new ControlError(
          "The active schema is not compatible. Inspect the connection before continuing.",
        );
    } else await testConnection(store.profile(profile.id));
    if (!runtimeMatches(store.runtime(), selection))
      throw new ControlError(
        "The application process changed. Check readiness again.",
      );
    store.markReady({
      generation: runtime!.generation,
      revision: selection.revision,
      profile: profile.id,
      version: profile.version,
      fingerprint,
      checkedAt: Date.now(),
    });
    return {
      ready: Boolean(store.organization() && store.registered()),
      verified: true,
      message: store.organization()
        ? "Application ready."
        : "Configure your local organization to complete this checklist.",
    };
  } catch {
    store.clearReadiness();
    return {
      ready: false,
      message:
        "Application not ready. Test Connection & Inspect Schema for safe diagnostics. No initialization was retried.",
    };
  }
}
