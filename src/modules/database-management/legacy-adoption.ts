import { deploymentTimeZone } from "./installation-timezone";
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync, lstatSync } from "node:fs";
import path from "node:path";
import { ControlError, profileSchema, type ControlStore } from "./control-store";
import { checkProfile } from "./schema-service";
import { createProfileClient } from "./profile-client";
import { decryptAppSettingSecret } from "../../services/app-settings-encryption";
import { authenticationSettingsSchema } from "../settings/authentication-settings.service";
import { installationSettingKeys, canonicalInstallationConfiguration, type InstallationConfiguration } from "./installation-configuration";

export const legacyProfileId = "adopted-legacy-mariadb";
export const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export const legacyBrandingFile = /^\/branding\/uploads\/((?:logo|icon)-[a-f0-9-]{36}\.(?:png|ico))$/;

export function parseLegacyConnection(value: string) {
  try {
    const url = new URL(value.trim());
    // Do not silently discard TLS, socket, timezone or other URL options.
    if (url.protocol !== "mysql:" || url.search || url.hash || !url.pathname.startsWith("/")) throw new Error();
    return profileSchema.parse({ name: "Existing MariaDB inventory", provider: "mariadb",
      host: url.hostname, port: url.port || 3306, database: decodeURIComponent(url.pathname.slice(1)),
      username: decodeURIComponent(url.username), password: decodeURIComponent(url.password), trustCertificate: false });
  } catch {
    throw new ControlError("Unsupported legacy connection. Require an explicit mysql URL with a hostname, database and credentials, without query options. Review TLS/options manually; no profile was imported.");
  }
}

export function prepareLegacyAuthentication(settings: Map<string, string>, env: Record<string, string | undefined> = process.env) {
  const get = (key: string) => settings.get("authentication." + key) ?? "";
  const reference = get("entra.secretReference").trim();
  if (get("entra.enabled") === "true" && !reference)
    throw new ControlError("Legacy Entra is enabled without a secret reference. Resolve authentication before adoption.");
  if (reference) {
    const secret = env[reference] ?? reference;
    if (!env.IT_ASSETS_ENTRA_SECRET_UPGRADE || env.IT_ASSETS_ENTRA_SECRET_UPGRADE !== secret)
      throw new ControlError("Supply the unchanged legacy Entra secret as IT_ASSETS_ENTRA_SECRET_UPGRADE_FILE and, for an environment reference, make the original variable available to the offline adoption command. Values are never printed.");
  }
  let groupMappings: unknown = [];
  try { groupMappings = JSON.parse(get("entra.groupMappings") || "[]"); }
  catch { throw new ControlError("Legacy Entra group mappings contain invalid JSON."); }
  if (!Array.isArray(groupMappings)) throw new ControlError("Legacy Entra group mappings must be an array.");
  const result = authenticationSettingsSchema.safeParse({ localAuthEnabled: get("local.enabled") !== "false", entraEnabled: get("entra.enabled") === "true",
    entraSsoEnabled: get("entra.ssoEnabled") === "true", entraTenantId: get("entra.tenantId"),
    entraClientId: get("entra.clientId"), entraRedirectUri: get("entra.redirectUri"),
    entraSecretReference: reference ? "IT_ASSETS_ENTRA_SECRET_UPGRADE" : "", groupMappings });
  if (!result.success) throw new ControlError("Legacy authentication settings require review; adoption will not replace invalid values with defaults.");
  return result.data;
}

export function prepareInstallationConfiguration(
  settings: Map<string, string>,
  profile: ReturnType<typeof parseLegacyConnection>,
  branding: { name: string; bytes: Buffer }[],
): InstallationConfiguration {
  const authentication = prepareLegacyAuthentication(settings);
  const encrypted = settings.get("mail.clientSecretEncrypted");
  if (encrypted) {
    try { decryptAppSettingSecret(encrypted); }
    catch { throw new ControlError("The original settings key must decrypt the mail credential before configuration import."); }
  }
  const selected = Object.fromEntries(installationSettingKeys.filter(key => settings.has(key)).map(key => [key, settings.get(key)!]));
  if (settings.has("authentication.entra.secretReference"))
    selected["authentication.entra.secretReference"] = authentication.entraSecretReference;
  if (authentication.entraSecretReference && process.env[authentication.entraSecretReference])
    selected["authentication.entra.clientSecret"] = process.env[authentication.entraSecretReference]!;
  if (encrypted) selected["mail.clientSecret"] = decryptAppSettingSecret(encrypted);
  const payload: InstallationConfiguration = {
    format: 1,
    source: { provider: "mariadb", host: profile.host, port: profile.port, database: profile.database },
    settings: selected,
    timeZone: deploymentTimeZone(),
    branding: branding.map(file => ({ name: file.name, base64: file.bytes.toString("base64") })),
    settingsKeyHash: process.env.APP_SETTINGS_ENCRYPTION_KEY ? digest(process.env.APP_SETTINGS_ENCRYPTION_KEY) : null,
  };
  try { return JSON.parse(canonicalInstallationConfiguration(payload)) as InstallationConfiguration; }
  catch { throw new ControlError("Legacy installation configuration requires review. No values were imported."); }
}

export async function inspectLegacyAdoption(value: string, brandingDirectory?: string, includeConfiguration = false) {
  const profile = parseLegacyConnection(value);
  if (await checkProfile(profile) !== "compatible")
    throw new ControlError("Legacy schema is not compatible. Stop and review migrations on a restored copy; adoption never initializes or migrates a database.");
  const db = createProfileClient(profile);
  try {
    const settings = new Map((await db.setting.findMany()).map(row => [row.key, row.value]));
    const encrypted = settings.get("mail.clientSecretEncrypted");
    if (encrypted) {
      try { decryptAppSettingSecret(encrypted); }
      catch { throw new ControlError("The original application settings encryption key is required; the saved mail credential could not be decrypted."); }
    }
    const authentication = prepareLegacyAuthentication(settings);
    const branding: { name: string; bytes: Buffer }[] = [];
    for (const [key, value] of settings) {
      if (!key.startsWith("branding.")) continue;
      const match = legacyBrandingFile.exec(value);
      if (!match) {
        if (value.startsWith("/branding/uploads")) throw new ControlError("Unsupported legacy branding path. Review and preserve the file before adoption.");
        continue;
      }
      if (branding.some(file => file.name === match[1])) continue;
      if (!brandingDirectory) throw new ControlError("Set IT_ASSETS_LEGACY_BRANDING_DIR to the extracted legacy branding/uploads directory.");
      try {
        const source = path.join(brandingDirectory, match[1]);
        const info = lstatSync(source);
        if (!info.isFile() || info.isSymbolicLink() || info.size > 2 * 1024 * 1024) throw new Error();
        branding.push({ name: match[1], bytes: readFileSync(source) });
      } catch { throw new ControlError("A referenced legacy branding file is missing, unsafe or oversized. Restore the exact files before adoption."); }
    }
    return { profile, authentication, branding,
      ...(includeConfiguration ? { installation: prepareInstallationConfiguration(settings, profile, branding) } : {}),
      settingsKeyHash: process.env.APP_SETTINGS_ENCRYPTION_KEY ? digest(process.env.APP_SETTINGS_ENCRYPTION_KEY) : null,
      entraSecretHash: authentication.entraSecretReference ? digest(process.env.IT_ASSETS_ENTRA_SECRET_UPGRADE!) : null };
  } finally { await db.$disconnect(); }
}

export function saveLegacyAdoption(store: ControlStore, directory: string, candidate: Awaited<ReturnType<typeof inspectLegacyAdoption>>) {
  const { profile, authentication, branding, settingsKeyHash, entraSecretHash } = candidate;
  const fingerprint = digest(JSON.stringify({ profile, authentication, settingsKeyHash, entraSecretHash,
    branding: branding.map(file => [file.name, digest(file.bytes)]).sort() }));
  const existing = store.legacyAdoption();
  if (existing) {
    if (existing.fingerprint !== fingerprint || !store.profiles().some(p => p.id === existing.id) || JSON.stringify(store.profile(existing.id)) !== JSON.stringify(profile))
      throw new ControlError("Adoption was already recorded. Existing profiles are never overwritten; review the saved connection and restore the original control backup if necessary.");
    return existing.id;
  }
  if (store.profiles().some(p => p.id === legacyProfileId || (p.provider === profile.provider && p.host === profile.host && p.port === profile.port && p.database === profile.database)))
    throw new ControlError("This target already has a saved profile. Review it in Database Management; adoption will not overwrite or duplicate it.");
  // Files precede the atomic control-store commit. A retry accepts identical orphan files
  // after interruption, but never overwrites a file or changes inventory rows.
  if (branding.length) {
    const target = path.join(directory, "workspaces", legacyProfileId, "branding");
    mkdirSync(target, { recursive: true, mode: 0o700 });
    for (const file of branding) {
      const destination = path.join(target, file.name);
      try { writeFileSync(destination, file.bytes, { flag: "wx", mode: 0o600 }); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST" || lstatSync(destination).isSymbolicLink() || digest(readFileSync(destination)) !== digest(file.bytes))
          throw new ControlError("Branding destination differs from the backup. Nothing was overwritten; review the control directory.");
      }
    }
  }
  return store.adoptLegacy(profile, { id: legacyProfileId, fingerprint, settingsKeyHash, entraSecretHash }, authentication);
}
