import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminTextField, AdminTextareaField } from "@/components/admin/admin-fields";
import { AdminPageColumns } from "@/components/admin/admin-page-columns";
import { AdminSectionHeader } from "@/components/admin/admin-section-header";
import { buildColorCardStyle } from "@/components/admin/card-style";
import { ColorStyleFields } from "@/components/admin/color-style-fields";
import { FieldLabel, FieldLabelText } from "@/components/forms/field-label";
import { PageHero } from "@/components/layout/page-hero";
import { PanelCard } from "@/components/layout/panel-card";
import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";
import {
  createLocation,
  deleteLocation,
  getLocationById,
  listChildLocations,
  listTopLevelLocations,
  updateLocation,
} from "@/modules/locations/location.service";
import { readSetupState } from "@/services/setup-state";

type LocationsPageProps = {
  searchParams?: Promise<{
    parentId?: string;
    editId?: string;
    showDescription?: string;
    showSubtitle?: string;
  }>;
};

function buildLocationUrl(parentId: string | null, editId?: string | null, showDescription = true, showSubtitle = true) {
  const params = new URLSearchParams();

  if (parentId) {
    params.set("parentId", parentId);
  }

  if (editId) {
    params.set("editId", editId);
  }

  if (!showDescription) {
    params.set("showDescription", "false");
  }

  if (!showSubtitle) {
    params.set("showSubtitle", "false");
  }

  const query = params.toString();
  return query ? `/locations?${query}` : "/locations";
}

async function createLocationAction(formData: FormData) {
  "use server";

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const parentIdValue = String(formData.get("parentId") ?? "").trim();
  const colorHex = String(formData.get("colorHex") ?? "").trim();
  const colorModeValue = String(formData.get("colorMode") ?? "none").trim();
  const colorMode = colorModeValue === "border" || colorModeValue === "fill" ? colorModeValue : "none";

  if (name.length < 2) {
    return;
  }

  await createLocation({
    name,
    description,
    parentId: parentIdValue || null,
    colorHex,
    colorMode,
  });

  revalidatePath("/locations");

  if (parentIdValue) {
    redirect(buildLocationUrl(parentIdValue));
  }
}

async function updateLocationAction(formData: FormData) {
  "use server";

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const locationId = String(formData.get("locationId") ?? "").trim();
  const parentIdValue = String(formData.get("parentId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const colorHex = String(formData.get("colorHex") ?? "").trim();
  const colorModeValue = String(formData.get("colorMode") ?? "none").trim();
  const colorMode = colorModeValue === "border" || colorModeValue === "fill" ? colorModeValue : "none";
  const showDescription = String(formData.get("showDescription") ?? "true") !== "false";
  const showSubtitle = String(formData.get("showSubtitle") ?? "true") !== "false";

  if (!locationId || name.length < 2) {
    return;
  }

  await updateLocation({
    locationId,
    name,
    description,
    colorHex,
    colorMode,
  });

  revalidatePath("/locations");
  redirect(buildLocationUrl(parentIdValue || null, null, showDescription, showSubtitle));
}

async function deleteLocationAction(formData: FormData) {
  "use server";

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const locationId = String(formData.get("locationId") ?? "").trim();
  const parentIdValue = String(formData.get("parentId") ?? "").trim();
  const showDescription = String(formData.get("showDescription") ?? "true") !== "false";
  const showSubtitle = String(formData.get("showSubtitle") ?? "true") !== "false";

  if (!locationId) {
    return;
  }

  await deleteLocation(locationId);
  revalidatePath("/locations");

  if (parentIdValue) {
    redirect(buildLocationUrl(parentIdValue, null, showDescription, showSubtitle));
  }
}

export default async function LocationsPage({ searchParams }: LocationsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedParentId = resolvedSearchParams?.parentId?.trim() || null;
  const editLocationId = resolvedSearchParams?.editId?.trim() || null;
  const showDescription = resolvedSearchParams?.showDescription !== "false";
  const showSubtitle = resolvedSearchParams?.showSubtitle !== "false";

  const [setupState, currentUser, topLevelLocations, selectedParent, editLocation] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    listTopLevelLocations(),
    selectedParentId ? getLocationById(selectedParentId) : Promise.resolve(null),
    editLocationId ? getLocationById(editLocationId) : Promise.resolve(null),
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
    ? buildLocationUrl(selectedParent.parent.id, null, showDescription, showSubtitle)
    : buildLocationUrl(null, null, showDescription, showSubtitle);
  const editMatchesView =
    editLocation &&
    ((selectedParent && editLocation.parentId === selectedParent.id) || (!selectedParent && editLocation.parentId === null));
  const activeEditLocation = editMatchesView ? editLocation : null;
  const toggleSubtitleHref = buildLocationUrl(selectedParent?.id ?? null, editLocationId, showDescription, !showSubtitle);
  const toggleDescriptionHref = buildLocationUrl(selectedParent?.id ?? null, editLocationId, !showDescription, showSubtitle);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Locations</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
            {selectedParent ? `Browsing ${selectedParent.name}` : "Location structure"}
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
            Create parent locations first, then drill down into shelves, rows, rooms, or any nested physical structure you need.
          </p>
        </PageHero>

        <AdminPageColumns>
          <div className="space-y-6">
            <PanelCard>
              <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">
                {selectedParent ? `New child for ${selectedParent.name}` : "New parent location"}
              </h2>
              <form action={createLocationAction} className="mt-5 space-y-4">
                <input name="parentId" type="hidden" value={selectedParent?.id ?? ""} />

                <FieldLabel>
                  <FieldLabelText>Name</FieldLabelText>
                  <AdminTextField
                    maxLength={80}
                    minLength={2}
                    name="name"
                    placeholder={selectedParent ? "3rd Row" : "Garage"}
                    required
                    type="text"
                  />
                </FieldLabel>

                <FieldLabel>
                  <FieldLabelText>Description</FieldLabelText>
                  <AdminTextareaField
                    maxLength={240}
                    name="description"
                    placeholder="Storage area for spare networking equipment."
                    rows={4}
                  />
                </FieldLabel>

                <ColorStyleFields defaultColorMode="border" defaultColorHex="#2563EB" helperText="Border or soft fill." />

                <Button className="w-full" type="submit">
                  {selectedParent ? "Create child location" : "Create parent location"}
                </Button>
              </form>
            </PanelCard>

            {activeEditLocation ? (
              <PanelCard>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Edit location</h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{activeEditLocation.name}</p>
                  </div>
                  <Link href={buildLocationUrl(selectedParent?.id ?? null, null, showDescription, showSubtitle)}>
                    <Button type="button" variant="ghost">Close</Button>
                  </Link>
                </div>

                <form action={updateLocationAction} className="mt-5 space-y-4">
                  <input name="locationId" type="hidden" value={activeEditLocation.id} />
                  <input name="parentId" type="hidden" value={selectedParent?.id ?? ""} />
                  <input name="showDescription" type="hidden" value={showDescription ? "true" : "false"} />
                  <input name="showSubtitle" type="hidden" value={showSubtitle ? "true" : "false"} />

                  <FieldLabel>
                    <FieldLabelText>Name</FieldLabelText>
                    <AdminTextField
                      defaultValue={activeEditLocation.name}
                      maxLength={80}
                      minLength={2}
                      name="name"
                      required
                      type="text"
                    />
                  </FieldLabel>

                  <FieldLabel>
                    <FieldLabelText>Description</FieldLabelText>
                    <AdminTextareaField
                      defaultValue={activeEditLocation.description ?? ""}
                      maxLength={240}
                      name="description"
                      rows={4}
                    />
                  </FieldLabel>

                  <ColorStyleFields
                    defaultColorHex={activeEditLocation.colorHex}
                    defaultColorMode={activeEditLocation.colorMode ?? "none"}
                    helperText="Update the visual cue for this location."
                    title="Color"
                  />

                  <Button className="w-full" type="submit">Save location</Button>
                </form>
              </PanelCard>
            ) : null}
          </div>

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
                  <Link href={toggleSubtitleHref}>
                    <Button type="button" variant={showSubtitle ? "secondary" : "ghost"}>
                      {showSubtitle ? "Hide subtitle" : "Show subtitle"}
                    </Button>
                  </Link>
                  <Link href={toggleDescriptionHref}>
                    <Button type="button" variant={showDescription ? "secondary" : "ghost"}>
                      {showDescription ? "Hide description" : "Show description"}
                    </Button>
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
                    const browseHref = buildLocationUrl(location.id, null, showDescription, showSubtitle);
                    const editHref = buildLocationUrl(selectedParent?.id ?? null, location.id, showDescription, showSubtitle);

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
                              {showSubtitle ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{location.slug}</p> : null}
                            </div>
                            {location.colorHex && location.colorMode ? (
                              <span
                                className="mt-1 h-3 w-3 shrink-0 rounded-full ring-2 ring-white dark:ring-slate-950"
                                style={{ backgroundColor: location.colorHex }}
                              />
                            ) : null}
                          </div>

                          {showDescription ? (
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
                          ) : null}
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
                            <input name="showDescription" type="hidden" value={showDescription ? "true" : "false"} />
                            <input name="showSubtitle" type="hidden" value={showSubtitle ? "true" : "false"} />
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
        </AdminPageColumns>
      </div>
    </AppShell>
  );
}
