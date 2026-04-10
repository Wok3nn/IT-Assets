import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { PageHero } from "@/components/layout/page-hero";
import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUserPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { LocationCreateCard } from "@/modules/locations/components/location-create-card";
import { createLocation, getLocationById, listAllLocations } from "@/modules/locations/location.service";
import { readSetupState } from "@/services/setup-state";

type NewLocationPageProps = {
  searchParams?: Promise<{
    parentId?: string;
  }>;
};

function buildLocationUrl(parentId: string | null) {
  if (!parentId) {
    return "/locations";
  }

  return `/locations?parentId=${parentId}`;
}

async function createLocationAction(formData: FormData) {
  "use server";

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const permissionContext = await getCurrentUserPermissionContext();

  if (!permissionContext.capabilities.editLocations) {
    redirect("/locations");
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
  redirect(buildLocationUrl(parentIdValue || null));
}

export default async function NewLocationPage({ searchParams }: NewLocationPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const defaultParentId = resolvedSearchParams?.parentId?.trim() || null;

  const [setupState, currentUser, permissionContext] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    getCurrentUserPermissionContext(),
  ]);

  if (!setupState?.isCompleted) {
    redirect("/setup");
  }

  if (!currentUser) {
    redirect("/login");
  }

  if (!permissionContext.capabilities.editLocations) {
    notFound();
  }

  const [locations, defaultParent] = await Promise.all([
    listAllLocations(),
    defaultParentId ? getLocationById(defaultParentId) : Promise.resolve(null),
  ]);

  if (defaultParentId && !defaultParent) {
    redirect("/locations/new");
  }

  const cancelHref = buildLocationUrl(defaultParentId);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Locations</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">New location</h1>
              <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">Create a top-level location or attach a new child location to an existing branch without leaving the main Locations list cluttered with inline setup forms.</p>
            </div>
            <Link href={cancelHref}><Button type="button" variant="ghost">Back to locations</Button></Link>
          </div>
        </PageHero>

        <div className="mx-auto w-full max-w-3xl">
          <LocationCreateCard action={createLocationAction} cancelHref={cancelHref} defaultParentId={defaultParentId ?? ""} parentOptions={locations} />
        </div>
      </div>
    </AppShell>
  );
}
