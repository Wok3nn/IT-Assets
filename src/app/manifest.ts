import type { MetadataRoute } from "next";

const APP_TITLE = "IT-Asset-Tracker";
const APP_DESCRIPTION = "A modern self-hosted asset management platform.";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_TITLE,
    short_name: APP_TITLE,
    description: APP_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#fcfcfd",
    theme_color: "#f69629",
    icons: [
      {
        src: "/branding/asset-tracker-logo-light-transparent-32.png",
        purpose: "any",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/branding/asset-tracker-logo-light-transparent-64.png",
        purpose: "any",
        sizes: "64x64",
        type: "image/png",
      },
      {
        src: "/branding/asset-tracker-logo-light-transparent.png",
        purpose: "any",
        sizes: "256x256",
        type: "image/png",
      },
      {
        src: "/branding/asset-tracker-logo-dark-transparent-32.png",
        purpose: "any",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/branding/asset-tracker-logo-dark-transparent-64.png",
        purpose: "any",
        sizes: "64x64",
        type: "image/png",
      },
      {
        src: "/branding/asset-tracker-logo-dark-transparent.png",
        purpose: "any",
        sizes: "256x256",
        type: "image/png",
      },
    ],
  };
}
