import { redirect } from "next/navigation";

import { buildAssetsUrl, parseAssetsSort } from "@/modules/assets/assets-routing";

type AssetsV2RedirectPageProps = {
  searchParams?: Promise<{
    q?: string;
    statusId?: string;
    categoryId?: string;
    scopeId?: string;
    locationId?: string;
    userId?: string;
    sort?: string;
  }>;
};

export default async function AssetsV2RedirectPage({ searchParams }: AssetsV2RedirectPageProps) {
  const params = (await searchParams) ?? {};

  redirect(buildAssetsUrl({
    q: params.q?.trim() || null,
    statusId: params.statusId?.trim() || null,
    categoryId: params.categoryId?.trim() || null,
    scopeId: params.scopeId?.trim() || null,
    locationId: params.locationId?.trim() || null,
    userId: params.userId?.trim() || null,
    sort: parseAssetsSort(params.sort),
  }));
}
