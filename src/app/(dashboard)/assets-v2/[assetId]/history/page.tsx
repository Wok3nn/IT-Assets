import { redirect } from "next/navigation";

import { buildAssetHref, normalizeAssetsReturnTo } from "@/modules/assets/assets-routing";

type AssetV2HistoryRedirectPageProps = {
  params: Promise<{ assetId: string }>;
  searchParams?: Promise<{ days?: string; returnTo?: string }>;
};

export default async function AssetV2HistoryRedirectPage({ params, searchParams }: AssetV2HistoryRedirectPageProps) {
  const { assetId } = await params;
  const search = (await searchParams) ?? {};

  redirect(buildAssetHref(assetId, {
    section: "history",
    days: search.days?.trim() || null,
    returnTo: normalizeAssetsReturnTo(search.returnTo ?? null),
  }));
}
