import { createHash } from "node:crypto";
import { canonicalInstallationConfiguration, type InstallationConfiguration } from "./installation-configuration";
export const configurationDigest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export type ConfigurationReview = {
  profile: string; profileVersion: string; sourceHash: string; baseline: string;
  capturedAt: string; candidate: InstallationConfiguration;
  previous: InstallationConfiguration | null;
  previousOrganization: { siteName: string; appTitle: string; version: string } | null;
  previousRuntime: { version: string; importedHash: string } | null;
  status: "pending" | "kept" | "applied" | "restored";
  result?: string;
};
export function configurationDifferences(previous: InstallationConfiguration | null, candidate: InstallationConfiguration) {
  const keys = new Set([...Object.keys(previous?.settings ?? {}), ...Object.keys(candidate.settings)]);
  const differences = [...keys].sort().filter(key => previous?.settings[key as keyof typeof candidate.settings] !== candidate.settings[key as keyof typeof candidate.settings]).map(key => {
    const secret = key === "mail.clientSecretEncrypted" || key === "authentication.entra.secretReference";
    const safe = (value: string | undefined) => secret ? (value ? "Configured (hidden)" : "Not configured") : value ?? "Not configured";
    return { key, current: safe(previous?.settings[key as keyof typeof candidate.settings]), captured: safe(candidate.settings[key as keyof typeof candidate.settings]) };
  });
  if ((previous?.timeZone ?? null) !== candidate.timeZone) differences.push({ key: "timeZone", current: previous?.timeZone ?? "Deployment default", captured: candidate.timeZone ?? "Deployment default" });
  if ((previous?.settingsKeyHash ?? null) !== candidate.settingsKeyHash) differences.push({ key: "mail encryption key", current: previous?.settingsKeyHash ? "Verified key (hidden)" : "Not recorded", captured: candidate.settingsKeyHash ? "Verified key (hidden)" : "Not recorded" });
  const files = (value: InstallationConfiguration | null) => (value?.branding ?? []).map(file => [file.name, configurationDigest(file.base64)]).sort();
  if (JSON.stringify(files(previous)) !== JSON.stringify(files(candidate))) differences.push({ key: "branding files", current: `${previous?.branding.length ?? 0} preserved files`, captured: `${candidate.branding.length} captured files` });
  return differences;
}
export function validatedReviewCandidate(input: InstallationConfiguration): InstallationConfiguration {
  return JSON.parse(canonicalInstallationConfiguration(input)) as InstallationConfiguration;
}
