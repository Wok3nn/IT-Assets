import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AdminSelectField } from "@/components/admin/admin-fields";
import { getCurrentUser } from "@/lib/session";
import { buildAssetLookupUrl } from "@/modules/assets/assets-routing";
import { getAssetById } from "@/modules/assets/asset.service";
import { LabelTemplatePrintPreview } from "@/modules/labels/components/label-template-print-preview";
import { getLabelTemplateById, listEnabledLabelTemplates } from "@/modules/labels/label-template.service";
import { getLabelValueMapForAsset } from "@/modules/labels/label-template.shared";
import { readSetupState } from "@/services/setup-state";

type AssetLabelPrintPageProps = {
  params: Promise<{
    assetId: string;
  }>;
  searchParams?: Promise<{
    templateId?: string;
  }>;
};

function getRequestOrigin(requestHeaders: Headers) {
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");

  if (!host) {
    return null;
  }

  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

export default async function AssetLabelPrintPage({ params, searchParams }: AssetLabelPrintPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const assetId = resolvedParams.assetId;
  const requestedTemplateId = resolvedSearchParams?.templateId?.trim() || null;

  const requestHeaders = await headers();
  const requestOrigin = getRequestOrigin(requestHeaders);

  const [setupState, currentUser, asset, enabledTemplates] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    getAssetById(assetId),
    listEnabledLabelTemplates(),
  ]);

  if (!setupState?.isCompleted) {
    redirect("/setup");
  }

  if (!currentUser) {
    redirect("/login");
  }

  if (!asset) {
    redirect("/assets");
  }

  if (enabledTemplates.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f6_100%)] px-6 py-10 dark:bg-[linear-gradient(180deg,#2f3437_0%,#252a2d_100%)]">
        <div className="max-w-lg rounded-[28px] border border-[#ece7df] bg-white/95 p-8 text-center shadow-panel dark:border-[#4b5255] dark:bg-[#34393c]/95">
          <h1 className="text-2xl font-semibold text-slate-950 dark:text-slate-100">No enabled label templates</h1>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Create or enable a label template before printing labels for assets.</p>
          <div className="mt-5 flex justify-center">
            <a className="inline-flex items-center justify-center rounded-full bg-[#F69629] px-4 py-2 text-sm font-medium text-white" href={`/assets/${asset.id}`}>Back to asset</a>
          </div>
        </div>
      </div>
    );
  }

  const preferredTemplateId = asset.labelTemplateId ?? asset.category?.defaultLabelTemplateId ?? enabledTemplates[0]?.id ?? null;
  const selectedTemplateId = enabledTemplates.some((template) => template.id === requestedTemplateId)
    ? requestedTemplateId
    : preferredTemplateId;
  const template = selectedTemplateId ? await getLabelTemplateById(selectedTemplateId) : null;

  if (!template) {
    redirect(`/assets/${asset.id}`);
  }

  const renderData = {
    values: getLabelValueMapForAsset({
      assetTag: asset.assetTag,
      serialNumber: asset.serialNumber,
      name: asset.name,
    }),
    assetDetailsUrl: buildAssetLookupUrl(asset.id, requestOrigin),
  };

  return (
    <LabelTemplatePrintPreview
      backHref={`/assets/${asset.id}`}
      backLabel="Back to asset"
      caption={`${asset.assetTag} - ${template.name}`}
      description="Preview and print the selected label template using this asset's real values."
      renderData={renderData}
      template={template}
      templateName={`Print label for ${asset.assetTag}`}
      toolbarContent={
        <form action={`/assets/${asset.id}/label`} className="flex flex-wrap items-center gap-3" method="get">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            <span className="sr-only">Label template</span>
            <AdminSelectField defaultValue={template.id} name="templateId">
              {enabledTemplates.map((enabledTemplate) => (
                <option key={enabledTemplate.id} value={enabledTemplate.id}>{enabledTemplate.name}</option>
              ))}
            </AdminSelectField>
          </label>
          <button className="inline-flex items-center justify-center rounded-full bg-white/88 px-4 py-2 text-sm font-medium text-slate-900 ring-1 ring-[#f3d2ae] hover:bg-[#fff5ea] hover:ring-[#F69629]/35 dark:bg-[#3a4043] dark:text-slate-100 dark:ring-[#4a5257] dark:hover:bg-[#464d50] dark:hover:ring-[#F69629]/35" type="submit">
            Load template
          </button>
        </form>
      }
    />
  );
}
