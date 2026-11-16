import { redirect } from "next/navigation";
import Link from "next/link";
import { control, managed } from "@/modules/database-management/control-store";

import { AppShell } from "@/components/navigation/app-shell";
import { getCurrentUserSettingsPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { BrandingSettingsPanel } from "@/modules/settings/components/branding-settings-panel";
import {
  getBrandingSettings,
  saveBrandingUpload,
  updateBrandingSettings,
} from "@/modules/settings/settings.service";
import { readSetupState } from "@/services/setup-state";

export const dynamic = "force-dynamic";

async function saveBrandingSettingsAction(formData: FormData) {
  "use server";

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const permissionContext = await getCurrentUserSettingsPermissionContext();

  if (!permissionContext.canViewSettings) {
    redirect("/dashboard");
  }

  const brandingLightLogoUrl = String(formData.get("brandingLightLogoUrl") ?? "").trim();
  const brandingDarkLogoUrl = String(formData.get("brandingDarkLogoUrl") ?? "").trim();
  const brandingLightIconUrl = String(formData.get("brandingLightIconUrl") ?? "").trim();
  const brandingDarkIconUrl = String(formData.get("brandingDarkIconUrl") ?? "").trim();
  const lightLogoUpload = formData.get("brandingLightLogoUpload");
  const darkLogoUpload = formData.get("brandingDarkLogoUpload");
  const lightIconUpload = formData.get("brandingLightIconUpload");
  const darkIconUpload = formData.get("brandingDarkIconUpload");

  const nextLightLogoUrl = lightLogoUpload instanceof File
    ? await saveBrandingUpload(lightLogoUpload, "logo") ?? brandingLightLogoUrl
    : brandingLightLogoUrl;
  const nextDarkLogoUrl = darkLogoUpload instanceof File
    ? await saveBrandingUpload(darkLogoUpload, "logo") ?? brandingDarkLogoUrl
    : brandingDarkLogoUrl;
  const nextLightIconUrl = lightIconUpload instanceof File
    ? await saveBrandingUpload(lightIconUpload, "icon") ?? brandingLightIconUrl
    : brandingLightIconUrl;
  const nextDarkIconUrl = darkIconUpload instanceof File
    ? await saveBrandingUpload(darkIconUpload, "icon") ?? brandingDarkIconUrl
    : brandingDarkIconUrl;

  await updateBrandingSettings({
    brandingDarkIconUrl: nextDarkIconUrl,
    brandingDarkLogoUrl: nextDarkLogoUrl,
    brandingLightIconUrl: nextLightIconUrl,
    brandingLightLogoUrl: nextLightLogoUrl,
  });

  redirect("/settings/branding?saved=true");
}

export default async function BrandingSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const savedParam = resolvedSearchParams?.saved;
  const initialSaved = Array.isArray(savedParam) ? savedParam.includes("true") : savedParam === "true";

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

  const branding = await getBrandingSettings();

  return (
    <AppShell>
      {managed() && control().presentationRuntime() && <p className="mb-4">Branding applies installation-wide. <Link className="underline" href="/settings/database-management">Sign in as Installation Administrator to edit branding.</Link></p>}
      <fieldset disabled={Boolean(managed() && control().presentationRuntime())}>
      <BrandingSettingsPanel
        branding={branding}
        initialSaved={initialSaved}
        saveBrandingSettingsAction={saveBrandingSettingsAction}
      />
      </fieldset>
    </AppShell>
  );
}
