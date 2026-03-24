import { Prisma } from "@prisma/client";
import { z } from "zod";

import { db } from "@/services/database";

const generalSettingsSchema = z.object({
  startingAssetTagNumber: z.coerce.number().int().min(1).max(999999999),
});

const assetStatusSchema = z.object({
  statusId: z.string().trim().cuid().optional(),
  name: z.string().trim().min(2).max(40),
  color: z.string().trim().regex(/^#([0-9a-fA-F]{6})$/),
});

const STARTING_ASSET_TAG_KEY = "assets.startingTagNumber";
const DEFAULT_STARTING_ASSET_TAG_NUMBER = 5000;

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
  const setting = await db.setting.findUnique({
    where: {
      key: STARTING_ASSET_TAG_KEY,
    },
    select: {
      value: true,
    },
  });

  const parsed = Number.parseInt(setting?.value ?? "", 10);

  return {
    startingAssetTagNumber:
      Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_STARTING_ASSET_TAG_NUMBER,
  };
}

export async function updateGeneralSettings(input: { startingAssetTagNumber: number }) {
  const parsed = generalSettingsSchema.parse(input);

  await db.setting.upsert({
    where: {
      key: STARTING_ASSET_TAG_KEY,
    },
    update: {
      category: "general",
      value: String(parsed.startingAssetTagNumber),
    },
    create: {
      category: "general",
      key: STARTING_ASSET_TAG_KEY,
      value: String(parsed.startingAssetTagNumber),
    },
  });

  return parsed;
}