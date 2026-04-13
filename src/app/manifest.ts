import type { MetadataRoute } from "next";

import { getGeneralSettings } from "@/modules/settings/settings.service";

const APP_DESCRIPTION = "A modern self-hosted asset management platform.";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getGeneralSettings();
  const appTitle = settings.appTitle;

  return {
    name: appTitle,
    short_name: appTitle,
    description: APP_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#fcfcfd",
    theme_color: "#f69629",
    icons: [
      {
        src: "/api/branding/icon/light",
        purpose: "any",
      },
      {
        src: "/api/branding/icon/dark",
        purpose: "any",
      },
    ],
  };
}
