import { z } from "zod";
import type { InstallationConfiguration } from "./installation-configuration";

export const entraFields = z.object({
  tenantId: z.string().trim().min(1).max(160).regex(/^[A-Za-z0-9.-]+$/),
  clientId: z.string().trim().uuid(),
  redirectUri: z.string().trim().max(300).refine(value => {
    if (!value) return true;
    try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password && !url.hash; }
    catch { return false; }
  }),
});
export type EntraFields = z.infer<typeof entraFields>;
export function entraValues(configuration: InstallationConfiguration) {
  const settings = configuration.settings;
  const fields = entraFields.parse({ tenantId: settings["authentication.entra.tenantId"], clientId: settings["authentication.entra.clientId"], redirectUri: settings["authentication.entra.redirectUri"] ?? "" });
  const reference = settings["authentication.entra.secretReference"];
  const clientSecret = settings["authentication.entra.clientSecret"] || (reference && /^IT_ASSETS_ENTRA_SECRET_[A-Z0-9_]+$/.test(reference) ? process.env[reference] : "");
  if (!clientSecret || clientSecret.length > 16384) throw new Error("Incomplete Entra credentials.");
  return { ...fields, clientSecret };
}
// Only used inside encrypted control records; never pass this result to a client.
export function persistEntraCredential(configuration: InstallationConfiguration): InstallationConfiguration {
  const values = entraValues(configuration);
  const settings = { ...configuration.settings, "authentication.entra.clientSecret": values.clientSecret };
  delete settings["authentication.entra.secretReference"];
  return { ...configuration, settings };
}
