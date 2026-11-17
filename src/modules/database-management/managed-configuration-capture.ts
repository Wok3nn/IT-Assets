import { deploymentTimeZone } from "./installation-timezone";
import { readFileSync, lstatSync, realpathSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { ControlError, type ControlStore, type Profile } from "./control-store";
import { createProfileClient } from "./profile-client";
import { checkProfile } from "./schema-service";
import { authenticationSettingsSchema } from "../settings/authentication-settings.service";
import { decryptAppSettingSecret } from "../../services/app-settings-encryption";
import { installationSettingKeys, canonicalInstallationConfiguration, type InstallationConfiguration } from "./installation-configuration";
import { brandingFilePattern } from "./installation-presentation";

// Inventory Setting is the source; a saved managed auth_config overrides only IdP
// transport fields. Workspace policies/mappings are deliberately not imported.
export function prepareManagedConfiguration(settings: Map<string, string>, authentication: unknown, profile: Profile,
  readBranding: (name: string) => Buffer, timeZone: string | null = deploymentTimeZone()): InstallationConfiguration {
  const selected = Object.fromEntries(installationSettingKeys.filter(key => settings.has(key)).map(key => [key, settings.get(key)!]));
  if (authentication) {
    const parsed = authenticationSettingsSchema.safeParse(authentication);
    if (!parsed.success) throw new ControlError("Saved managed authentication requires review. No configuration captured.");
    for (const [key, value] of Object.entries({ tenantId: parsed.data.entraTenantId, clientId: parsed.data.entraClientId,
      secretReference: parsed.data.entraSecretReference, redirectUri: parsed.data.entraRedirectUri })) selected["authentication.entra." + key] = value;
  }
  const reference = selected["authentication.entra.secretReference"];
  if (reference && (!/^IT_ASSETS_ENTRA_SECRET_[A-Z0-9_]+$/.test(reference) || !process.env[reference]))
    throw new ControlError("Capture requires a configured managed Entra secret reference. Resolve legacy literals through verified legacy adoption first.");
  if (reference) selected["authentication.entra.clientSecret"] = process.env[reference]!;
  const encrypted = selected["mail.clientSecretEncrypted"];
  if (encrypted) {
    try { selected["mail.clientSecret"] = decryptAppSettingSecret(encrypted); }
    catch { throw new ControlError("The original mail settings key must decrypt the configured credential. No configuration captured."); }
  }
  const branding: InstallationConfiguration["branding"] = [];
  for (const [key, value] of Object.entries(selected)) {
    if (!key.startsWith("branding.")) continue;
    const match = /^\/(?:api\/workspace-branding|branding\/uploads)\/([^/]+)$/.exec(value);
    if (!match) {
      if (/^\/(?:api\/(?:workspace|installation)-branding|branding\/uploads)/.test(value)) throw new ControlError("Unsupported profile branding reference. Resolve it before capture.");
      continue;
    }
    const name = match[1];
    if (!brandingFilePattern.test(name)) throw new ControlError("Unsafe profile branding filename.");
    selected[key] = "/branding/uploads/" + name;
    if (!branding.some(file => file.name === name)) {
      let bytes: Buffer;
      try { bytes = readBranding(name); if (bytes.length > 2 * 1024 * 1024 || !bytes.length) throw new Error(); }
      catch { throw new ControlError("Referenced profile branding is missing, unsafe or oversized. Restore it before capture."); }
      branding.push({ name, base64: bytes.toString("base64") });
    }
  }
  const candidate: InstallationConfiguration = { format: 1, source: { provider: profile.provider, host: profile.host, port: profile.port, database: profile.database },
    settings: selected, timeZone, branding, settingsKeyHash: process.env.APP_SETTINGS_ENCRYPTION_KEY ? createHash("sha256").update(process.env.APP_SETTINGS_ENCRYPTION_KEY).digest("hex") : null };
  try { return JSON.parse(canonicalInstallationConfiguration(candidate)) as InstallationConfiguration; }
  catch { throw new ControlError("Captured global settings require review; nothing was imported."); }
}

export function readProfileBranding(directory: string, profileId: string, name: string) {
  if (!/^[A-Za-z0-9-]+$/.test(profileId) || !brandingFilePattern.test(name)) throw new ControlError("Unsafe branding path.");
  const root = realpathSync(directory);
  let current = root;
  for (const part of ["workspaces", profileId, "branding", name]) {
    current = path.join(current, part);
    if (lstatSync(current).isSymbolicLink()) throw new ControlError("Symbolic links are not supported for captured branding.");
    const resolved = realpathSync(current), relative = path.relative(root, resolved);
    if (path.isAbsolute(relative) || relative.startsWith("..")) throw new ControlError("Branding path leaves the control directory.");
  }
  const info = lstatSync(current);
  if (!info.isFile() || info.size > 2 * 1024 * 1024) throw new ControlError("Invalid branding file.");
  return readFileSync(current);
}

export async function captureManagedConfiguration(store: ControlStore, directory: string, profileId: string, refresh = false) {
  const metadata = store.profiles().find(profile => profile.id === profileId);
  if (!metadata) throw new ControlError("Choose an existing saved profile ID.");
  const profile = store.profile(profileId);
  if (await checkProfile(profile) !== "compatible") throw new ControlError("Source inventory is not compatible. Capture never migrates or initializes it.");
  const db = createProfileClient(profile);
  try {
    const settings = new Map((await db.setting.findMany({ select: { key: true, value: true } })).map(row => [row.key, row.value]));
    const candidate = prepareManagedConfiguration(settings, store.profileAuthentication(profileId), profile,
      name => readProfileBranding(directory, profileId, name));
    return store.captureConfigurationReview(profileId, metadata.version, candidate, refresh);
  } finally { await db.$disconnect(); }
}
