import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { PageHero } from "@/components/layout/page-hero";
import { ManagementShell } from "@/modules/database-management/management-shell";
import { Form } from "@/modules/database-management/action-form";
import { Button } from "@/components/ui/button";
import { schemaFingerprint } from "@/modules/database-management/setup-service";
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
  const { message } = await searchParams;
  return (
    <ManagementShell><div className="space-y-5">
      <ManagementVisitGuard fingerprint={visitFingerprint(token)} />
      <PageHero>
        <p className="text-sm font-semibold uppercase tracking-wider">
          Installation administrator
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Database Management</h1>
        <div className="mt-3 flex flex-wrap gap-3">
          {state.active && <Form op="exit"><input type="hidden" name="destination" value="settings" /><Button type="submit" variant="secondary">Back to Settings</Button></Form>}
          <Form op="logout"><Button type="submit" variant="ghost">Sign out of Database Management</Button></Form>
        </div>
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
    </div></ManagementShell>
  );
}
