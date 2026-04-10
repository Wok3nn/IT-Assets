import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { db } from "@/services/database";

const generalSettingsSchema = z.object({
  startingAssetTagNumber: z.coerce.number().int().min(1).max(999999999),
  appTitle: z.string().trim().min(1).max(80),
  sessionTimeoutMinutes: z.coerce.number().int().min(5).max(60),
});

const brandingSettingsSchema = z.object({
  brandingLightLogoUrl: z.string().trim().optional(),
  brandingDarkLogoUrl: z.string().trim().optional(),
  brandingLightIconUrl: z.string().trim().optional(),
  brandingDarkIconUrl: z.string().trim().optional(),
});

const assetStatusSchema = z.object({
  statusId: z.string().trim().cuid().optional(),
  name: z.string().trim().min(2).max(40),
  color: z.string().trim().regex(/^#([0-9a-fA-F]{6})$/),
});

const STARTING_ASSET_TAG_KEY = "assets.startingTagNumber";
const APP_TITLE_KEY = "app.title";
const SESSION_TIMEOUT_MINUTES_KEY = "session.timeoutMinutes";
const BRANDING_LIGHT_LOGO_KEY = "branding.logo.light";
const BRANDING_DARK_LOGO_KEY = "branding.logo.dark";
const BRANDING_LIGHT_ICON_KEY = "branding.icon.light";
const BRANDING_DARK_ICON_KEY = "branding.icon.dark";
const DEFAULT_STARTING_ASSET_TAG_NUMBER = 5000;
export const DEFAULT_APP_TITLE = "IT-Asset-Tracker";
export const DEFAULT_SESSION_TIMEOUT_MINUTES = 15;
export const DEFAULT_BRANDING = {
  lightLogoUrl: "/branding/asset-tracker-logo-light-transparent.png",
  darkLogoUrl: "/branding/asset-tracker-logo-dark-transparent.png",
  lightIconUrl: "/branding/asset-tracker-logo-light-transparent.ico",
  darkIconUrl: "/branding/asset-tracker-logo-dark-transparent.ico",
} as const;

const BRANDING_SETTINGS_KEYS = [
  BRANDING_LIGHT_LOGO_KEY,
  BRANDING_DARK_LOGO_KEY,
  BRANDING_LIGHT_ICON_KEY,
  BRANDING_DARK_ICON_KEY,
] as const;
const BRANDING_UPLOAD_DIRECTORY = path.join(process.cwd(), "public", "branding", "uploads");
const BRANDING_UPLOAD_URL_PREFIX = "/branding/uploads";
const MAX_BRANDING_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const LOGO_MIME_TYPES = new Set(["image/png"]);
const ICON_MIME_TYPES = new Set(["image/x-icon", "image/vnd.microsoft.icon", "image/png"]);

type DatabaseClient = typeof db | Prisma.TransactionClient;

export const ASSET_STATUS_DEFAULTS = [
  { key: "IN_STOCK", name: "In Stock", color: "#c4b5fd" },
  { key: "ASSIGNED", name: "Assigned", color: "#22c55e" },
  { key: "MAINTENANCE", name: "Maintenance", color: "#ef4444" },
  { key: "RETIRED", name: "Retired", color: "#94a3b8" },
] as const;

function slugifyStatusName(name: string) {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_") || "CUSTOM_STATUS";
}

async function createUniqueStatusKey(name: string) {
  const baseKey = slugifyStatusName(name);
  let candidate = baseKey;
  let suffix = 2;

  while (await db.assetStatus.findUnique({ where: { key: candidate }, select: { id: true } })) {
    candidate = `${baseKey}_${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export async function ensureDefaultAssetStatuses(client: DatabaseClient = db) {
  for (const status of ASSET_STATUS_DEFAULTS) {
    await client.assetStatus.upsert({
      where: { key: status.key },
      update: {},
      create: status,
    });
  }
}

export async function listAssetStatuses() {
  await ensureDefaultAssetStatuses();

  return db.assetStatus.findMany({
    select: {
      id: true,
      key: true,
      name: true,
      color: true,
      _count: {
        select: {
          assets: true,
        },
      },
    },
    orderBy: [{ name: "asc" }],
  });
}

export async function getAssetStatusByKey(key: string, client: DatabaseClient = db) {
  await ensureDefaultAssetStatuses(client);

  return client.assetStatus.findUnique({
    where: { key },
    select: {
      id: true,
      key: true,
      name: true,
      color: true,
    },
  });
}

export async function upsertAssetStatus(input: { statusId?: string; name: string; color: string }) {
  const parsed = assetStatusSchema.parse(input);

  if (parsed.statusId) {
    const existingStatus = await db.assetStatus.findUnique({
      where: { id: parsed.statusId },
      select: { id: true },
    });

    if (!existingStatus) {
      throw new Error("Status not found.");
    }

    return db.assetStatus.update({
      where: { id: existingStatus.id },
      data: {
        name: parsed.name,
        color: parsed.color,
      },
    });
  }

  const key = await createUniqueStatusKey(parsed.name);

  return db.assetStatus.create({
    data: {
      key,
      name: parsed.name,
      color: parsed.color,
    },
  });
}

export async function getGeneralSettings() {
  const settings = await db.setting.findMany({
    where: {
      key: {
        in: [STARTING_ASSET_TAG_KEY, APP_TITLE_KEY, SESSION_TIMEOUT_MINUTES_KEY, ...BRANDING_SETTINGS_KEYS],
      },
    },
    select: {
      key: true,
      value: true,
    },
  });
  const settingsByKey = new Map(settings.map((setting) => [setting.key, setting.value]));

  const parsed = Number.parseInt(settingsByKey.get(STARTING_ASSET_TAG_KEY) ?? "", 10);
  const parsedSessionTimeoutMinutes = Number.parseInt(settingsByKey.get(SESSION_TIMEOUT_MINUTES_KEY) ?? "", 10);

  return {
    appTitle: settingsByKey.get(APP_TITLE_KEY) || DEFAULT_APP_TITLE,
    startingAssetTagNumber:
      Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_STARTING_ASSET_TAG_NUMBER,
    sessionTimeoutMinutes:
      Number.isInteger(parsedSessionTimeoutMinutes) && parsedSessionTimeoutMinutes >= 5 && parsedSessionTimeoutMinutes <= 60
        ? parsedSessionTimeoutMinutes
        : DEFAULT_SESSION_TIMEOUT_MINUTES,
    branding: {
      lightLogoUrl: settingsByKey.get(BRANDING_LIGHT_LOGO_KEY) || DEFAULT_BRANDING.lightLogoUrl,
      darkLogoUrl: settingsByKey.get(BRANDING_DARK_LOGO_KEY) || DEFAULT_BRANDING.darkLogoUrl,
      lightIconUrl: settingsByKey.get(BRANDING_LIGHT_ICON_KEY) || DEFAULT_BRANDING.lightIconUrl,
      darkIconUrl: settingsByKey.get(BRANDING_DARK_ICON_KEY) || DEFAULT_BRANDING.darkIconUrl,
      defaults: DEFAULT_BRANDING,
    },
  };
}

async function upsertSetting(key: string, value: string) {
  await db.setting.upsert({
    where: {
      key,
    },
    update: {
      category: "general",
      value,
    },
    create: {
      category: "general",
      key,
      value,
    },
  });
}

export async function updateGeneralSettings(input: {
  appTitle: string;
  startingAssetTagNumber: number;
  sessionTimeoutMinutes: number;
}) {
  const parsed = generalSettingsSchema.parse(input);

  await upsertSetting(APP_TITLE_KEY, parsed.appTitle || DEFAULT_APP_TITLE);
  await upsertSetting(STARTING_ASSET_TAG_KEY, String(parsed.startingAssetTagNumber));
  await upsertSetting(SESSION_TIMEOUT_MINUTES_KEY, String(parsed.sessionTimeoutMinutes));

  return parsed;
}

export async function getSessionTimeoutMinutes() {
  const setting = await db.setting.findUnique({
    where: {
      key: SESSION_TIMEOUT_MINUTES_KEY,
    },
    select: {
      value: true,
    },
  });
  const parsed = Number.parseInt(setting?.value ?? "", 10);

  return Number.isInteger(parsed) && parsed >= 5 && parsed <= 60
    ? parsed
    : DEFAULT_SESSION_TIMEOUT_MINUTES;
}

export async function updateBrandingSettings(input: {
  brandingLightLogoUrl?: string;
  brandingDarkLogoUrl?: string;
  brandingLightIconUrl?: string;
  brandingDarkIconUrl?: string;
}) {
  const parsed = brandingSettingsSchema.parse(input);

  await upsertSetting(BRANDING_LIGHT_LOGO_KEY, parsed.brandingLightLogoUrl || DEFAULT_BRANDING.lightLogoUrl);
  await upsertSetting(BRANDING_DARK_LOGO_KEY, parsed.brandingDarkLogoUrl || DEFAULT_BRANDING.darkLogoUrl);
  await upsertSetting(BRANDING_LIGHT_ICON_KEY, parsed.brandingLightIconUrl || DEFAULT_BRANDING.lightIconUrl);
  await upsertSetting(BRANDING_DARK_ICON_KEY, parsed.brandingDarkIconUrl || DEFAULT_BRANDING.darkIconUrl);

  return parsed;
}

function getBrandingFileExtension(file: File, allowedMimeTypes: Set<string>) {
  if (!allowedMimeTypes.has(file.type)) {
    throw new Error("Unsupported branding file type.");
  }

  if (file.type === "image/png") {
    return "png";
  }

  return "ico";
}

export async function saveBrandingUpload(file: File, kind: "logo" | "icon") {
  if (file.size <= 0) {
    return null;
  }

  if (file.size > MAX_BRANDING_FILE_SIZE_BYTES) {
    throw new Error("Branding uploads must be 2 MB or smaller.");
  }

  const extension = getBrandingFileExtension(file, kind === "logo" ? LOGO_MIME_TYPES : ICON_MIME_TYPES);
  const fileName = `${kind}-${randomUUID()}.${extension}`;

  await mkdir(BRANDING_UPLOAD_DIRECTORY, { recursive: true });
  await writeFile(path.join(BRANDING_UPLOAD_DIRECTORY, fileName), Buffer.from(await file.arrayBuffer()));

  return `${BRANDING_UPLOAD_URL_PREFIX}/${fileName}`;
}

export async function getBrandingSettings() {
  const generalSettings = await getGeneralSettings();

  return generalSettings.branding;
}

export async function getAppShellBrandingSettings() {
  const generalSettings = await getGeneralSettings();

  return {
    appTitle: generalSettings.appTitle,
    branding: generalSettings.branding,
  };
}
