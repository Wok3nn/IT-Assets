import { NextResponse, type NextRequest } from "next/server";

import { getBootstrapRedirectResponse } from "@/lib/bootstrap.server";
import { getBrandingSettings } from "@/modules/settings/settings.service";
import { appConfig } from "@/services/config";

type BrandingAssetRouteParams = {
  params: Promise<{
    asset: string;
    theme: string;
  }>;
};

export async function GET(request: NextRequest, { params }: BrandingAssetRouteParams) {
  const bootstrapResponse = await getBootstrapRedirectResponse();

  if (bootstrapResponse) {
    return bootstrapResponse;
  }

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

  const response = NextResponse.redirect(new URL(assetUrl, `${appConfig.appUrl}/`));
  response.headers.set("Cache-Control", "no-store");

  return response;
}
