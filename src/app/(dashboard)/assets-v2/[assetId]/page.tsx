import { redirect } from "next/navigation";

import { buildAssetHref, normalizeAssetsReturnTo } from "@/modules/assets/assets-routing";

type AssetV2RedirectPageProps = {
  params: Promise<{ assetId: string }>;
  searchParams?: Promise<{ transfer?: string; returnTo?: string }>;
};

export default async function AssetV2RedirectPage({ params, searchParams }: AssetV2RedirectPageProps) {
  const { assetId } = await params;
  const search = (await searchParams) ?? {};

  redirect(buildAssetHref(assetId, {
    transfer: search.transfer === "checkin" || search.transfer === "checkout" ? search.transfer : null,
    returnTo: normalizeAssetsReturnTo(search.returnTo ?? null),
  }));
}
