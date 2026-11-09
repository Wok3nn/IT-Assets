import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { PageHero } from "@/components/layout/page-hero";
import { ControlShell } from "@/modules/database-management/control-shell";
import { schemaFingerprint } from "@/modules/database-management/setup-service";
import { ReadinessPanel } from "@/modules/database-management/readiness-panel";
import {
  control,
  controlCookie,
  managed,
  managementPath,
  visitFingerprint,
} from "@/modules/database-management/control-store";
import { DatabasePanel } from "@/modules/database-management/panel";

import { ManagementVisitGuard } from "@/modules/database-management/visit-guard";
export const dynamic = "force-dynamic";
export default async function ManagementWorkspace({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  if (!managed()) notFound();
  const store = control(),
    token = (await cookies()).get(controlCookie)?.value ?? "";
  if (!store.authorized(token)) redirect(managementPath);
  const state = store.state(),
    profiles = store.profiles();
  const selected = profiles.find((p) => p.id === state.active);
  const { message } = await searchParams;
  return (
    <ControlShell
      title={store.organization()?.appTitle ?? "IT Assets"}
      active={Boolean(state.active)}
    >
      <ManagementVisitGuard fingerprint={visitFingerprint(token)} />
      <PageHero>
        <p className="text-sm font-semibold uppercase tracking-wider">
          Installation administrator
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Database Management</h1>
        <p className="mt-2">
          Configure connections independently of your inventory. Leaving this
          area ends your management visit.
        </p>
      </PageHero>
      {message && <p role="status">{message}</p>}
      <DatabasePanel
        {...state}
        profiles={profiles}
        activity={store.activity()}
        inspections={Object.fromEntries(
          profiles.map((p) => {
            const evidence = store.inspection(p.id);
            return [
              p.id,
              evidence?.fingerprint === schemaFingerprint(p.provider)
                ? evidence
                : null,
            ];
          }),
        )}
      />
      <ReadinessPanel
        active={Boolean(selected)}
        organization={store.organization()?.siteName ?? ""}
        profile={
          selected
            ? `${selected.name} · ${selected.provider} · ${selected.database}`
            : ""
        }
      />
    </ControlShell>
  );
}
