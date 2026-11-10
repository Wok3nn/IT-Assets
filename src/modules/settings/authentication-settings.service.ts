import { z } from "zod";

import { db } from "@/services/database";
import { control, managed } from "@/modules/database-management/control-store";

const AUTHENTICATION_SETTINGS_CATEGORY = "authentication";
const AUTH_LOCAL_ENABLED_KEY = "authentication.local.enabled";
const AUTH_ENTRA_ENABLED_KEY = "authentication.entra.enabled";
const AUTH_ENTRA_SSO_ENABLED_KEY = "authentication.entra.ssoEnabled";
const AUTH_ENTRA_TENANT_ID_KEY = "authentication.entra.tenantId";
const AUTH_ENTRA_CLIENT_ID_KEY = "authentication.entra.clientId";
const AUTH_ENTRA_SECRET_REFERENCE_KEY = "authentication.entra.secretReference";
const AUTH_ENTRA_REDIRECT_URI_KEY = "authentication.entra.redirectUri";
const AUTH_ENTRA_GROUP_MAPPINGS_KEY = "authentication.entra.groupMappings";
const ENTRA_GROUP_OBJECT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const AUTHENTICATION_SETTINGS_KEYS = [
  AUTH_LOCAL_ENABLED_KEY,
  AUTH_ENTRA_ENABLED_KEY,
  AUTH_ENTRA_SSO_ENABLED_KEY,
  AUTH_ENTRA_TENANT_ID_KEY,
  AUTH_ENTRA_CLIENT_ID_KEY,
  AUTH_ENTRA_SECRET_REFERENCE_KEY,
  AUTH_ENTRA_REDIRECT_URI_KEY,
  AUTH_ENTRA_GROUP_MAPPINGS_KEY,
] as const;

export type AuthenticationGroupRoleMapping = {
  roleKey: string;
  roleName: string;
  groupId: string;
  groupName: string;
};

export type AuthenticationSettings = {
  localAuthEnabled: boolean;
  entraEnabled: boolean;
  entraSsoEnabled: boolean;
  entraTenantId: string;
  entraClientId: string;
  entraSecretReference: string;
  entraRedirectUri: string;
  groupMappings: AuthenticationGroupRoleMapping[];
};

function normalizeGroupId(groupId: string) {
  return groupId.trim().toLowerCase();
}

export type EntraAuthenticationConfig = {
  enabled: boolean;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  configuredRedirectUri: string;
};

const authenticationGroupRoleMappingSchema = z.object({
  roleKey: z.string().trim().min(1).max(80),
  roleName: z.string().trim().min(1).max(120),
  groupId: z.string()
    .trim()
    .regex(
      ENTRA_GROUP_OBJECT_ID_PATTERN,
      "Enter a valid Entra group Object ID in GUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.",
    )
    .transform(normalizeGroupId),
  groupName: z.string().trim().max(160),
});

export const authenticationSettingsSchema = z.object({
  localAuthEnabled: z.boolean(),
  entraEnabled: z.boolean(),
  entraSsoEnabled: z.boolean(),
  entraTenantId: z.string().trim().max(160),
  entraClientId: z.string().trim().max(160),
  entraSecretReference: z.string().trim().max(240),
  entraRedirectUri: z.string().trim().max(300),
  groupMappings: z.array(authenticationGroupRoleMappingSchema),
});

async function upsertAuthenticationSetting(key: string, value: string) {
  await db.setting.upsert({
    where: {
      key,
    },
    update: {
      category: AUTHENTICATION_SETTINGS_CATEGORY,
      value,
    },
    create: {
      category: AUTHENTICATION_SETTINGS_CATEGORY,
      key,
      value,
    },
  });
}

function parseBooleanSetting(value: string | undefined, fallback: boolean) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
}

function parseGroupMappings(value: string | undefined): AuthenticationGroupRoleMapping[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = z.array(authenticationGroupRoleMappingSchema).safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export async function getAuthenticationSettings() {
  if (managed()) {
    const saved=control().authentication();
    if (saved) return authenticationSettingsSchema.parse(saved);
  }
  const settings = await db.setting.findMany({
    where: {
      key: {
        in: [...AUTHENTICATION_SETTINGS_KEYS],
      },
    },
    select: {
      key: true,
      value: true,
    },
  });
  const settingsByKey = new Map(settings.map((setting) => [setting.key, setting.value]));

  return {
    localAuthEnabled: parseBooleanSetting(settingsByKey.get(AUTH_LOCAL_ENABLED_KEY), true),
    entraEnabled: parseBooleanSetting(settingsByKey.get(AUTH_ENTRA_ENABLED_KEY), false),
    entraSsoEnabled: parseBooleanSetting(settingsByKey.get(AUTH_ENTRA_SSO_ENABLED_KEY), false),
    entraTenantId: settingsByKey.get(AUTH_ENTRA_TENANT_ID_KEY) ?? "",
    entraClientId: settingsByKey.get(AUTH_ENTRA_CLIENT_ID_KEY) ?? "",
    entraSecretReference: settingsByKey.get(AUTH_ENTRA_SECRET_REFERENCE_KEY) ?? "",
    entraRedirectUri: settingsByKey.get(AUTH_ENTRA_REDIRECT_URI_KEY) ?? "",
    groupMappings: parseGroupMappings(settingsByKey.get(AUTH_ENTRA_GROUP_MAPPINGS_KEY)),
  } satisfies AuthenticationSettings;
}

export async function resolveEntraMappedRoleKeys(groupIds: string[]) {
  if (groupIds.length === 0) {
    return [];
  }

  const settings = await getAuthenticationSettings();
  const normalizedGroupIds = new Set(groupIds.map(normalizeGroupId).filter(Boolean));
  const mappedRoleKeys = settings.groupMappings
    .filter((mapping) => normalizedGroupIds.has(normalizeGroupId(mapping.groupId)))
    .map((mapping) => mapping.roleKey.trim())
    .filter(Boolean);

  return Array.from(new Set(mappedRoleKeys));
}

export async function updateAuthenticationSettings(input: AuthenticationSettings) {
  const result = authenticationSettingsSchema.safeParse(input);

  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Authentication settings could not be saved.");
  }

  const parsed = result.data;

  if (!parsed.localAuthEnabled) {
    throw new Error("Local sign-in must remain enabled until another working admin recovery path is implemented.");
  }

  if (managed()) {
    if(parsed.entraEnabled && !parsed.entraSecretReference) throw new Error("Enter the managed Entra secret environment variable name.");
    control().saveAuthentication(parsed);
    return parsed;
  }
  await Promise.all([
    upsertAuthenticationSetting(AUTH_LOCAL_ENABLED_KEY, String(parsed.localAuthEnabled)),
    upsertAuthenticationSetting(AUTH_ENTRA_ENABLED_KEY, String(parsed.entraEnabled)),
    upsertAuthenticationSetting(AUTH_ENTRA_SSO_ENABLED_KEY, String(parsed.entraSsoEnabled)),
    upsertAuthenticationSetting(AUTH_ENTRA_TENANT_ID_KEY, parsed.entraTenantId),
    upsertAuthenticationSetting(AUTH_ENTRA_CLIENT_ID_KEY, parsed.entraClientId),
    upsertAuthenticationSetting(AUTH_ENTRA_SECRET_REFERENCE_KEY, parsed.entraSecretReference),
    upsertAuthenticationSetting(AUTH_ENTRA_REDIRECT_URI_KEY, parsed.entraRedirectUri),
    upsertAuthenticationSetting(AUTH_ENTRA_GROUP_MAPPINGS_KEY, JSON.stringify(parsed.groupMappings)),
  ]);

  return parsed;
}

function resolveSecretReference(secretReference: string) {
  const trimmed = secretReference.trim();

  if (!trimmed) {
    return "";
  }

  if (managed()) return /^IT_ASSETS_ENTRA_SECRET_[A-Z0-9_]+$/.test(trimmed) ? process.env[trimmed] ?? "" : "";
  return process.env[trimmed] ?? trimmed;
}

export async function getEntraAuthenticationConfig() {
  const settings = await getAuthenticationSettings();

  return {
    enabled: settings.entraEnabled,
    tenantId: settings.entraTenantId,
    clientId: settings.entraClientId,
    clientSecret: resolveSecretReference(settings.entraSecretReference),
    configuredRedirectUri: settings.entraRedirectUri,
  } satisfies EntraAuthenticationConfig;
}

export function isEntraAuthenticationConfigured(config: EntraAuthenticationConfig) {
  return Boolean(config.enabled && config.tenantId && config.clientId && config.clientSecret);
}
