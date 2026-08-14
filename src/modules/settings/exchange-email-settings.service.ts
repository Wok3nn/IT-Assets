import "server-only";

import { z } from "zod";

import {
  AppSettingsEncryptionError,
  decryptAppSettingSecret,
  encryptAppSettingSecret,
  getAppSettingsEncryptionKeyStatus,
} from "@/services/app-settings-encryption";
import { db } from "@/services/database";

const EXCHANGE_EMAIL_SETTINGS_CATEGORY = "exchange-email";
const EXCHANGE_ENABLED_KEY = "mail.enabled";
const EXCHANGE_TENANT_ID_KEY = "mail.tenantId";
const EXCHANGE_CLIENT_ID_KEY = "mail.clientId";
const EXCHANGE_CLIENT_SECRET_ENCRYPTED_KEY = "mail.clientSecretEncrypted";
const EXCHANGE_SENDER_MAILBOX_KEY = "mail.senderMailbox";
const EXCHANGE_ADMIN_RECIPIENT_KEY = "mail.adminRecipient";
const EXCHANGE_NOTIFY_BORROWER_ON_BORROW_KEY = "mail.notifyBorrowerOnBorrow";
const EXCHANGE_NOTIFY_BORROWER_ON_RETURN_KEY = "mail.notifyBorrowerOnReturn";
const EXCHANGE_NOTIFY_ADMIN_ON_BORROW_KEY = "mail.notifyAdminOnBorrow";
const EXCHANGE_NOTIFY_ADMIN_ON_RETURN_KEY = "mail.notifyAdminOnReturn";

const EXCHANGE_EMAIL_SETTINGS_KEYS = [
  EXCHANGE_ENABLED_KEY,
  EXCHANGE_TENANT_ID_KEY,
  EXCHANGE_CLIENT_ID_KEY,
  EXCHANGE_CLIENT_SECRET_ENCRYPTED_KEY,
  EXCHANGE_SENDER_MAILBOX_KEY,
  EXCHANGE_ADMIN_RECIPIENT_KEY,
  EXCHANGE_NOTIFY_BORROWER_ON_BORROW_KEY,
  EXCHANGE_NOTIFY_BORROWER_ON_RETURN_KEY,
  EXCHANGE_NOTIFY_ADMIN_ON_BORROW_KEY,
  EXCHANGE_NOTIFY_ADMIN_ON_RETURN_KEY,
] as const;

const optionalEmailSchema = z.union([z.string().trim().email().max(240), z.literal("")]);
const optionalGuidSchema = z.union([
  z.string().trim().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Enter a valid GUID value."),
  z.literal(""),
]);

const exchangeEmailSettingsSchema = z.object({
  mailEnabled: z.boolean(),
  tenantId: optionalGuidSchema,
  clientId: optionalGuidSchema,
  clientSecret: z.string().trim().max(4096).optional(),
  senderMailbox: optionalEmailSchema,
  adminRecipient: optionalEmailSchema,
  notifyBorrowerOnBorrow: z.boolean(),
  notifyBorrowerOnReturn: z.boolean(),
  notifyAdminOnBorrow: z.boolean(),
  notifyAdminOnReturn: z.boolean(),
});

export type ExchangeEmailSettings = z.infer<typeof exchangeEmailSettingsSchema> & {
  credentialStatus: ExchangeEmailCredentialStatus;
};

export type ExchangeEmailCredentialStatus = {
  tenantIdConfigured: boolean;
  clientIdConfigured: boolean;
  clientSecretConfigured: boolean;
  encryptionKeyConfigured: boolean;
};

export type ExchangeEmailRuntimeConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  senderMailbox: string;
};

function parseBooleanSetting(value: string | undefined, fallback: boolean) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

async function upsertExchangeEmailSetting(key: string, value: string) {
  await db.setting.upsert({
    where: { key },
    update: {
      category: EXCHANGE_EMAIL_SETTINGS_CATEGORY,
      value,
    },
    create: {
      category: EXCHANGE_EMAIL_SETTINGS_CATEGORY,
      key,
      value,
    },
  });
}

function getExchangeEmailCredentialStatus(settingsByKey: Map<string, string>): ExchangeEmailCredentialStatus {
  return {
    tenantIdConfigured: Boolean(settingsByKey.get(EXCHANGE_TENANT_ID_KEY)?.trim()),
    clientIdConfigured: Boolean(settingsByKey.get(EXCHANGE_CLIENT_ID_KEY)?.trim()),
    clientSecretConfigured: Boolean(settingsByKey.get(EXCHANGE_CLIENT_SECRET_ENCRYPTED_KEY)?.trim()),
    encryptionKeyConfigured: getAppSettingsEncryptionKeyStatus().configured,
  };
}

export async function getExchangeEmailSettings() {
  const settings = await db.setting.findMany({
    where: {
      key: {
        in: [...EXCHANGE_EMAIL_SETTINGS_KEYS],
      },
    },
    select: {
      key: true,
      value: true,
    },
  });
  const settingsByKey = new Map(settings.map((setting) => [setting.key, setting.value]));

  return {
    mailEnabled: parseBooleanSetting(settingsByKey.get(EXCHANGE_ENABLED_KEY), false),
    tenantId: settingsByKey.get(EXCHANGE_TENANT_ID_KEY) ?? "",
    clientId: settingsByKey.get(EXCHANGE_CLIENT_ID_KEY) ?? "",
    clientSecret: "",
    senderMailbox: settingsByKey.get(EXCHANGE_SENDER_MAILBOX_KEY) ?? "",
    adminRecipient: settingsByKey.get(EXCHANGE_ADMIN_RECIPIENT_KEY) ?? "",
    notifyBorrowerOnBorrow: parseBooleanSetting(settingsByKey.get(EXCHANGE_NOTIFY_BORROWER_ON_BORROW_KEY), true),
    notifyBorrowerOnReturn: parseBooleanSetting(settingsByKey.get(EXCHANGE_NOTIFY_BORROWER_ON_RETURN_KEY), true),
    notifyAdminOnBorrow: parseBooleanSetting(settingsByKey.get(EXCHANGE_NOTIFY_ADMIN_ON_BORROW_KEY), false),
    notifyAdminOnReturn: parseBooleanSetting(settingsByKey.get(EXCHANGE_NOTIFY_ADMIN_ON_RETURN_KEY), false),
    credentialStatus: getExchangeEmailCredentialStatus(settingsByKey),
  } satisfies ExchangeEmailSettings;
}

export async function updateExchangeEmailSettings(input: Omit<ExchangeEmailSettings, "credentialStatus">) {
  const result = exchangeEmailSettingsSchema.safeParse(input);

  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Exchange Email Service settings could not be saved.");
  }

  const parsed = result.data;
  const replacementSecret = parsed.clientSecret?.trim();

  await Promise.all([
    upsertExchangeEmailSetting(EXCHANGE_ENABLED_KEY, String(parsed.mailEnabled)),
    upsertExchangeEmailSetting(EXCHANGE_TENANT_ID_KEY, parsed.tenantId),
    upsertExchangeEmailSetting(EXCHANGE_CLIENT_ID_KEY, parsed.clientId),
    upsertExchangeEmailSetting(EXCHANGE_SENDER_MAILBOX_KEY, parsed.senderMailbox),
    upsertExchangeEmailSetting(EXCHANGE_ADMIN_RECIPIENT_KEY, parsed.adminRecipient),
    upsertExchangeEmailSetting(EXCHANGE_NOTIFY_BORROWER_ON_BORROW_KEY, String(parsed.notifyBorrowerOnBorrow)),
    upsertExchangeEmailSetting(EXCHANGE_NOTIFY_BORROWER_ON_RETURN_KEY, String(parsed.notifyBorrowerOnReturn)),
    upsertExchangeEmailSetting(EXCHANGE_NOTIFY_ADMIN_ON_BORROW_KEY, String(parsed.notifyAdminOnBorrow)),
    upsertExchangeEmailSetting(EXCHANGE_NOTIFY_ADMIN_ON_RETURN_KEY, String(parsed.notifyAdminOnReturn)),
  ]);

  if (replacementSecret) {
    await upsertExchangeEmailSetting(EXCHANGE_CLIENT_SECRET_ENCRYPTED_KEY, encryptAppSettingSecret(replacementSecret));
  }

  return parsed;
}

export async function clearExchangeEmailClientSecret() {
  await db.setting.deleteMany({
    where: {
      key: EXCHANGE_CLIENT_SECRET_ENCRYPTED_KEY,
    },
  });
}

async function getEncryptedClientSecretSetting() {
  return db.setting.findUnique({
    where: { key: EXCHANGE_CLIENT_SECRET_ENCRYPTED_KEY },
    select: { value: true },
  });
}

export async function getExchangeEmailRuntimeConfig() {
  const settings = await getExchangeEmailSettings();
  const tenantId = settings.tenantId.trim();
  const clientId = settings.clientId.trim();
  const senderMailbox = settings.senderMailbox.trim();
  const encryptedClientSecret = await getEncryptedClientSecretSetting();

  if (!tenantId || !clientId || !encryptedClientSecret?.value || !senderMailbox) {
    return null;
  }

  let clientSecret = "";

  try {
    clientSecret = decryptAppSettingSecret(encryptedClientSecret.value);
  } catch (error) {
    if (error instanceof AppSettingsEncryptionError) {
      return null;
    }

    throw error;
  }

  if (!clientSecret) {
    return null;
  }

  return {
    tenantId,
    clientId,
    clientSecret,
    senderMailbox,
  } satisfies ExchangeEmailRuntimeConfig;
}
