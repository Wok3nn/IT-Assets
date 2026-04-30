import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { PageHero } from "@/components/layout/page-hero";
import { AppShell } from "@/components/navigation/app-shell";
import { BackButton } from "@/components/navigation/back-button";
import { getCurrentUserSettingsPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { ImportExportPanel } from "@/modules/settings/import-export-panel";
import { getImportExportEntityConfig, importExportEntityConfigs } from "@/modules/settings/import-export-navigation";
import { getImportExportReferenceData } from "@/modules/settings/import-export.service";
import { readSetupState } from "@/services/setup-state";

export const dynamic = "force-dynamic";

type ImportExportEntityPageProps = {
  params: Promise<{ entity: string }>;
};

export default async function ImportExportEntityPage({ params }: ImportExportEntityPageProps) {
  const { entity } = await params;
  const config = getImportExportEntityConfig(entity);

  if (!config) {
    notFound();
  }

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

  const references = await getImportExportReferenceData();
  const showPageDescription = config.slug !== "assets";

  return (
    <AppShell>
      <div className="space-y-4 lg:space-y-[1.125rem]">
        <div className="w-full">
          <PageHero as="section" className="w-full px-6 py-6 lg:px-8 lg:py-7">
            <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Settings / Import / Export</p>
                <h1 className="mt-3 text-3xl font-semibold text-slate-950 dark:text-slate-100">{config.title}</h1>
                {showPageDescription ? <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">{config.pageDescription}</p> : null}
              </div>
              <BackButton className="shrink-0 self-start" fallbackHref="/settings/import-export" />
            </div>
          </PageHero>
        </div>

        <div className="mx-auto w-full max-w-[76rem] px-2 lg:px-3 xl:px-4">
          <ImportExportPanel
            references={references}
            showResetShortcut={false}
            visibleKinds={[config.panelKind]}
          />
        </div>

        <div className="flex justify-center pt-2 lg:pt-3">
          <div className="flex flex-wrap justify-center gap-2">
            {importExportEntityConfigs
              .filter((entry) => entry.slug !== config.slug)
              .map((entry) => (
                <Link
                  className="inline-flex rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 transition hover:border-[#f0c48d] hover:text-[#b56613] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F69629]/40 dark:border-[#4b5255] dark:bg-[#34393c] dark:text-slate-300 dark:hover:border-[#f0a853] dark:hover:text-[#ffd1a0]"
                  href={entry.href}
                  key={entry.slug}
                >
                  {entry.title}
                </Link>
              ))}
          </div>
          </div>
      </div>
    </AppShell>
  );
}
