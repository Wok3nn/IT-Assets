import { Prisma } from "@prisma/client";
import { z } from "zod";

import { buildAssetAccessWhere, type AssetAccessScope } from "@/modules/assets/asset.service";
import type { BorrowedItemsPageSize, BorrowedItemsStatusFilter } from "@/modules/borrowed-items/borrowed-items-routing";
import type { BorrowedItemListRecord } from "@/modules/borrowed-items/borrowed-items.shared";
import { db } from "@/services/database";

const AVAILABLE_ASSET_STATUS_KEY = "IN_STOCK";
const requiredIdSchema = z.string().trim().cuid();
const optionalIdSchema = z.union([z.string().trim().cuid(), z.literal("")]).optional();
const dateTimeInputSchema = z.string().trim().min(1, "Enter a valid date and time.");
const dueDateInputSchema = z.string().trim().min(1, "Expected return date is required.");

const createBorrowedItemSchema = z
  .object({
    itemType: z.enum(["asset", "manual"]),
    assetId: optionalIdSchema,
    itemName: z.union([z.string().trim().min(1).max(160), z.literal("")]).optional(),
    quantity: z.coerce.number().int().positive().default(1),
    borrowerUserId: requiredIdSchema,
    borrowedAt: z.union([dateTimeInputSchema, z.literal("")]).optional(),
    dueAt: dueDateInputSchema,
    notes: z.union([z.string().trim().max(2000), z.literal("")]).optional(),
    actorUserId: requiredIdSchema,
  })
  .superRefine((input, ctx) => {
    if (input.itemType === "asset" && !input.assetId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["assetId"], message: "Choose an available asset." });
    }

    if (input.itemType === "manual" && !input.itemName?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["itemName"], message: "Enter an item name." });
    }

    if (input.itemType === "asset" && input.quantity !== 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["quantity"], message: "Existing assets can only be borrowed with quantity 1." });
    }
  });

const markReturnedSchema = z.object({
  borrowedItemId: requiredIdSchema,
  returnedAt: z.string().trim().min(1, "Returned date is required."),
  actorUserId: requiredIdSchema,
});

function normalizeOptional(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseDateTimeInput(value: string, fallback?: Date) {
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback ?? null;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Enter a valid date and time.");
  }

  return parsed;
}

function getTodayBounds(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const tomorrow = new Date(start);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return { start, tomorrow };
}

function buildStatusWhere(status: BorrowedItemsStatusFilter, now = new Date()): Prisma.BorrowedItemWhereInput {
  const { start, tomorrow } = getTodayBounds(now);

  if (status === "returned") {
    return { returnedAt: { not: null } };
  }

  if (status === "overdue") {
    return {
      returnedAt: null,
      dueAt: { lt: start },
    };
  }

  if (status === "due-today") {
    return {
      returnedAt: null,
      dueAt: {
        gte: start,
        lt: tomorrow,
      },
    };
  }

  return {
    returnedAt: null,
    dueAt: { gte: tomorrow },
  };
}

function buildBorrowedItemAssetAccessWhere(accessScope?: AssetAccessScope | null): Prisma.BorrowedItemWhereInput | null {
  const assetAccessWhere = buildAssetAccessWhere(accessScope);

  if (!assetAccessWhere) {
    return null;
  }

  return {
    OR: [
      { assetId: null },
      { asset: assetAccessWhere },
    ],
  };
}

export async function listBorrowersForBorrowedItems() {
  return db.user.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
}

export async function listAssetsAvailableForBorrowing(options?: { accessScope?: AssetAccessScope | null; limit?: number }) {
  const assetAccessWhere = buildAssetAccessWhere(options?.accessScope);
  const availableWhere: Prisma.AssetWhereInput = {
    assignedUserId: null,
    assignedGuestProfileId: null,
    activeBorrowedItem: null,
    status: {
      key: AVAILABLE_ASSET_STATUS_KEY,
    },
  };
  const where = assetAccessWhere
    ? {
        AND: [availableWhere, assetAccessWhere],
      }
    : availableWhere;

  return db.asset.findMany({
    where,
    select: {
      id: true,
      assetTag: true,
      name: true,
      make: true,
      model: true,
      serialNumber: true,
      category: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [{ assetTag: "asc" }, { name: "asc" }],
    take: Math.max(1, Math.min(options?.limit ?? 250, 500)),
  });
}

export async function listBorrowedItems(input: {
  q?: string | null;
  status: BorrowedItemsStatusFilter;
  page: number;
  pageSize: BorrowedItemsPageSize;
  accessScope?: AssetAccessScope | null;
}) {
  const search = input.q?.trim();
  const clauses: Prisma.BorrowedItemWhereInput[] = [buildStatusWhere(input.status)];
  const accessWhere = buildBorrowedItemAssetAccessWhere(input.accessScope);

  if (accessWhere) {
    clauses.push(accessWhere);
  }

  if (search) {
    clauses.push({
      OR: [
        { itemName: { contains: search } },
        { asset: { assetTag: { contains: search } } },
        { asset: { name: { contains: search } } },
        { asset: { make: { contains: search } } },
        { asset: { model: { contains: search } } },
        { borrowerUser: { name: { contains: search } } },
        { borrowerUser: { email: { contains: search } } },
        { issuedByUser: { name: { contains: search } } },
      ],
    });
  }

  const where: Prisma.BorrowedItemWhereInput = clauses.length > 1 ? { AND: clauses } : clauses[0] ?? {};
  const totalCount = await db.borrowedItem.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / input.pageSize));
  const page = Math.min(input.page, totalPages);
  const items = await db.borrowedItem.findMany({
    where,
    select: borrowedItemSelect,
    orderBy: input.status === "returned"
      ? [{ returnedAt: "desc" }, { updatedAt: "desc" }]
      : [{ dueAt: "asc" }, { borrowedAt: "desc" }],
    skip: (page - 1) * input.pageSize,
    take: input.pageSize,
  });

  return {
    items,
    totalCount,
    totalPages,
    page,
  };
}

export async function listBorrowedItemsForUser(userId: string, options?: { accessScope?: AssetAccessScope | null }) {
  const parsedUserId = requiredIdSchema.parse(userId);
  const clauses: Prisma.BorrowedItemWhereInput[] = [{ borrowerUserId: parsedUserId }];
  const accessWhere = buildBorrowedItemAssetAccessWhere(options?.accessScope);

  if (accessWhere) {
    clauses.push(accessWhere);
  }

  return db.borrowedItem.findMany({
    where: clauses.length > 1 ? { AND: clauses } : clauses[0],
    select: borrowedItemSelect,
    orderBy: [{ returnedAt: "asc" }, { dueAt: "asc" }, { borrowedAt: "desc" }],
    take: 50,
  }) satisfies Promise<BorrowedItemListRecord[]>;
}

export async function getActiveBorrowedItemForAsset(assetId: string, options?: { accessScope?: AssetAccessScope | null }) {
  const parsedAssetId = requiredIdSchema.parse(assetId);
  const accessWhere = buildBorrowedItemAssetAccessWhere(options?.accessScope);
  const where: Prisma.BorrowedItemWhereInput = {
    assetId: parsedAssetId,
    returnedAt: null,
  };

  return db.borrowedItem.findFirst({
    where: accessWhere ? { AND: [where, accessWhere] } : where,
    select: borrowedItemSelect,
    orderBy: { borrowedAt: "desc" },
  }) satisfies Promise<BorrowedItemListRecord | null>;
}

async function createBorrowedItemAuditEntry(client: typeof db | Prisma.TransactionClient, input: {
  actorUserId: string;
  action: string;
  entityId: string;
  summary: string;
  payload: unknown;
}) {
  await client.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: "BorrowedItem",
      entityId: input.entityId,
      summary: input.summary,
      payloadJson: JSON.stringify(input.payload),
    },
  });
}

export async function createBorrowedItem(input: {
  itemType: "asset" | "manual";
  assetId?: string;
  itemName?: string;
  quantity?: number;
  borrowerUserId: string;
  borrowedAt?: string;
  dueAt: string;
  notes?: string;
  actorUserId: string;
  accessScope?: AssetAccessScope | null;
}) {
  const result = createBorrowedItemSchema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Borrowing record could not be created.");
  }

  const parsed = result.data;
  const borrowedAt = parseDateTimeInput(parsed.borrowedAt ?? "", new Date()) ?? new Date();
  const dueAt = parseDateTimeInput(parsed.dueAt);
  const notes = normalizeOptional(parsed.notes);

  if (!dueAt) {
    throw new Error("Expected return date is required.");
  }

  return db.$transaction(async (tx) => {
    const borrower = await tx.user.findUnique({
      where: { id: parsed.borrowerUserId },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
      },
    });

    if (!borrower?.isActive) {
      throw new Error("Borrower is no longer available.");
    }

    if (parsed.itemType === "manual") {
      const created = await tx.borrowedItem.create({
        data: {
          itemName: parsed.itemName?.trim(),
          quantity: parsed.quantity,
          borrowerUserId: borrower.id,
          borrowedAt,
          dueAt,
          issuedByUserId: parsed.actorUserId,
          notes,
        },
        select: borrowedItemSelect,
      });

      await createBorrowedItemAuditEntry(tx, {
        actorUserId: parsed.actorUserId,
        action: "borrowed_item.created",
        entityId: created.id,
        summary: `Borrowed ${created.itemName}.`,
        payload: {
          itemType: "manual",
          itemName: created.itemName,
          quantity: created.quantity,
          borrowerUserId: borrower.id,
          dueAt,
          notes,
        },
      });

      return created;
    }

    const assetAccessWhere = buildAssetAccessWhere(input.accessScope);
    const asset = await tx.asset.findFirst({
      where: assetAccessWhere
        ? {
            id: parsed.assetId,
            AND: [assetAccessWhere],
          }
        : {
            id: parsed.assetId,
          },
      select: {
        id: true,
        assetTag: true,
        name: true,
        make: true,
        model: true,
        assignedUserId: true,
        assignedGuestProfileId: true,
        status: {
          select: {
            key: true,
          },
        },
        activeBorrowedItem: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!asset) {
      throw new Error("Asset was not found or is no longer available.");
    }

    if (asset.assignedUserId || asset.assignedGuestProfileId || asset.status?.key !== AVAILABLE_ASSET_STATUS_KEY || asset.activeBorrowedItem) {
      throw new Error("This asset is no longer available for borrowing.");
    }

    try {
      const created = await tx.borrowedItem.create({
        data: {
          assetId: asset.id,
          activeAssetId: asset.id,
          quantity: 1,
          borrowerUserId: borrower.id,
          borrowedAt,
          dueAt,
          issuedByUserId: parsed.actorUserId,
          notes,
        },
        select: borrowedItemSelect,
      });

      await createBorrowedItemAuditEntry(tx, {
        actorUserId: parsed.actorUserId,
        action: "borrowed_item.created",
        entityId: created.id,
        summary: `Borrowed asset ${asset.assetTag}.`,
        payload: {
          itemType: "asset",
          assetId: asset.id,
          assetTag: asset.assetTag,
          quantity: 1,
          borrowerUserId: borrower.id,
          dueAt,
          notes,
        },
      });

      return created;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new Error("This asset is already actively borrowed.");
      }

      throw error;
    }
  });
}

export async function markBorrowedItemReturned(input: {
  borrowedItemId: string;
  returnedAt: string;
  actorUserId: string;
  accessScope?: AssetAccessScope | null;
}) {
  const result = markReturnedSchema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Item could not be marked returned.");
  }

  const parsed = result.data;
  const returnedAt = parseDateTimeInput(parsed.returnedAt);

  if (!returnedAt) {
    throw new Error("Returned date is required.");
  }

  return db.$transaction(async (tx) => {
    const accessWhere = buildBorrowedItemAssetAccessWhere(input.accessScope);
    const existing = await tx.borrowedItem.findFirst({
      where: accessWhere
        ? {
            id: parsed.borrowedItemId,
            AND: [accessWhere],
          }
        : {
            id: parsed.borrowedItemId,
          },
      select: {
        id: true,
        assetId: true,
        activeAssetId: true,
        itemName: true,
        quantity: true,
        returnedAt: true,
        asset: {
          select: {
            assetTag: true,
          },
        },
      },
    });

    if (!existing) {
      throw new Error("Borrowing record was not found.");
    }

    if (existing.returnedAt) {
      throw new Error("This item has already been returned.");
    }

    const updated = await tx.borrowedItem.update({
      where: { id: existing.id },
      data: {
        activeAssetId: null,
        returnedAt,
        returnedByUserId: parsed.actorUserId,
      },
      select: borrowedItemSelect,
    });

    await createBorrowedItemAuditEntry(tx, {
      actorUserId: parsed.actorUserId,
      action: "borrowed_item.returned",
      entityId: updated.id,
      summary: `Returned ${updated.asset?.assetTag ?? updated.itemName}.`,
      payload: {
        assetId: existing.assetId,
        assetTag: existing.asset?.assetTag ?? null,
        itemName: existing.itemName,
        quantity: existing.quantity,
        returnedAt,
      },
    });

    return updated;
  });
}

const borrowedItemSelect = Prisma.validator<Prisma.BorrowedItemSelect>()({
  id: true,
  assetId: true,
  activeAssetId: true,
  itemName: true,
  quantity: true,
  borrowerUserId: true,
  borrowedAt: true,
  dueAt: true,
  returnedAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  asset: {
    select: {
      id: true,
      assetTag: true,
      name: true,
      make: true,
      model: true,
    },
  },
  borrowerUser: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  issuedByUser: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  returnedByUser: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
});
