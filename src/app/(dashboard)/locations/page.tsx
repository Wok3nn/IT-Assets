import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminSectionHeader } from "@/components/admin/admin-section-header";
import { buildColorCardStyle } from "@/components/admin/card-style";
import { HeaderAssetSearch } from "@/components/layout/header-asset-search";
import { PageHero } from "@/components/layout/page-hero";
import { PanelCard } from "@/components/layout/panel-card";
import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";
import {
  deleteLocation,
  getLocationById,
  listChildLocations,
  listTopLevelLocations,
} from "@/modules/locations/location.service";
import { readSetupState } from "@/services/setup-state";

type LocationsPageProps = {
  searchParams?: Promise<{
    parentId?: string;
  }>;
};

function buildLocationUrl(parentId: string | null) {
  const params = new URLSearchParams();

  if (parentId) {
    params.set("parentId", parentId);
  }

  const query = params.toString();
  return query ? `/locations?${query}` : "/locations";
}

function buildNewLocationUrl(parentId: string | null) {
  if (!parentId) {
    return "/locations/new";
  }

  return `/locations/new?parentId=${parentId}`;
}

async function deleteLocationAction(formData: FormData) {
  "use server";

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const locationId = String(formData.get("locationId") ?? "").trim();
  const parentIdValue = String(formData.get("parentId") ?? "").trim();

  if (!locationId) {
    return;
  }

  await deleteLocation(locationId);
  revalidatePath("/locations");

  if (parentIdValue) {
    redirect(buildLocationUrl(parentIdValue));
  }
}

export default async function LocationsPage({ searchParams }: LocationsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedParentId = resolvedSearchParams?.parentId?.trim() || null;

  const [setupState, currentUser, topLevelLocations, selectedParent] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    listTopLevelLocations(),
    selectedParentId ? getLocationById(selectedParentId) : Promise.resolve(null),
  ]);

  if (!setupState?.isCompleted) {
    redirect("/setup");
  }

  if (!currentUser) {
    redirect("/login");
  }

  if (selectedParentId && !selectedParent) {
    redirect("/locations");
  }

  const childLocations = selectedParent ? await listChildLocations(selectedParent.id) : [];
  const locationsToRender = selectedParent ? childLocations : topLevelLocations;
  const heading = selectedParent ? `${selectedParent.name} children` : "Parent locations";
  const summary = selectedParent
    ? childLocations.length === 0
      ? `No child locations exist under ${selectedParent.name} yet.`
      : `${childLocations.length} child location${childLocations.length === 1 ? "" : "s"} under ${selectedParent.name}.`
    : topLevelLocations.length === 0
      ? "No locations yet. Create the first parent location to start organizing where assets live."
      : `${topLevelLocations.length} parent location${topLevelLocations.length === 1 ? "" : "s"} available.`;
  const backHref = selectedParent?.parent?.id
    ? buildLocationUrl(selectedParent.parent.id)
    : buildLocationUrl(null);
  const currentBrowseHref = buildLocationUrl(selectedParent?.id ?? null);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Locations</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
                {selectedParent ? `Browsing ${selectedParent.name}` : "Location structure"}
              </h1>
              <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
                Browse parent locations, drill into nested branches, and manage existing records without mixing creation or editing into the listing flow.
              </p>
            </div>
            <HeaderAssetSearch className="w-full xl:w-auto xl:flex-none" compact />
          </div>
        </PageHero>

        <section className="space-y-6">
          <PanelCard>
            <AdminSectionHeader
              actions={
                <>
                  {selectedParent ? (
                    <Link href={backHref}>
                      <Button type="button" variant="ghost">
                        Back to parents
                      </Button>
                    </Link>
                  ) : null}
                  <Link href={buildNewLocationUrl(selectedParent?.id ?? null)}>
                    <Button type="button">New location</Button>
                  </Link>
                </>
              }
              summary={summary}
              title={heading}
            />

            <div className="mt-5">
              {locationsToRender.length === 0 ? (
                <AdminEmptyState>
                  {selectedParent ? "Child locations will appear here." : "Parent location records will appear here."}
                </AdminEmptyState>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 2xl:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
                  {locationsToRender.map((location) => {
                    const canDelete = location._count.children === 0 && location._count.assets === 0;
                    const browseHref = buildLocationUrl(location.id);
                    const editHref = `/locations/${location.id}/edit?returnTo=${encodeURIComponent(currentBrowseHref)}`;

                    return (
                      <article
                        key={location.id}
                        className="relative flex min-h-[250px] cursor-pointer flex-col justify-between rounded-[28px] border border-[#ece7df] bg-white/96 p-5 transition hover:border-[#f0c48d] hover:shadow-panel dark:border-[#4b5255] dark:bg-[#34393c] dark:shadow-[0_16px_30px_rgba(0,0,0,0.18)] dark:hover:border-[#f0a853]"
                        style={buildColorCardStyle(location)}
                      >
                        <Link aria-label={`Open ${location.name}`} className="absolute inset-0 rounded-[28px]" href={browseHref} />
                        <div className="pointer-events-none relative z-10 space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-lg font-semibold leading-tight text-slate-950 dark:text-slate-100">{location.name}</h3>
                              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{location.slug}</p>
                            </div>
                            {location.colorHex && location.colorMode ? (
                              <span
                                className="mt-1 h-3 w-3 shrink-0 rounded-full ring-2 ring-white dark:ring-slate-950"
                                style={{ backgroundColor: location.colorHex }}
                              />
                            ) : null}
                          </div>

                          <>
                            <p className="min-h-[72px] text-sm leading-6 text-slate-600 dark:text-slate-300">
                              {location.description || "No description yet. Add context so placement stays easy to follow."}
                            </p>

                            <div className="space-y-1 text-sm text-slate-500 dark:text-slate-400">
                              <p>
                                {location._count.children} child location{location._count.children === 1 ? "" : "s"}
                              </p>
                              <p>
                                {location._count.assets} assigned {location._count.assets === 1 ? "asset" : "assets"}
                              </p>
                            </div>
                          </>
                        </div>

                        <div className="relative z-10 mt-6 grid grid-cols-2 gap-3">
                          <Link href={editHref}>
                            <Button className="w-full" type="button" variant="secondary">
                              Edit
                            </Button>
                          </Link>
                          <form action={deleteLocationAction}>
                            <input name="locationId" type="hidden" value={location.id} />
                            <input name="parentId" type="hidden" value={selectedParent?.id ?? ""} />
                            <Button
                              className={
                                canDelete
                                  ? "w-full rounded-2xl hover:bg-red-600 hover:text-white hover:ring-red-600 dark:hover:bg-red-500"
                                  : "w-full rounded-2xl bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-900/70 dark:hover:bg-emerald-500/25"
                              }
                              disabled={!canDelete}
                              type="submit"
                              variant="secondary"
                            >
                              {canDelete ? "Delete" : "In use"}
                            </Button>
                          </form>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </PanelCard>
        </section>
      </div>
    </AppShell>
  );
}
