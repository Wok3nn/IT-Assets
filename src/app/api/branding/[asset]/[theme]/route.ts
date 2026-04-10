import { NextResponse, type NextRequest } from "next/server";

import { getBrandingSettings } from "@/modules/settings/settings.service";

type BrandingAssetRouteParams = {
  params: Promise<{
    asset: string;
    theme: string;
  }>;
};

export async function GET(request: NextRequest, { params }: BrandingAssetRouteParams) {
  const { asset, theme } = await params;
  const branding = await getBrandingSettings();

  const assetUrl =
    asset === "logo"
      ? theme === "dark"
        ? branding.darkLogoUrl
        : branding.lightLogoUrl
      : theme === "dark"
        ? branding.darkIconUrl
        : branding.lightIconUrl;

  const response = NextResponse.redirect(new URL(assetUrl, request.url));
  response.headers.set("Cache-Control", "no-store");

  return response;
}
