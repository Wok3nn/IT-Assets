import { Prisma } from "@prisma/client";
import { z } from "zod";

import {
  ensureDefaultAssetStatuses,
  getAssetStatusByKey,
  getGeneralSettings,
} from "@/modules/settings/settings.service";
import { db } from "@/services/database";

const MAX_CATEGORY_LEVELS = 5;
const optionalIdSchema = z.union([z.string().trim().cuid(), z.literal("")]).optional();
const optionalTextSchema = z.union([z.string().trim().max(240), z.literal("")]).optional();
const optionalDateSchema = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).optional();
const optionalAssetTagSchema = z.union([z.string().trim().min(1).max(80), z.literal("")]).optional();

const assetSchema = z
  .object({
    assetId: z.string().trim().cuid().optional(),
    name: z.string().trim().min(2).max(120),
    assetTag: optionalAssetTagSchema,
    serialNumber: optionalTextSchema,
    notes: z.union([z.string().trim().max(2000), z.literal("")]).optional(),
    purchaseDate: optionalDateSchema,
    warrantyExpiry: optionalDateSchema,
    categoryId: optionalIdSchema,
    statusId: optionalIdSchema,
    assignedUserId: optionalIdSchema,
    assignedLocationId: optionalIdSchema,
    scopeIds: z.array(z.string().trim().cuid()).default([]),
  })
  .superRefine((input, ctx) => {
    if (input.purchaseDate && input.warrantyExpiry && input.purchaseDate > input.warrantyExpiry) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["warrantyExpiry"],
        message: "Warranty expiry cannot be earlier than the purchase date.",
      });
    }
  });

export type AssetSortOption = "updated-desc" | "name-asc" | "tag-asc" | "purchase-desc";

type DatabaseClient = typeof db | Prisma.TransactionClient;

type AssetAuditEntry = {
  actorUserId?: string;
  action: string;
  entityId: string;
  summary: string;
  payload?: unknown;
};

function normalizeOptional(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeDate(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return new Date(`${trimmed}T12:00:00.000Z`);
}

function normalizeAssetTag(assetTag?: string) {
  const trimmed = assetTag?.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

async function getStatusByKey(client: DatabaseClient, key: string) {
  const status = await getAssetStatusByKey(key, client);

  if (!status) {
    throw new Error(`Asset status ${key} is not available.`);
  }

  return status;
}

async function createAssetAuditEntry(client: DatabaseClient, input: AssetAuditEntry) {
  await client.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: "asset",
      entityId: input.entityId,
      summary: input.summary,
      payloadJson: input.payload === undefined ? null : JSON.stringify(input.payload),
    },
  });
}

async function ensureEntityExists(
  client: DatabaseClient,
  model: "assetStatus" | "user" | "location",
  id: string | null,
  label: string,
) {
  if (!id) {
    return null;
  }

  const entity =
    model === "assetStatus"
      ? await client.assetStatus.findUnique({ where: { id }, select: { id: true } })
      : model === "user"
        ? await client.user.findUnique({ where: { id }, select: { id: true } })
        : await client.location.findUnique({ where: { id }, select: { id: true } });

  if (!entity) {
    throw new Error(`${label} no longer exists.`);
  }

  return id;
}

async function validateScopeIds(client: DatabaseClient, scopeIds: string[]) {
  if (scopeIds.length === 0) {
    return [];
  }

  const scopes = await client.scope.findMany({
    where: {
      id: { in: scopeIds },
    },
    select: {
      id: true,
    },
  });

  if (scopes.length !== scopeIds.length) {
    throw new Error("One or more selected departments no longer exist.");
  }

  return scopeIds;
}

async function validateCategoryId(client: DatabaseClient, categoryId: string | null) {
  if (!categoryId) {
    return null;
  }

  const categories = await client.category.findMany({
    select: {
      id: true,
      parentId: true,
    },
  });

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  let current = categoryById.get(categoryId) ?? null;
  let depth = 0;

  while (current) {
    depth += 1;
    if (depth > MAX_CATEGORY_LEVELS) {
      throw new Error(`Assets currently support a maximum of ${MAX_CATEGORY_LEVELS} category levels.`);
    }

    current = current.parentId ? categoryById.get(current.parentId) ?? null : null;
  }

  if (depth === 0) {
    throw new Error("Category no longer exists.");
  }

  return categoryId;
}

async function parseAssetInput(
  client: DatabaseClient,
  input: {
    assetId?: string;
    name: string;
    assetTag?: string;
    serialNumber?: string;
    notes?: string;
    purchaseDate?: string;
    warrantyExpiry?: string;
    categoryId?: string;
    statusId?: string;
    assignedUserId?: string;
    assignedLocationId?: string;
    scopeIds?: string[];
  },
) {
  const parsed = assetSchema.parse({
    ...input,
    assetTag: normalizeAssetTag(input.assetTag) ?? "",
    scopeIds: Array.from(new Set(input.scopeIds ?? [])).filter(Boolean),
  });

  const categoryId = normalizeOptional(parsed.categoryId);
  const statusId = normalizeOptional(parsed.statusId);
  const assignedUserId = normalizeOptional(parsed.assignedUserId);
  const assignedLocationId = normalizeOptional(parsed.assignedLocationId);

  const [validatedCategoryId, validatedStatusId, validatedAssignedUserId, validatedAssignedLocationId, validatedScopeIds] =
    await Promise.all([
      validateCategoryId(client, categoryId),
      ensureEntityExists(client, "assetStatus", statusId, "Status"),
      ensureEntityExists(client, "user", assignedUserId, "Assigned user"),
      ensureEntityExists(client, "location", assignedLocationId, "Assigned location"),
      validateScopeIds(client, parsed.scopeIds),
    ]);

  return {
    assetId: parsed.assetId,
    name: parsed.name,
    assetTag: normalizeAssetTag(parsed.assetTag),
    serialNumber: normalizeOptional(parsed.serialNumber),
    notes: normalizeOptional(parsed.notes),
    purchaseDate: normalizeDate(parsed.purchaseDate),
    warrantyExpiry: normalizeDate(parsed.warrantyExpiry),
    categoryId: validatedCategoryId,
    statusId: validatedStatusId,
    assignedUserId: validatedAssignedUserId,
    assignedLocationId: validatedAssignedLocationId,
    scopeIds: validatedScopeIds,
  };
}

async function getNextAvailableAssetTag(client: DatabaseClient, startingNumber: number) {
  const tags = await client.asset.findMany({
    select: {
      assetTag: true,
    },
  });

  const usedNumbers = new Set(
    tags
      .map((asset) => Number.parseInt(asset.assetTag, 10))
      .filter((value) => Number.isInteger(value) && value >= startingNumber),
  );

  let candidate = startingNumber;
  while (usedNumbers.has(candidate)) {
    candidate += 1;
  }

  return String(candidate);
}

export async function getSuggestedAssetTag() {
  const settings = await getGeneralSettings();
  return getNextAvailableAssetTag(db, settings.startingAssetTagNumber);
}

export async function listAssetReferenceData() {
  await ensureDefaultAssetStatuses();

  const [categories, scopes, users, locations, statuses, suggestedAssetTag] = await Promise.all([
    db.category.findMany({
      select: {
        id: true,
        name: true,
        parentId: true,
      },
      orderBy: [{ name: "asc" }],
    }),
    db.scope.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        colorHex: true,
        colorMode: true,
      },
      orderBy: [{ name: "asc" }],
    }),
    db.user.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: [{ name: "asc" }],
    }),
    db.location.findMany({
      select: {
        id: true,
        name: true,
        parentId: true,
      },
      orderBy: [{ name: "asc" }],
    }),
    db.assetStatus.findMany({
      select: {
        id: true,
        key: true,
        name: true,
        color: true,
      },
      orderBy: [{ name: "asc" }],
    }),
    getSuggestedAssetTag(),
  ]);

  return { categories, scopes, users, locations, statuses, suggestedAssetTag };
}

export async function listAssets(options?: {
  q?: string;
  statusId?: string | null;
  categoryId?: string | null;
  scopeId?: string | null;
  locationId?: string | null;
  userId?: string | null;
  sort?: AssetSortOption;
}) {
  await ensureDefaultAssetStatuses();

  const where: Prisma.AssetWhereInput = {};
  const q = options?.q?.trim();

  if (q) {
    where.OR = [
      { name: { contains: q } },
      { assetTag: { contains: q } },
      { serialNumber: { contains: q } },
    ];
  }

  if (options?.statusId) {
    where.statusId = options.statusId;
  }

  if (options?.categoryId) {
    where.categoryId = options.categoryId;
  }

  if (options?.locationId) {
    where.assignedLocationId = options.locationId;
  }

  if (options?.userId) {
    where.assignedUserId = options.userId;
  }

  if (options?.scopeId) {
    where.scopes = {
      some: {
        scopeId: options.scopeId,
      },
    };
  }

  const sort = options?.sort ?? "updated-desc";
  const orderBy =
    sort === "name-asc"
      ? [{ name: "asc" as const }]
      : sort === "tag-asc"
        ? [{ assetTag: "asc" as const }]
        : sort === "purchase-desc"
          ? [{ purchaseDate: "desc" as const }, { name: "asc" as const }]
          : [{ updatedAt: "desc" as const }];

  return db.asset.findMany({
    where,
    select: {
      id: true,
      name: true,
      assetTag: true,
      serialNumber: true,
      notes: true,
      purchaseDate: true,
      warrantyExpiry: true,
      createdAt: true,
      updatedAt: true,
      categoryId: true,
      category: {
        select: {
          id: true,
          name: true,
          parentId: true,
        },
      },
      status: {
        select: {
          id: true,
          key: true,
          name: true,
          color: true,
        },
      },
      assignedUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      assignedLocation: {
        select: {
          id: true,
          name: true,
          parentId: true,
        },
      },
      scopes: {
        select: {
          scope: {
            select: {
              id: true,
              name: true,
              slug: true,
              colorHex: true,
              colorMode: true,
            },
          },
        },
      },
    },
    orderBy,
  });
}

export async function getAssetById(assetId: string) {
  return db.asset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      name: true,
      assetTag: true,
      serialNumber: true,
      notes: true,
      purchaseDate: true,
      warrantyExpiry: true,
      categoryId: true,
      statusId: true,
      status: {
        select: {
          id: true,
          key: true,
          name: true,
          color: true,
        },
      },
      assignedUserId: true,
      assignedUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      assignedLocationId: true,
      assignedLocation: {
        select: {
          id: true,
          name: true,
          parentId: true,
        },
      },
      scopes: {
        select: {
          scopeId: true,
          scope: {
            select: {
              id: true,
              name: true,
              slug: true,
              colorHex: true,
              colorMode: true,
            },
          },
        },
      },
    },
  });
}

export async function createAsset(input: {
  name: string;
  assetTag?: string;
  serialNumber?: string;
  notes?: string;
  purchaseDate?: string;
  warrantyExpiry?: string;
  categoryId?: string;
  statusId?: string;
  assignedUserId?: string;
  assignedLocationId?: string;
  scopeIds?: string[];
  actorUserId?: string;
}) {
  await ensureDefaultAssetStatuses();

  return db.$transaction(async (tx) => {
    const parsed = await parseAssetInput(tx, input);
    const settings = await getGeneralSettings();
    const assetTag = parsed.assetTag ?? (await getNextAvailableAssetTag(tx, settings.startingAssetTagNumber));

    const asset = await tx.asset.create({
      data: {
        name: parsed.name,
        assetTag,
        serialNumber: parsed.serialNumber,
        notes: parsed.notes,
        purchaseDate: parsed.purchaseDate,
        warrantyExpiry: parsed.warrantyExpiry,
        categoryId: parsed.categoryId,
        statusId: parsed.statusId,
        assignedUserId: parsed.assignedUserId,
        assignedLocationId: parsed.assignedLocationId,
        scopes: {
          create: parsed.scopeIds.map((scopeId) => ({ scopeId })),
        },
      },
    });

    await createAssetAuditEntry(tx, {
      actorUserId: input.actorUserId,
      action: "asset.created",
      entityId: asset.id,
      summary: `Created asset ${asset.assetTag}.`,
      payload: {
        name: asset.name,
        assetTag: asset.assetTag,
        statusId: parsed.statusId,
        assignedUserId: parsed.assignedUserId,
        assignedLocationId: parsed.assignedLocationId,
      },
    });

    return asset;
  });
}

export async function updateAsset(input: {
  assetId: string;
  name: string;
  assetTag?: string;
  serialNumber?: string;
  notes?: string;
  purchaseDate?: string;
  warrantyExpiry?: string;
  categoryId?: string;
  statusId?: string;
  assignedUserId?: string;
  assignedLocationId?: string;
  scopeIds?: string[];
  actorUserId?: string;
}) {
  return db.$transaction(async (tx) => {
    const existingAsset = await tx.asset.findUnique({
      where: { id: input.assetId },
      select: {
        id: true,
        name: true,
        assetTag: true,
        statusId: true,
        assignedUserId: true,
        assignedLocationId: true,
        scopes: {
          select: {
            scopeId: true,
          },
        },
      },
    });

    if (!existingAsset) {
      throw new Error("Asset not found.");
    }

    const parsed = await parseAssetInput(tx, input);

    const asset = await tx.asset.update({
      where: { id: existingAsset.id },
      data: {
        name: parsed.name,
        assetTag: parsed.assetTag ?? undefined,
        serialNumber: parsed.serialNumber,
        notes: parsed.notes,
        purchaseDate: parsed.purchaseDate,
        warrantyExpiry: parsed.warrantyExpiry,
        categoryId: parsed.categoryId,
        statusId: parsed.statusId,
        assignedUserId: parsed.assignedUserId,
        assignedLocationId: parsed.assignedLocationId,
        scopes: {
          deleteMany: {},
          create: parsed.scopeIds.map((scopeId) => ({ scopeId })),
        },
      },
    });

    await createAssetAuditEntry(tx, {
      actorUserId: input.actorUserId,
      action: "asset.updated",
      entityId: asset.id,
      summary: `Updated asset ${asset.assetTag}.`,
      payload: {
        before: {
          name: existingAsset.name,
          assetTag: existingAsset.assetTag,
          statusId: existingAsset.statusId,
          assignedUserId: existingAsset.assignedUserId,
          assignedLocationId: existingAsset.assignedLocationId,
          scopeIds: existingAsset.scopes.map((scope) => scope.scopeId).sort(),
        },
        after: {
          name: asset.name,
          assetTag: asset.assetTag,
          statusId: parsed.statusId,
          assignedUserId: parsed.assignedUserId,
          assignedLocationId: parsed.assignedLocationId,
          scopeIds: parsed.scopeIds.slice().sort(),
        },
      },
    });

    return asset;
  });
}

export async function deleteAsset(assetId: string, actorUserId?: string) {
  await db.$transaction(async (tx) => {
    const existingAsset = await tx.asset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        name: true,
        assetTag: true,
      },
    });

    if (!existingAsset) {
      return;
    }

    await createAssetAuditEntry(tx, {
      actorUserId,
      action: "asset.deleted",
      entityId: existingAsset.id,
      summary: `Deleted asset ${existingAsset.assetTag}.`,
      payload: {
        name: existingAsset.name,
        assetTag: existingAsset.assetTag,
      },
    });

    await tx.asset.delete({
      where: { id: existingAsset.id },
    });
  });
}

export async function checkOutAsset(input: {
  assetId: string;
  assignedUserId?: string;
  assignedLocationId?: string;
  notes?: string;
  actorUserId?: string;
}) {
  return db.$transaction(async (tx) => {
    const asset = await tx.asset.findUnique({
      where: { id: input.assetId },
      select: {
        id: true,
        assetTag: true,
        assignedUserId: true,
        assignedLocationId: true,
      },
    });

    if (!asset) {
      throw new Error("Asset not found.");
    }

    const assignedUserId = normalizeOptional(input.assignedUserId);
    const assignedLocationId = normalizeOptional(input.assignedLocationId);
    const note = normalizeOptional(input.notes);

    if (!assignedUserId && !assignedLocationId) {
      throw new Error("Select a user or location before checking out an asset.");
    }

    const [validatedAssignedUserId, validatedAssignedLocationId, assignedStatus] = await Promise.all([
      ensureEntityExists(tx, "user", assignedUserId, "Assigned user"),
      ensureEntityExists(tx, "location", assignedLocationId, "Assigned location"),
      getStatusByKey(tx, "ASSIGNED"),
    ]);

    const updatedAsset = await tx.asset.update({
      where: { id: asset.id },
      data: {
        statusId: assignedStatus.id,
        assignedUserId: validatedAssignedUserId,
        assignedLocationId: validatedAssignedLocationId,
      },
    });

    await createAssetAuditEntry(tx, {
      actorUserId: input.actorUserId,
      action: "asset.checked_out",
      entityId: updatedAsset.id,
      summary: `Checked out asset ${updatedAsset.assetTag}.`,
      payload: {
        previousAssignedUserId: asset.assignedUserId,
        previousAssignedLocationId: asset.assignedLocationId,
        assignedUserId: validatedAssignedUserId,
        assignedLocationId: validatedAssignedLocationId,
        note,
      },
    });

    return updatedAsset;
  });
}

export async function checkInAsset(input: {
  assetId: string;
  locationId?: string;
  notes?: string;
  actorUserId?: string;
}) {
  return db.$transaction(async (tx) => {
    const asset = await tx.asset.findUnique({
      where: { id: input.assetId },
      select: {
        id: true,
        assetTag: true,
        assignedUserId: true,
        assignedLocationId: true,
      },
    });

    if (!asset) {
      throw new Error("Asset not found.");
    }

    const locationId = normalizeOptional(input.locationId);
    const note = normalizeOptional(input.notes);

    const [validatedLocationId, inStockStatus] = await Promise.all([
      ensureEntityExists(tx, "location", locationId, "Location"),
      getStatusByKey(tx, "IN_STOCK"),
    ]);

    const updatedAsset = await tx.asset.update({
      where: { id: asset.id },
      data: {
        statusId: inStockStatus.id,
        assignedUserId: null,
        assignedLocationId: validatedLocationId,
      },
    });

    await createAssetAuditEntry(tx, {
      actorUserId: input.actorUserId,
      action: "asset.checked_in",
      entityId: updatedAsset.id,
      summary: `Checked in asset ${updatedAsset.assetTag}.`,
      payload: {
        previousAssignedUserId: asset.assignedUserId,
        previousAssignedLocationId: asset.assignedLocationId,
        locationId: validatedLocationId,
        note,
      },
    });

    return updatedAsset;
  });
}

export async function getAssetAuditHistory(assetId: string, days?: number | null) {
  const createdAtFilter = days && Number.isFinite(days)
    ? { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
    : undefined;

  return db.auditLog.findMany({
    where: {
      entityType: "asset",
      entityId: assetId,
      createdAt: createdAtFilter,
    },
    select: {
      id: true,
      action: true,
      summary: true,
      payloadJson: true,
      createdAt: true,
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function getAssetSummary() {
  await ensureDefaultAssetStatuses();

  const [totalAssets, assignedAssets, maintenanceAssets, labelTemplates] = await Promise.all([
    db.asset.count(),
    db.asset.count({
      where: {
        status: {
          key: "ASSIGNED",
        },
      },
    }),
    db.asset.count({
      where: {
        status: {
          key: "MAINTENANCE",
        },
      },
    }),
    db.labelTemplate.count(),
  ]);

  return { totalAssets, assignedAssets, maintenanceAssets, labelTemplates };
}