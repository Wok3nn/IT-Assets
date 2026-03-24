import { redirect } from "next/navigation";

import { buildAssetHref, normalizeAssetsReturnTo } from "@/modules/assets/assets-routing";

type EditAssetV2RedirectPageProps = {
  params: Promise<{ assetId: string }>;
  searchParams?: Promise<{ returnTo?: string }>;
};

export default async function EditAssetV2RedirectPage({ params, searchParams }: EditAssetV2RedirectPageProps) {
  const { assetId } = await params;
  const search = (await searchParams) ?? {};

  redirect(buildAssetHref(assetId, {
    section: "edit",
    returnTo: normalizeAssetsReturnTo(search.returnTo ?? null),
  }));
}
