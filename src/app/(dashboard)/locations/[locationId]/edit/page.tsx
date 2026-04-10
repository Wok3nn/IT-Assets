import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { PageHero } from "@/components/layout/page-hero";
import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUserPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { LocationEditCard } from "@/modules/locations/components/location-edit-card";
import { getLocationById, updateLocation } from "@/modules/locations/location.service";
import { readSetupState } from "@/services/setup-state";

type EditLocationPageProps = {
  params: Promise<{
    locationId: string;
  }>;
  searchParams?: Promise<{
    returnTo?: string;
  }>;
};

function buildLocationReturnUrl(parentId: string | null) {
  if (!parentId) {
    return "/locations";
  }

  return `/locations?parentId=${parentId}`;
}

function normalizeLocationReturnTo(value: string | null | undefined, parentId: string | null) {
  const trimmed = value?.trim();

  if (trimmed && trimmed.startsWith("/locations")) {
    return trimmed;
  }

  return buildLocationReturnUrl(parentId);
}

async function updateLocationAction(formData: FormData) {
  "use server";

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const permissionContext = await getCurrentUserPermissionContext();

  if (!permissionContext.capabilities.editLocations) {
    redirect("/locations");
  }

  const locationId = String(formData.get("locationId") ?? "").trim();
  const returnTo = String(formData.get("returnTo") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const colorHex = String(formData.get("colorHex") ?? "").trim();
  const colorModeValue = String(formData.get("colorMode") ?? "none").trim();
  const colorMode = colorModeValue === "border" || colorModeValue === "fill" ? colorModeValue : "none";

  if (!locationId || name.length < 2) {
    return;
  }

  const location = await getLocationById(locationId);

  if (!location) {
    redirect("/locations");
  }

  await updateLocation({
    locationId,
    name,
    description,
    colorHex,
    colorMode,
  });

  revalidatePath("/locations");
  redirect(normalizeLocationReturnTo(returnTo, location.parent?.id ?? null));
}

export default async function EditLocationPage({ params, searchParams }: EditLocationPageProps) {
  const [{ locationId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);

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

  const location = await getLocationById(locationId);

  if (!location) {
    notFound();
  }

  const returnTo = normalizeLocationReturnTo(resolvedSearchParams?.returnTo, location.parent?.id ?? null);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Locations</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
                Edit {location.name}
              </h1>
              <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
                Update this location on its own screen, then return to the same branch without reopening an inline panel.
              </p>
            </div>
            <Link href={returnTo}>
              <Button type="button" variant="ghost">
                Back to locations
              </Button>
            </Link>
          </div>
        </PageHero>

        <div className="mx-auto w-full max-w-3xl">
          <LocationEditCard
            action={updateLocationAction}
            cancelHref={returnTo}
            defaultColorHex={location.colorHex}
            defaultColorMode={location.colorMode}
            defaultDescription={location.description}
            defaultName={location.name}
            locationId={location.id}
            returnTo={returnTo}
          />
        </div>
      </div>
    </AppShell>
  );
}
