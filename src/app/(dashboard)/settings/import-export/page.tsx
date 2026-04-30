import { redirect } from "next/navigation";
import Link from "next/link";

import { PageHero } from "@/components/layout/page-hero";
import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUserSettingsPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { ImportExportNavCard } from "@/modules/settings/components/import-export-nav-card";
import { importExportEntityConfigs } from "@/modules/settings/import-export-navigation";
import { readSetupState } from "@/services/setup-state";

export const dynamic = "force-dynamic";

export default async function ImportExportPage() {
  const [setupState, currentUser, permissionContext] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    getCurrentUserSettingsPermissionContext(),
  ]);

  if (!setupState?.isCompleted) {
    redirect("/setup");
  }

  if (!currentUser) {
    redirect("/login");
  }

  if (!permissionContext.canViewSettings) {
    redirect("/dashboard");
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero as="section">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Settings</p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-950 dark:text-slate-100">Import / Export</h1>
              <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
                Open a focused workspace for each entity. For the smoothest setup, import structure first and assets last.
              </p>
            </div>
            <Link href="/settings">
              <Button type="button" variant="ghost">Back to settings</Button>
            </Link>
          </div>
        </PageHero>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {importExportEntityConfigs.map((config) => (
            <ImportExportNavCard
              description={config.description}
              href={config.href}
              key={config.slug}
              order={config.recommendedOrder}
              title={config.title}
            />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
