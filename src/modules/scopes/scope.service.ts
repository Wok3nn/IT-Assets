import { z } from "zod";

import { db } from "@/services/database";

const colorHexSchema = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{6})$/, "Enter a valid hex color.");

const scopeAppearanceSchema = z.object({
  colorHex: z.union([colorHexSchema, z.literal("")]).optional(),
  colorMode: z.enum(["border", "fill", "none"]).default("none"),
});

const createScopeSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional(),
  colorHex: z.union([colorHexSchema, z.literal("")]).optional(),
  colorMode: z.enum(["border", "fill", "none"]).default("none"),
});

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return slug || "group";
}

async function generateUniqueSlug(name: string, currentScopeId?: string) {
  const baseSlug = slugify(name);
  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    const existingScope = await db.scope.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existingScope || existingScope.id === currentScopeId) {
      return slug;
    }

    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

function normalizeDescription(description?: string) {
  const trimmed = description?.trim();
  return trimmed ? trimmed : null;
}

function normalizeColor(colorHex?: string) {
  const trimmed = colorHex?.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

function parseAppearance(input: { colorHex?: string; colorMode?: "border" | "fill" | "none" }) {
  const parsed = scopeAppearanceSchema.parse({
    colorHex: input.colorHex ?? "",
    colorMode: input.colorMode ?? "none",
  });

  const colorHex = normalizeColor(parsed.colorHex);
  const colorMode = colorHex && parsed.colorMode !== "none" ? parsed.colorMode : null;

  return { colorHex, colorMode };
}

export async function listScopes() {
  return db.scope.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      colorHex: true,
      colorMode: true,
      isSystem: true,
      createdAt: true,
      _count: {
        select: {
          userScopes: true,
          assetScopes: true,
        },
      },
    },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
}

export async function getScopeById(scopeId: string) {
  return db.scope.findUnique({
    where: {
      id: scopeId,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      colorHex: true,
      colorMode: true,
      isSystem: true,
      _count: {
        select: {
          userScopes: true,
          assetScopes: true,
        },
      },
    },
  });
}

export async function createScope(input: {
  name: string;
  description?: string;
  colorHex?: string;
  colorMode?: "border" | "fill" | "none";
}) {
  const parsed = createScopeSchema.parse({
    name: input.name,
    description: input.description ?? "",
    colorHex: input.colorHex ?? "",
    colorMode: input.colorMode ?? "none",
  });

  const slug = await generateUniqueSlug(parsed.name);
  const appearance = parseAppearance(parsed);

  return db.scope.create({
    data: {
      name: parsed.name,
      slug,
      description: normalizeDescription(parsed.description),
      colorHex: appearance.colorHex,
      colorMode: appearance.colorMode,
    },
  });
}

export async function updateScope(input: {
  scopeId: string;
  name: string;
  description?: string;
  colorHex?: string;
  colorMode?: "border" | "fill" | "none";
}) {
  const parsed = createScopeSchema.parse({
    name: input.name,
    description: input.description ?? "",
    colorHex: input.colorHex ?? "",
    colorMode: input.colorMode ?? "none",
  });

  const existingScope = await db.scope.findUnique({
    where: {
      id: input.scopeId,
    },
    select: {
      id: true,
      isSystem: true,
    },
  });

  if (!existingScope) {
    throw new Error("Group not found.");
  }

  if (existingScope.isSystem) {
    throw new Error("System groups cannot be edited.");
  }

  const slug = await generateUniqueSlug(parsed.name, existingScope.id);
  const appearance = parseAppearance(parsed);

  return db.scope.update({
    where: {
      id: existingScope.id,
    },
    data: {
      name: parsed.name,
      slug,
      description: normalizeDescription(parsed.description),
      colorHex: appearance.colorHex,
      colorMode: appearance.colorMode,
    },
  });
}

export async function deleteScope(scopeId: string) {
  const scope = await db.scope.findUnique({
    where: {
      id: scopeId,
    },
    select: {
      id: true,
      isSystem: true,
      _count: {
        select: {
          userScopes: true,
          assetScopes: true,
        },
      },
    },
  });

  if (!scope) {
    return;
  }

  if (scope.isSystem) {
    throw new Error("System groups cannot be deleted.");
  }

  if (scope._count.userScopes > 0 || scope._count.assetScopes > 0) {
    throw new Error("Group cannot be deleted while it is assigned to users or assets.");
  }

  await db.scope.delete({
    where: {
      id: scope.id,
    },
  });
}

