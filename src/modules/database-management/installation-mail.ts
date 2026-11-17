import { createHash } from "node:crypto";
import { z } from "zod";
import { decryptAppSettingSecret } from "../../services/app-settings-encryption";
import type { InstallationConfiguration } from "./installation-configuration";

const optionalGuid = z.union([z.string().trim().uuid(), z.literal("")]);
export const mailFields = z.object({ tenantId: optionalGuid, clientId: optionalGuid,
  senderMailbox: z.union([z.string().trim().email().max(240), z.literal("")]) });
export type MailFields = z.infer<typeof mailFields>;
export function mailValues(configuration: InstallationConfiguration) {
  const settings = configuration.settings;
  const fields = mailFields.parse({ tenantId: settings["mail.tenantId"] ?? "", clientId: settings["mail.clientId"] ?? "", senderMailbox: settings["mail.senderMailbox"] ?? "" });
  const clientSecret = settings["mail.clientSecret"] ?? "";
  if (clientSecret.length > 4096) throw new Error("Invalid mail credential.");
  return { ...fields, clientSecret };
}
// The returned plaintext exists only in server memory and encrypted control envelopes.
// Retain the original ciphertext/key fingerprint for legacy rollback.
export function persistMailCredential(configuration: InstallationConfiguration): InstallationConfiguration {
  const settings = { ...configuration.settings };
  if (settings["mail.clientSecret"] === undefined && settings["mail.clientSecretEncrypted"]) {
    const keyHash = createHash("sha256").update(process.env.APP_SETTINGS_ENCRYPTION_KEY ?? "").digest("hex");
    if (keyHash !== configuration.settingsKeyHash) throw new Error("Original mail key required.");
    settings["mail.clientSecret"] = decryptAppSettingSecret(settings["mail.clientSecretEncrypted"]);
  }
  const result = { ...configuration, settings };
  mailValues(result);
  return result;
}
