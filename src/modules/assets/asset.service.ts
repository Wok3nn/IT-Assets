import { Prisma } from "@prisma/client";
import { z } from "zod";

import {
  ensureDefaultAssetStatuses,
  getAssetStatusByKey,
  getGeneralSettings,
} from "@/modules/settings/settings.service";
import { db } from "@/services/database";

const MAX_CATEGORY_LEVELS = 5;
const AVAILABLE_ASSET_STATUS_KEY = "IN_STOCK";
const optionalIdSchema = z.union([z.string().trim().cuid(), z.literal("")]).optional();
const optionalTextSchema = z.union([z.string().trim().max(240), z.literal("")]).optional();
const optionalDateSchema = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).optional();
const optionalAssetTagSchema = z.union([z.string().trim().min(1).max(80), z.literal("")]).optional();
const requiredIdSchema = z.string().trim().cuid();

export class AssetTagAlreadyExistsError extends Error {
  constructor() {
    super("Asset tag already exists.");
    this.name = "AssetTagAlreadyExistsError";
  }
}

const assetSchema = z
  .object({
    assetId: z.string().trim().cuid().optional(),
    name: z.union([z.string().trim().max(120), z.literal("")]).optional(),
    make: optionalTextSchema,
    model: optionalTextSchema,
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

const assetBulkEditSchema = z.object({
  assetIds: z.array(requiredIdSchema).min(1),
  make: z.string().trim().min(1).max(240).optional(),
  model: z.string().trim().min(1).max(240).optional(),
  categoryId: requiredIdSchema.optional(),
  assignedLocationId: requiredIdSchema.optional(),
  scopeId: requiredIdSchema.optional(),
  actorUserId: requiredIdSchema.optional(),
}).superRefine((input, ctx) => {
  if (!input.make && !input.model && !input.categoryId && !input.assignedLocationId && !input.scopeId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["assetIds"],
      message: "Choose at least one bulk change before applying updates.",
    });
  }
});

const unassignAssetFromUserSchema = z.object({
  assetId: requiredIdSchema,
  userId: requiredIdSchema,
  actorUserId: requiredIdSchema.optional(),
});

export type AssetSortOption = "updated-desc" | "tag-asc" | "tag-desc" | "model-asc" | "model-desc";

const NATURAL_SORT_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

const assetListSelect = Prisma.validator<Prisma.AssetSelect>()({
  id: true,
  name: true,
  make: true,
  model: true,
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
  assignedGuestProfileId: true,
  assignedGuestProfile: {
    select: {
      id: true,
      displayName: true,
      guestType: true,
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
});

type AssetListItem = Prisma.AssetGetPayload<{ select: typeof assetListSelect }>;
type BulkEditableAsset = {
  id: string;
  assetTag: string;
  name: string;
  make: string | null;
  model: string | null;
  categoryId: string | null;
  assignedLocationId: string | null;
  scopes: Array<{ scopeId: string; scope: { id: string; name: string; slug: string } }>;
  category: { id: string; name: string; parentId: string | null } | null;
  assignedLocation: { id: string; name: string; parentId: string | null } | null;
};
type AssetSortCandidate = {
  id: string;
  assetTag: string;
  name: string;
  model: string | null;
};

type DatabaseClient = typeof db | Prisma.TransactionClient;
export type AssetAccessScope = {
  accessMode: "all" | "limited";
  categoryIds: string[];
  departmentIds: string[];
  locationIds: string[];
};

export type AvailableAssetForAssignment = {
  id: string;
  assetTag: string;
  name: string;
  make: string | null;
  model: string | null;
  serialNumber: string | null;
  categoryPath: string | null;
  assignedLocationName: string | null;
};

type AssetAuditEntry = {
  actorUserId?: string;
  action: string;
  entityId: string;
  summary: string;
  payload?: unknown;
};

export type AssetCheckoutAssignee =
  | { type: "organization-user"; id: string }
  | { type: "guest-profile"; id: string };

export function buildAssetAccessWhere(accessScope?: AssetAccessScope | null): Prisma.AssetWhereInput | null {
  if (!accessScope || accessScope.accessMode === "all") {
    return null;
  }

  const scopeClauses: Prisma.AssetWhereInput[] = [];

  if (accessScope.categoryIds.length > 0) {
    scopeClauses.push({
      categoryId: {
        in: accessScope.categoryIds,
      },
    });
  }

  if (accessScope.departmentIds.length > 0) {
    scopeClauses.push({
      scopes: {
        some: {
          scopeId: {
            in: accessScope.departmentIds,
          },
        },
      },
    });
  }

  if (accessScope.locationIds.length > 0) {
    scopeClauses.push({
      assignedLocationId: {
        in: accessScope.locationIds,
      },
    });
  }

  if (scopeClauses.length === 0) {
    return {
      id: {
        in: [],
      },
    };
  }

  return {
    OR: scopeClauses,
  };
}

function normalizeAndClauses(andInput?: Prisma.AssetWhereInput | Prisma.AssetWhereInput[]) {
  if (!andInput) {
    return [] as Prisma.AssetWhereInput[];
  }

  return Array.isArray(andInput) ? andInput : [andInput];
}

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

function resolveAssetDisplayName(input: {
  name?: string | null;
  make?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  assetTag?: string | null;
  fallbackName?: string | null;
}) {
  const combinedMakeModel = [input.make?.trim(), input.model?.trim()].filter(Boolean).join(" ").trim();
  return input.name?.trim() || input.model?.trim() || combinedMakeModel || input.serialNumber?.trim() || input.assetTag?.trim() || input.fallbackName?.trim() || "Untitled asset";
}

function buildCategorySearchClauses(query: string): Prisma.AssetWhereInput[] {
  return [
    { category: { name: { contains: query } } },
    { category: { parent: { name: { contains: query } } } },
    { category: { parent: { parent: { name: { contains: query } } } } },
    { category: { parent: { parent: { parent: { name: { contains: query } } } } } },
    { category: { parent: { parent: { parent: { parent: { name: { contains: query } } } } } } },
  ];
}

function buildUserSearchClauses(query: string): Prisma.AssetWhereInput[] {
  return [
    { assignedUser: { name: { contains: query } } },
    { assignedUser: { email: { contains: query } } },
    { assignedGuestProfile: { displayName: { contains: query } } },
    { assignedGuestProfile: { guestType: { contains: query } } },
  ];
}

function buildAssetSearchClauses(query: string): Prisma.AssetWhereInput[] {
  return [
    { name: { contains: query } },
    { make: { contains: query } },
    { model: { contains: query } },
    { assetTag: { contains: query } },
    { serialNumber: { contains: query } },
    { status: { name: { contains: query } } },
    ...buildUserSearchClauses(query),
    ...buildCategorySearchClauses(query),
  ];
}

function buildCategoryPath(
  categories: Array<{ id: string; name: string; parentId: string | null }>,
  categoryId: string | null | undefined,
) {
  if (!categoryId) {
    return null;
  }

  const byId = new Map(categories.map((category) => [category.id, category]));
  const labels: string[] = [];
  let current = byId.get(categoryId) ?? null;

  while (current) {
    labels.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) ?? null : null;
  }

  return labels.length > 0 ? labels.join(" > ") : null;
}

function buildAssetListWhere(options?: {
  q?: string;
  statusId?: string | null;
  categoryIds?: string[] | null;
  scopeId?: string | null;
  locationId?: string | null;
  userId?: string | null;
  includeRetired?: boolean;
  accessScope?: AssetAccessScope | null;
}) {
  const where: Prisma.AssetWhereInput = {};
  const q = options?.q?.trim();

  if (q) {
    const tokens = Array.from(new Set(q.split(/\s+/).map((token) => token.trim()).filter(Boolean)));
    const combinedClauses = buildAssetSearchClauses(q);
    const tokenClauses = tokens.length > 1
      ? tokens.map((token) => ({ OR: buildAssetSearchClauses(token) }))
      : [];

    where.AND = [
      {
        OR: combinedClauses,
      },
      ...tokenClauses,
    ];
  }

  if (options?.statusId) {
    where.statusId = options.statusId;
  }

  if (options?.categoryIds?.length) {
    where.categoryId = { in: options.categoryIds };
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

  if (!options?.includeRetired) {
    where.NOT = {
      status: {
        key: "RETIRED",
      },
    };
  }

  const accessWhere = buildAssetAccessWhere(options?.accessScope);

  if (accessWhere) {
    where.AND = [...normalizeAndClauses(where.AND), accessWhere];
  }

  return where;
}

async function listCategoryBranchIds(categoryId?: string | null) {
  if (!categoryId) {
    return null;
  }

  const categories = await db.category.findMany({
    select: {
      id: true,
      parentId: true,
    },
  });

  const childIdsByParent = new Map<string | null, string[]>();

  for (const category of categories) {
    const siblings = childIdsByParent.get(category.parentId) ?? [];
    siblings.push(category.id);
    childIdsByParent.set(category.parentId, siblings);
  }

  const branchIds: string[] = [];
  const queue = [categoryId];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift();

    if (!currentId || seen.has(currentId)) {
      continue;
    }

    seen.add(currentId);
    branchIds.push(currentId);

    for (const childId of childIdsByParent.get(currentId) ?? []) {
      queue.push(childId);
    }
  }

  return branchIds.length > 0 ? branchIds : [categoryId];
}
function getAssetSortDisplayModel(asset: AssetSortCandidate) {
  return asset.model?.trim() || asset.name.trim();
}

function compareNaturalText(left: string, right: string) {
  return NATURAL_SORT_COLLATOR.compare(left.trim(), right.trim());
}

function compareAssetTagsAscending(left: AssetSortCandidate, right: AssetSortCandidate) {
  return compareNaturalText(left.assetTag, right.assetTag)
    || compareNaturalText(getAssetSortDisplayModel(left), getAssetSortDisplayModel(right))
    || compareNaturalText(left.id, right.id);
}

function compareAssetModelsAscending(left: AssetSortCandidate, right: AssetSortCandidate) {
  return compareNaturalText(getAssetSortDisplayModel(left), getAssetSortDisplayModel(right))
    || compareNaturalText(left.assetTag, right.assetTag)
    || compareNaturalText(left.id, right.id);
}

function paginateAssetIds(assetIds: string[], page: number, pageSize: number) {
  const totalCount = assetIds.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;

  return {
    totalCount,
    totalPages,
    currentPage,
    pageIds: assetIds.slice(start, start + pageSize),
  };
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
    name?: string;
    make?: string;
    model?: string;
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
    name: normalizeOptional(parsed.name),
    make: normalizeOptional(parsed.make),
    model: normalizeOptional(parsed.model),
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

async function ensureAssetTagAvailable(client: DatabaseClient, assetTag: string, currentAssetId?: string | null) {
  const existingAsset = await client.asset.findUnique({
    where: {
      assetTag,
    },
    select: {
      id: true,
    },
  });

  if (existingAsset && existingAsset.id !== currentAssetId) {
    throw new AssetTagAlreadyExistsError();
  }
}

export async function getSuggestedAssetTag() {
  const settings = await getGeneralSettings();
  return getNextAvailableAssetTag(db, settings.startingAssetTagNumber);
}

export async function listAssetReferenceData() {
  await ensureDefaultAssetStatuses();

  const [categories, scopes, users, locations, statuses, suggestedAssetTag, assetTags] = await Promise.all([
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
    db.asset.findMany({
      select: {
        id: true,
        assetTag: true,
      },
      orderBy: [{ assetTag: "asc" }],
    }),
  ]);

  return { categories, scopes, users, locations, statuses, suggestedAssetTag, assetTags };
}

export async function listAssets(options?: {
  q?: string;
  statusId?: string | null;
  categoryId?: string | null;
  categoryIds?: string[] | null;
  scopeId?: string | null;
  locationId?: string | null;
  userId?: string | null;
  includeRetired?: boolean;
  sort?: AssetSortOption;
  page?: number;
  pageSize?: number;
  accessScope?: AssetAccessScope | null;
}) {
  await ensureDefaultAssetStatuses();

  const categoryBranchIds = await listCategoryBranchIds(options?.categoryId);
  const where = buildAssetListWhere({
    ...options,
    categoryIds: categoryBranchIds,
  });
  const sort = options?.sort ?? "updated-desc";
  const requestedPage = Math.max(1, options?.page ?? 1);
  const pageSize = Math.max(1, options?.pageSize ?? 25);

  const [assignedCount, maintenanceCount] = await db.$transaction([
    db.asset.count({
      where: {
        AND: [
          where,
          {
            OR: [
              { assignedUserId: { not: null } },
              { assignedGuestProfileId: { not: null } },
              { assignedLocationId: { not: null } },
              { status: { key: "ASSIGNED" } },
            ],
          },
        ],
      },
    }),
    db.asset.count({
      where: {
        AND: [where, { status: { key: "MAINTENANCE" } }],
      },
    }),
  ]);

  if (sort === "updated-desc") {
    const [totalCount, items] = await db.$transaction([
      db.asset.count({ where }),
      db.asset.findMany({
        where,
        select: assetListSelect,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        skip: (requestedPage - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const currentPage = Math.min(requestedPage, totalPages);
    const normalizedItems = currentPage === requestedPage
      ? items
      : await db.asset.findMany({
          where,
          select: assetListSelect,
          orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
          skip: (currentPage - 1) * pageSize,
          take: pageSize,
        });

    return {
      items: normalizedItems,
      totalCount,
      assignedCount,
      maintenanceCount,
      page: currentPage,
      pageSize,
      totalPages,
      sort,
    };
  }

  const candidates = await db.asset.findMany({
    where,
    select: {
      id: true,
      assetTag: true,
      name: true,
      model: true,
    },
  });

  const sortedCandidates = candidates.sort((left, right) => {
    if (sort === "tag-desc") {
      return compareAssetTagsAscending(right, left);
    }

    if (sort === "model-asc") {
      return compareAssetModelsAscending(left, right);
    }

    if (sort === "model-desc") {
      return compareAssetModelsAscending(right, left);
    }

    return compareAssetTagsAscending(left, right);
  });

  const pagination = paginateAssetIds(sortedCandidates.map((asset) => asset.id), requestedPage, pageSize);

  if (pagination.pageIds.length === 0) {
    return {
      items: [] as AssetListItem[],
      totalCount: pagination.totalCount,
      assignedCount,
      maintenanceCount,
      page: pagination.currentPage,
      pageSize,
      totalPages: pagination.totalPages,
      sort,
    };
  }

  const pageItems = await db.asset.findMany({
    where: {
      id: { in: pagination.pageIds },
    },
    select: assetListSelect,
  });

  const assetById = new Map(pageItems.map((asset) => [asset.id, asset]));
  const items = pagination.pageIds.map((id) => assetById.get(id)).filter((asset): asset is AssetListItem => Boolean(asset));

  return {
    items,
    totalCount: pagination.totalCount,
    assignedCount,
    maintenanceCount,
    page: pagination.currentPage,
    pageSize,
    totalPages: pagination.totalPages,
    sort,
  };
}

export async function getAssetById(assetId: string, options?: { accessScope?: AssetAccessScope | null }) {
  const accessWhere = buildAssetAccessWhere(options?.accessScope);

  return db.asset.findFirst({
    where: accessWhere
      ? {
          id: assetId,
          AND: [accessWhere],
        }
      : {
          id: assetId,
        },
    select: {
      id: true,
      name: true,
      make: true,
      model: true,
      assetTag: true,
      serialNumber: true,
      notes: true,
      purchaseDate: true,
      warrantyExpiry: true,
      categoryId: true,
      category: {
        select: {
          id: true,
          name: true,
          parentId: true,
          defaultLabelTemplateId: true,
        },
      },
      labelTemplateId: true,
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
      assignedGuestProfileId: true,
      assignedGuestProfile: {
        select: {
          id: true,
          displayName: true,
          guestType: true,
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

export async function getAssetsByIds(assetIds: string[], options?: { accessScope?: AssetAccessScope | null }) {
  const uniqueAssetIds = Array.from(new Set(assetIds.map((assetId) => assetId.trim()).filter(Boolean)));

  if (uniqueAssetIds.length === 0) {
    return [] as BulkEditableAsset[];
  }

  const accessWhere = buildAssetAccessWhere(options?.accessScope);

  const assets = await db.asset.findMany({
    where: accessWhere
      ? {
          AND: [
            {
              id: {
                in: uniqueAssetIds,
              },
            },
            accessWhere,
          ],
        }
      : {
          id: {
            in: uniqueAssetIds,
          },
        },
    select: {
      id: true,
      assetTag: true,
      name: true,
      make: true,
      model: true,
      categoryId: true,
      assignedLocationId: true,
      category: {
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
            },
          },
        },
      },
      assignedLocation: {
        select: {
          id: true,
          name: true,
          parentId: true,
        },
      },
    },
  });

  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  return uniqueAssetIds.map((assetId) => assetById.get(assetId)).filter((asset): asset is BulkEditableAsset => Boolean(asset));
}

export async function listAssetsAssignedToUser(userId: string, options?: { accessScope?: AssetAccessScope | null }) {
  const parsedUserId = requiredIdSchema.parse(userId);
  const accessWhere = buildAssetAccessWhere(options?.accessScope);
  const where: Prisma.AssetWhereInput = accessWhere
    ? {
        assignedUserId: parsedUserId,
        AND: [accessWhere],
      }
    : {
        assignedUserId: parsedUserId,
      };

  return db.asset.findMany({
    where,
    select: assetListSelect,
    orderBy: [{ assetTag: "asc" }, { name: "asc" }],
  });
}

export async function listAssetsAssignedToGuestProfile(guestProfileId: string, options?: { accessScope?: AssetAccessScope | null }) {
  const parsedGuestProfileId = requiredIdSchema.parse(guestProfileId);
  const accessWhere = buildAssetAccessWhere(options?.accessScope);
  const where: Prisma.AssetWhereInput = accessWhere
    ? {
        assignedGuestProfileId: parsedGuestProfileId,
        AND: [accessWhere],
      }
    : {
        assignedGuestProfileId: parsedGuestProfileId,
      };

  return db.asset.findMany({
    where,
    select: assetListSelect,
    orderBy: [{ assetTag: "asc" }, { name: "asc" }],
  });
}

export async function listAvailableAssetsForAssignment(options?: {
  accessScope?: AssetAccessScope | null;
  limit?: number;
}) {
  await ensureDefaultAssetStatuses();

  const accessWhere = buildAssetAccessWhere(options?.accessScope);
  const availableWhere: Prisma.AssetWhereInput = {
    assignedUserId: null,
    assignedGuestProfileId: null,
    activeBorrowedItem: null,
    status: {
      key: AVAILABLE_ASSET_STATUS_KEY,
    },
  };
  const where: Prisma.AssetWhereInput = accessWhere
    ? {
        AND: [availableWhere, accessWhere],
      }
    : availableWhere;

  const [categories, assets] = await db.$transaction([
    db.category.findMany({
      select: {
        id: true,
        name: true,
        parentId: true,
      },
    }),
    db.asset.findMany({
      where,
      select: {
        id: true,
        assetTag: true,
        name: true,
        make: true,
        model: true,
        serialNumber: true,
        categoryId: true,
        assignedLocation: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ assetTag: "asc" }, { name: "asc" }],
      take: Math.max(1, Math.min(options?.limit ?? 250, 500)),
    }),
  ]);

  return assets.map((asset): AvailableAssetForAssignment => ({
    id: asset.id,
    assetTag: asset.assetTag,
    name: asset.name,
    make: asset.make,
    model: asset.model,
    serialNumber: asset.serialNumber,
    categoryPath: buildCategoryPath(categories, asset.categoryId),
    assignedLocationName: asset.assignedLocation?.name ?? null,
  }));
}

export async function createAsset(input: {
  name?: string;
  make?: string;
  model?: string;
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
    await ensureAssetTagAvailable(tx, assetTag);
    const resolvedName = resolveAssetDisplayName({
      name: parsed.name,
      make: parsed.make,
      model: parsed.model,
      serialNumber: parsed.serialNumber,
      assetTag,
    });

    const asset = await tx.asset.create({
      data: {
        name: resolvedName,
        make: parsed.make,
        model: parsed.model,
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
        make: asset.make,
        model: asset.model,
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
  name?: string;
  make?: string;
  model?: string;
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
  accessScope?: AssetAccessScope | null;
}) {
  return db.$transaction(async (tx) => {
    const accessWhere = buildAssetAccessWhere(input.accessScope);
    const existingAsset = await tx.asset.findFirst({
      where: accessWhere
        ? {
            id: input.assetId,
            AND: [accessWhere],
          }
        : {
            id: input.assetId,
          },
      select: {
        id: true,
        name: true,
        make: true,
        model: true,
        assetTag: true,
        statusId: true,
        assignedUserId: true,
        assignedGuestProfileId: true,
        activeBorrowedItem: {
          select: {
            id: true,
          },
        },
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
    if (parsed.assetTag) {
      await ensureAssetTagAvailable(tx, parsed.assetTag, existingAsset.id);
    }

    if (parsed.assignedUserId && existingAsset.assignedGuestProfileId) {
      throw new Error("Check in the asset before assigning it to an organization user.");
    }

    if (parsed.assignedUserId && existingAsset.activeBorrowedItem) {
      throw new Error("Mark the borrowed asset returned before assigning it to an organization user.");
    }

    const resolvedName = resolveAssetDisplayName({
      name: parsed.name,
      make: parsed.make,
      model: parsed.model,
      serialNumber: parsed.serialNumber,
      assetTag: parsed.assetTag ?? existingAsset.assetTag,
      fallbackName: existingAsset.name,
    });

    const asset = await tx.asset.update({
      where: { id: existingAsset.id },
      data: {
        name: resolvedName,
        make: parsed.make,
        model: parsed.model,
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
          make: existingAsset.make,
          model: existingAsset.model,
          assetTag: existingAsset.assetTag,
          statusId: existingAsset.statusId,
          assignedUserId: existingAsset.assignedUserId,
          assignedGuestProfileId: existingAsset.assignedGuestProfileId,
          assignedLocationId: existingAsset.assignedLocationId,
          scopeIds: existingAsset.scopes.map((scope) => scope.scopeId).sort(),
        },
        after: {
          name: asset.name,
          make: asset.make,
          model: asset.model,
          assetTag: asset.assetTag,
          statusId: parsed.statusId,
          assignedUserId: parsed.assignedUserId,
          assignedGuestProfileId: existingAsset.assignedGuestProfileId,
          assignedLocationId: parsed.assignedLocationId,
          scopeIds: parsed.scopeIds.slice().sort(),
        },
      },
    });

    return asset;
  });
}

export async function bulkUpdateAssets(input: {
  assetIds: string[];
  make?: string;
  model?: string;
  categoryId?: string;
  assignedLocationId?: string;
  scopeId?: string;
  actorUserId?: string;
  accessScope?: AssetAccessScope | null;
}) {
  const parsed = assetBulkEditSchema.parse({
    ...input,
    assetIds: Array.from(new Set(input.assetIds.map((assetId) => assetId.trim()).filter(Boolean))),
    make: input.make?.trim() || undefined,
    model: input.model?.trim() || undefined,
    categoryId: normalizeOptional(input.categoryId) ?? undefined,
    assignedLocationId: normalizeOptional(input.assignedLocationId) ?? undefined,
    scopeId: normalizeOptional(input.scopeId) ?? undefined,
    actorUserId: normalizeOptional(input.actorUserId) ?? undefined,
  });

  return db.$transaction(async (tx) => {
    const accessWhere = buildAssetAccessWhere(input.accessScope);
    const [validatedCategoryId, validatedAssignedLocationId, validatedScopeIds, existingAssets] = await Promise.all([
      parsed.categoryId ? validateCategoryId(tx, parsed.categoryId) : Promise.resolve(undefined),
      parsed.assignedLocationId ? ensureEntityExists(tx, "location", parsed.assignedLocationId, "Location") : Promise.resolve(undefined),
      parsed.scopeId ? validateScopeIds(tx, [parsed.scopeId]) : Promise.resolve(undefined),
      tx.asset.findMany({
        where: accessWhere
          ? {
              AND: [
                {
                  id: {
                    in: parsed.assetIds,
                  },
                },
                accessWhere,
              ],
            }
          : {
              id: {
                in: parsed.assetIds,
              },
            },
        select: {
          id: true,
          assetTag: true,
          make: true,
          model: true,
          categoryId: true,
          assignedLocationId: true,
          scopes: {
            select: {
              scopeId: true,
            },
          },
        },
      }),
    ]);

    if (existingAssets.length !== parsed.assetIds.length) {
      throw new Error("One or more selected assets no longer exist.");
    }

    const assetById = new Map(existingAssets.map((asset) => [asset.id, asset]));
    const orderedAssets = parsed.assetIds.map((assetId) => assetById.get(assetId)).filter((asset): asset is NonNullable<typeof existingAssets[number]> => Boolean(asset));

    for (const asset of orderedAssets) {
      const nextMake = parsed.make ?? asset.make;
      const nextModel = parsed.model ?? asset.model;
      const nextCategoryId = validatedCategoryId ?? asset.categoryId;
      const nextAssignedLocationId = validatedAssignedLocationId ?? asset.assignedLocationId;
      const nextScopeIds = validatedScopeIds ?? asset.scopes.map((scope) => scope.scopeId);

      await tx.asset.update({
        where: { id: asset.id },
        data: {
          make: parsed.make ?? undefined,
          model: parsed.model ?? undefined,
          categoryId: validatedCategoryId ?? undefined,
          assignedLocationId: validatedAssignedLocationId ?? undefined,
          scopes: validatedScopeIds
            ? {
                deleteMany: {},
                create: validatedScopeIds.map((scopeId) => ({ scopeId })),
              }
            : undefined,
        },
      });

      await createAssetAuditEntry(tx, {
        actorUserId: parsed.actorUserId,
        action: "asset.bulk_updated",
        entityId: asset.id,
        summary: `Bulk updated asset ${asset.assetTag}.`,
        payload: {
          before: {
            make: asset.make,
            model: asset.model,
            categoryId: asset.categoryId,
            assignedLocationId: asset.assignedLocationId,
            scopeIds: asset.scopes.map((scope) => scope.scopeId).sort(),
          },
          after: {
            make: nextMake,
            model: nextModel,
            categoryId: nextCategoryId,
            assignedLocationId: nextAssignedLocationId,
            scopeIds: nextScopeIds.slice().sort(),
          },
        },
      });
    }

    return {
      updatedCount: orderedAssets.length,
    };
  });
}

export async function deleteAsset(assetId: string, actorUserId?: string, accessScope?: AssetAccessScope | null) {
  await db.$transaction(async (tx) => {
    const accessWhere = buildAssetAccessWhere(accessScope);
    const existingAsset = await tx.asset.findFirst({
      where: accessWhere
        ? {
            id: assetId,
            AND: [accessWhere],
          }
        : {
            id: assetId,
          },
      select: {
        id: true,
        name: true,
        assetTag: true,
        _count: {
          select: {
            borrowedItems: true,
          },
        },
      },
    });

    if (!existingAsset) {
      return;
    }

    if (existingAsset._count.borrowedItems > 0) {
      throw new Error("Asset cannot be deleted while it is linked to borrowed item history.");
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

export async function unassignAssetFromUser(input: {
  assetId: string;
  userId: string;
  actorUserId?: string;
  accessScope?: AssetAccessScope | null;
}) {
  const parsed = unassignAssetFromUserSchema.parse({
    assetId: input.assetId,
    userId: input.userId,
    actorUserId: input.actorUserId,
  });

  await db.$transaction(async (tx) => {
    const accessWhere = buildAssetAccessWhere(input.accessScope);
    const asset = await tx.asset.findFirst({
      where: accessWhere
        ? {
            id: parsed.assetId,
            AND: [accessWhere],
          }
        : {
            id: parsed.assetId,
          },
      select: {
        id: true,
        name: true,
        assetTag: true,
        assignedUserId: true,
        assignedLocationId: true,
        status: {
          select: {
            key: true,
          },
        },
      },
    });

    if (!asset || asset.assignedUserId !== parsed.userId) {
      throw new Error("Asset is no longer assigned to this user.");
    }

    const inStockStatus = asset.status?.key === "ASSIGNED" && !asset.assignedLocationId
      ? await getStatusByKey(tx, "IN_STOCK")
      : null;

    const updatedAsset = await tx.asset.update({
      where: {
        id: asset.id,
      },
      data: {
        assignedUserId: null,
        statusId: inStockStatus?.id,
      },
    });

    await createAssetAuditEntry(tx, {
      actorUserId: parsed.actorUserId,
      action: "asset.user_unassigned",
      entityId: updatedAsset.id,
      summary: `Unassigned asset ${updatedAsset.assetTag} from user.`,
      payload: {
        previousAssignedUserId: parsed.userId,
        assignedLocationId: asset.assignedLocationId,
        statusChangedTo: inStockStatus ? "IN_STOCK" : null,
        name: asset.name,
      },
    });
  });
}

export async function checkOutAsset(input: {
  assetId: string;
  assignee?: AssetCheckoutAssignee;
  assignedUserId?: string;
  assignedLocationId?: string;
  notes?: string;
  actorUserId?: string;
  accessScope?: AssetAccessScope | null;
}) {
  return db.$transaction(async (tx) => {
    const accessWhere = buildAssetAccessWhere(input.accessScope);
    const asset = await tx.asset.findFirst({
      where: accessWhere
        ? {
            id: input.assetId,
            AND: [accessWhere],
          }
        : {
            id: input.assetId,
          },
      select: {
        id: true,
        assetTag: true,
        assignedUserId: true,
        assignedGuestProfileId: true,
        activeBorrowedItem: {
          select: {
            id: true,
          },
        },
        assignedLocationId: true,
        statusId: true,
        status: {
          select: {
            id: true,
            key: true,
          },
        },
      },
    });

    if (!asset) {
      throw new Error("Asset not found.");
    }

    const assignedUserId = normalizeOptional(input.assignedUserId);
    const assignee = input.assignee ?? (assignedUserId ? { type: "organization-user" as const, id: assignedUserId } : undefined);
    const assignedLocationId = normalizeOptional(input.assignedLocationId);
    const note = normalizeOptional(input.notes);

    if (input.assignee && assignedUserId) {
      throw new Error("Select one assignee before checking out an asset.");
    }

    if (asset.assignedUserId || asset.assignedGuestProfileId || asset.activeBorrowedItem) {
      throw new Error("This asset is no longer available.");
    }

    if (asset.status?.key !== AVAILABLE_ASSET_STATUS_KEY) {
      throw new Error("This asset is no longer available.");
    }

    if (!assignee && !assignedLocationId) {
      throw new Error("Select an assignee or location before checking out an asset.");
    }

    const [validatedAssignedLocationId, assignedStatus] = await Promise.all([
      ensureEntityExists(tx, "location", assignedLocationId, "Assigned location"),
      getStatusByKey(tx, "ASSIGNED"),
    ]);
    let validatedAssignedUserId: string | null = null;
    let validatedAssignedGuestProfileId: string | null = null;
    let assigneePayload: {
      assigneeType: "organization-user" | "guest-profile" | null;
      assigneeId: string | null;
      assigneeDisplayName: string | null;
      guestType?: string | null;
    } = {
      assigneeType: null,
      assigneeId: null,
      assigneeDisplayName: null,
    };

    if (assignee?.type === "organization-user") {
      const user = await tx.user.findUnique({
        where: { id: assignee.id },
        select: { id: true, name: true },
      });

      if (!user) {
        throw new Error("Assigned user no longer exists.");
      }

      validatedAssignedUserId = user.id;
      assigneePayload = {
        assigneeType: "organization-user",
        assigneeId: user.id,
        assigneeDisplayName: user.name,
      };
    } else if (assignee?.type === "guest-profile") {
      const guestProfile = await tx.guestProfile.findUnique({
        where: { id: assignee.id },
        select: { id: true, displayName: true, guestType: true, isActive: true },
      });

      if (!guestProfile || !guestProfile.isActive) {
        throw new Error("Guest Profile is no longer available for assignment.");
      }

      validatedAssignedGuestProfileId = guestProfile.id;
      assigneePayload = {
        assigneeType: "guest-profile",
        assigneeId: guestProfile.id,
        assigneeDisplayName: guestProfile.displayName,
        guestType: guestProfile.guestType,
      };
    }

    const updateResult = await tx.asset.updateMany({
      where: {
        id: asset.id,
        assignedUserId: null,
        assignedGuestProfileId: null,
        activeBorrowedItem: null,
        statusId: asset.status.id,
      },
      data: {
        statusId: assignedStatus.id,
        assignedUserId: validatedAssignedUserId,
        assignedGuestProfileId: validatedAssignedGuestProfileId,
        assignedLocationId: validatedAssignedLocationId,
      },
    });

    if (updateResult.count !== 1) {
      throw new Error("This asset is no longer available.");
    }

    const updatedAsset = await tx.asset.findUniqueOrThrow({
      where: { id: asset.id },
      select: {
        id: true,
        assetTag: true,
      },
    });

    await createAssetAuditEntry(tx, {
      actorUserId: input.actorUserId,
      action: "asset.checked_out",
      entityId: updatedAsset.id,
      summary: `Checked out asset ${updatedAsset.assetTag}.`,
      payload: {
        previousAssignedUserId: asset.assignedUserId,
        previousAssignedGuestProfileId: asset.assignedGuestProfileId,
        previousAssignedLocationId: asset.assignedLocationId,
        assignedUserId: validatedAssignedUserId,
        assignedGuestProfileId: validatedAssignedGuestProfileId,
        ...assigneePayload,
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
  accessScope?: AssetAccessScope | null;
}) {
  return db.$transaction(async (tx) => {
    const accessWhere = buildAssetAccessWhere(input.accessScope);
    const asset = await tx.asset.findFirst({
      where: accessWhere
        ? {
            id: input.assetId,
            AND: [accessWhere],
          }
        : {
            id: input.assetId,
          },
      select: {
        id: true,
        assetTag: true,
        assignedUserId: true,
        assignedGuestProfileId: true,
        assignedUser: {
          select: {
            id: true,
            name: true,
          },
        },
        assignedGuestProfile: {
          select: {
            id: true,
            displayName: true,
            guestType: true,
          },
        },
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
        assignedGuestProfileId: null,
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
        previousAssignedGuestProfileId: asset.assignedGuestProfileId,
        previousAssigneeType: asset.assignedUserId ? "organization-user" : asset.assignedGuestProfileId ? "guest-profile" : null,
        previousAssigneeId: asset.assignedUserId ?? asset.assignedGuestProfileId,
        previousAssigneeDisplayName: asset.assignedUser?.name ?? asset.assignedGuestProfile?.displayName ?? null,
        previousGuestType: asset.assignedGuestProfile?.guestType ?? null,
        previousAssignedLocationId: asset.assignedLocationId,
        locationId: validatedLocationId,
        note,
      },
    });

    return updatedAsset;
  });
}

export async function getAssetAuditHistory(
  assetId: string,
  days?: number | null,
  options?: { accessScope?: AssetAccessScope | null },
) {
  const createdAtFilter = days && Number.isFinite(days)
    ? { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
    : undefined;
  const accessWhere = buildAssetAccessWhere(options?.accessScope);

  if (accessWhere) {
    const accessibleAsset = await db.asset.findFirst({
      where: {
        id: assetId,
        AND: [accessWhere],
      },
      select: {
        id: true,
      },
    });

    if (!accessibleAsset) {
      return [];
    }
  }

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

export function getAssetAuditPayloadNote(payloadJson?: string | null) {
  if (!payloadJson) {
    return null;
  }

  try {
    const payload = JSON.parse(payloadJson) as { note?: unknown };
    return typeof payload.note === "string" && payload.note.trim() ? payload.note.trim() : null;
  } catch {
    return null;
  }
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
