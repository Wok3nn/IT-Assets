import { z } from "zod";
import type { InstallationConfiguration } from "./installation-configuration";

export const presentationKeys = ["app.title", "session.timeoutMinutes", "branding.logo.light", "branding.logo.dark", "branding.icon.light", "branding.icon.dark"] as const;
export const DEFAULT_BRANDING = {
  lightLogoUrl: "/branding/asset-tracker-logo-light-transparent.png",
  darkLogoUrl: "/branding/asset-tracker-logo-dark-transparent.png",
  lightIconUrl: "/branding/asset-tracker-logo-light-transparent.ico",
  darkIconUrl: "/branding/asset-tracker-logo-dark-transparent.ico",
} as const;
export const presentationSchema = z.object({
  appTitle: z.string().trim().min(2).max(80),
  sessionTimeoutMinutes: z.coerce.number().int().min(5).max(60),
});
export const brandingFilePattern = /^(?:logo|icon)-[a-f0-9-]{36}\.(?:png|ico)$/;
export function installationBrandingUrl(value: string) {
  const match = /^\/branding\/uploads\/(.+)$/.exec(value);
  return match && brandingFilePattern.test(match[1]) ? "/api/installation-branding/" + match[1] : value;
}
export function presentationValues(configuration: InstallationConfiguration) {
  const settings = configuration.settings;
  const values = presentationSchema.parse({ appTitle: settings["app.title"] || "IT-Asset-Tracker", sessionTimeoutMinutes: settings["session.timeoutMinutes"] || "15" });
  return { ...values, branding: {
    lightLogoUrl: installationBrandingUrl(settings["branding.logo.light"] || DEFAULT_BRANDING.lightLogoUrl),
    darkLogoUrl: installationBrandingUrl(settings["branding.logo.dark"] || DEFAULT_BRANDING.darkLogoUrl),
    lightIconUrl: installationBrandingUrl(settings["branding.icon.light"] || DEFAULT_BRANDING.lightIconUrl),
    darkIconUrl: installationBrandingUrl(settings["branding.icon.dark"] || DEFAULT_BRANDING.darkIconUrl),
    defaults: DEFAULT_BRANDING,
  } };
}
export function brandingResponse(configuration: InstallationConfiguration | null, file: string): Response {
  if (!brandingFilePattern.test(file)) return new Response(null, { status: 404 });
  const image = configuration?.branding.find(item => item.name === file);
  if (!image || !Object.entries(configuration!.settings).some(([key, value]) => key.startsWith("branding.") && value === "/branding/uploads/" + file))
    return new Response(null, { status: 404 });
  return new Response(new Uint8Array(Buffer.from(image.base64, "base64")), { headers: {
    "Content-Type": file.endsWith(".png") ? "image/png" : "image/x-icon",
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
  } });
}
