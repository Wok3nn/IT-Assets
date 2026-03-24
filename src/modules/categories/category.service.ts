import { z } from "zod";

import { db } from "@/services/database";

const MAX_CATEGORY_LEVELS = 5;

const colorHexSchema = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{6})$/, "Enter a valid hex color.");

const categoryAppearanceSchema = z.object({
  colorHex: z.union([colorHexSchema, z.literal("")]).optional(),
  colorMode: z.enum(["border", "fill", "none"]).default("none"),
});

const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  parentId: z.string().trim().cuid().optional().nullable(),
  colorHex: z.union([colorHexSchema, z.literal("")]).optional(),
  colorMode: z.enum(["border", "fill", "none"]).default("none"),
});

const updateCategorySettingsSchema = z.object({
  categoryId: z.string().trim().cuid(),
  name: z.string().trim().min(2).max(80),
  colorHex: z.union([colorHexSchema, z.literal("")]).optional(),
  colorMode: z.enum(["border", "fill", "none"]).default("none"),
});

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return slug || "category";
}

async function generateUniqueSlug(name: string, excludeCategoryId?: string) {
  const baseSlug = slugify(name);
  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    const existing = await db.category.findUnique({ where: { slug } });

    if (!existing || existing.id === excludeCategoryId) {
      return slug;
    }

    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

function normalizeColor(colorHex?: string) {
  const trimmed = colorHex?.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

function parseAppearance(input: { colorHex?: string; colorMode?: "border" | "fill" | "none" }) {
  const parsed = categoryAppearanceSchema.parse({
    colorHex: input.colorHex ?? "",
    colorMode: input.colorMode ?? "none",
  });

  const colorHex = normalizeColor(parsed.colorHex);
  const colorMode = colorHex && parsed.colorMode !== "none" ? parsed.colorMode : null;

  return { colorHex, colorMode };
}

async function getCategoryDepth(categoryId: string) {
  const categories = await db.category.findMany({
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
    current = current.parentId ? categoryById.get(current.parentId) ?? null : null;
  }

  return depth;
}

export async function listTopLevelCategories() {
  return db.category.findMany({
    where: {
      parentId: null,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      colorHex: true,
      colorMode: true,
      createdAt: true,
      _count: {
        select: {
          children: true,
          assets: true,
        },
      },
    },
    orderBy: [{ name: "asc" }],
  });
}

export async function getCategoryById(categoryId: string) {
  return db.category.findUnique({
    where: {
      id: categoryId,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      colorHex: true,
      colorMode: true,
      _count: {
        select: {
          children: true,
          assets: true,
        },
      },
      parent: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

export async function listChildCategories(parentId: string) {
  return db.category.findMany({
    where: {
      parentId,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      colorHex: true,
      colorMode: true,
      createdAt: true,
      parent: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          children: true,
          assets: true,
        },
      },
    },
    orderBy: [{ name: "asc" }],
  });
}

export async function createCategory(input: {
  name: string;
  parentId?: string | null;
  colorHex?: string;
  colorMode?: "border" | "fill" | "none";
}) {
  const parsed = createCategorySchema.parse({
    name: input.name,
    parentId: input.parentId || null,
    colorHex: input.colorHex ?? "",
    colorMode: input.colorMode ?? "none",
  });

  if (parsed.parentId) {
    const parent = await db.category.findUnique({
      where: {
        id: parsed.parentId,
      },
      select: {
        id: true,
      },
    });

    if (!parent) {
      throw new Error("Selected parent category does not exist.");
    }

    const parentDepth = await getCategoryDepth(parent.id);
    if (parentDepth >= MAX_CATEGORY_LEVELS) {
      throw new Error(`Categories currently support a maximum of ${MAX_CATEGORY_LEVELS} levels.`);
    }
  }

  const slug = await generateUniqueSlug(parsed.name);
  const appearance = parseAppearance(parsed);

  return db.category.create({
    data: {
      name: parsed.name,
      slug,
      parentId: parsed.parentId,
      colorHex: appearance.colorHex,
      colorMode: appearance.colorMode,
    },
  });
}

export async function updateCategorySettings(input: {
  categoryId: string;
  name: string;
  colorHex?: string;
  colorMode?: "border" | "fill" | "none";
}) {
  const parsed = updateCategorySettingsSchema.parse({
    categoryId: input.categoryId,
    name: input.name,
    colorHex: input.colorHex ?? "",
    colorMode: input.colorMode ?? "none",
  });

  const existingCategory = await db.category.findUnique({
    where: {
      id: parsed.categoryId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!existingCategory) {
    throw new Error("Category not found.");
  }

  const appearance = parseAppearance(parsed);
  const slug = await generateUniqueSlug(parsed.name, parsed.categoryId);

  return db.category.update({
    where: {
      id: parsed.categoryId,
    },
    data: {
      name: parsed.name,
      slug,
      colorHex: appearance.colorHex,
      colorMode: appearance.colorMode,
    },
  });
}

export async function deleteCategory(categoryId: string) {
  const category = await db.category.findUnique({
    where: {
      id: categoryId,
    },
    select: {
      id: true,
      parentId: true,
      _count: {
        select: {
          children: true,
          assets: true,
        },
      },
    },
  });

  if (!category) {
    return;
  }

  if (category._count.children > 0 || category._count.assets > 0) {
    throw new Error("Category cannot be deleted while it still has children or assigned assets.");
  }

  await db.category.delete({
    where: {
      id: category.id,
    },
  });
}
