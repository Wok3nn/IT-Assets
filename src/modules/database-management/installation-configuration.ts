import { z } from "zod";

// Explicit allowlist: never import role mappings, grants, tokens or reminder policy.
export const installationSettingKeys = [
  "app.title", "session.timeoutMinutes",
  "branding.logo.light", "branding.logo.dark", "branding.icon.light", "branding.icon.dark",
  "authentication.entra.tenantId", "authentication.entra.clientId",
  "authentication.entra.secretReference", "authentication.entra.redirectUri",
  "mail.tenantId", "mail.clientId", "mail.clientSecretEncrypted", "mail.senderMailbox",
] as const;

export const installationConfigurationSchema = z.object({
  format: z.literal(1),
  source: z.union([z.object({
    provider: z.literal("mariadb"), host: z.string().min(1),
    port: z.number().int().min(1).max(65535), database: z.string().min(1),
  }).strict(), z.object({ provider: z.literal("installation") }).strict()]),
  settings: z.record(z.enum(installationSettingKeys), z.string().max(16384)),
  // Deployment timezone is captured only when explicitly supplied, never inferred.
  timeZone: z.string().max(120).nullable(),
  // Staging embeds files atomically; runtime publication is a later increment.
  branding: z.array(z.object({
    name: z.string().regex(/^(?:logo|icon)-[a-f0-9-]{36}\.(?:png|ico)$/),
    base64: z.string().max(2796204).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
  }).strict()).max(4),
  settingsKeyHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
}).strict();

export type InstallationConfiguration = z.infer<typeof installationConfigurationSchema>;

export function canonicalInstallationConfiguration(input: InstallationConfiguration) {
  const parsed = installationConfigurationSchema.parse(input);
  if (parsed.timeZone) new Intl.DateTimeFormat("en", { timeZone: parsed.timeZone });
  const reference = parsed.settings["authentication.entra.secretReference"];
  if (reference && !/^IT_ASSETS_ENTRA_SECRET_[A-Z0-9_]+$/.test(reference))
    throw new Error("Installation configuration requires a managed Entra secret reference.");
  if (parsed.settings["mail.clientSecretEncrypted"] && !parsed.settingsKeyHash)
    throw new Error("Installation configuration requires the verified original mail encryption key.");
  if (new Set(parsed.branding.map(file => file.name)).size !== parsed.branding.length)
    throw new Error("Duplicate branding file.");
  const referenced = new Set<string>();
  for (const [key, value] of Object.entries(parsed.settings)) {
    if (!key.startsWith("branding.")) continue;
    if (value.startsWith("/api/workspace-branding")) throw new Error("Managed branding requires a separate import review.");
    if (!value.startsWith("/branding/uploads")) continue;
    const match = /^\/branding\/uploads\/((?:logo|icon)-[a-f0-9-]{36}\.(?:png|ico))$/.exec(value);
    if (!match || !parsed.branding.some(file => file.name === match[1])) throw new Error("Referenced branding file is missing.");
    referenced.add(match[1]);
  }
  if (parsed.branding.some(file => !referenced.has(file.name))) throw new Error("Unreferenced branding file.");
  return JSON.stringify({ ...parsed,
    settings: Object.fromEntries(Object.entries(parsed.settings).sort(([a], [b]) => a.localeCompare(b))),
    branding: [...parsed.branding].sort((a, b) => a.name.localeCompare(b.name)),
  });
}
