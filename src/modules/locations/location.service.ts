import { z } from "zod";

import { db } from "@/services/database";

const colorHexSchema = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{6})$/, "Enter a valid hex color.");

const locationAppearanceSchema = z.object({
  colorHex: z.union([colorHexSchema, z.literal("")]).optional(),
  colorMode: z.enum(["border", "fill", "none"]).default("none"),
});

const saveLocationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional(),
  parentId: z.string().trim().cuid().optional().nullable(),
  colorHex: z.union([colorHexSchema, z.literal("")]).optional(),
  colorMode: z.enum(["border", "fill", "none"]).default("none"),
});

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return slug || "location";
}

async function generateUniqueSlug(name: string, currentLocationId?: string) {
  const baseSlug = slugify(name);
  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    const existingLocation = await db.location.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existingLocation || existingLocation.id === currentLocationId) {
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
  const parsed = locationAppearanceSchema.parse({
    colorHex: input.colorHex ?? "",
    colorMode: input.colorMode ?? "none",
  });

  const colorHex = normalizeColor(parsed.colorHex);
  const colorMode = colorHex && parsed.colorMode !== "none" ? parsed.colorMode : null;

  return { colorHex, colorMode };
}

export async function listTopLevelLocations() {
  return db.location.findMany({
    where: { parentId: null },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      parentId: true,
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

export async function getLocationById(locationId: string) {
  return db.location.findUnique({
    where: { id: locationId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
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

export async function listChildLocations(parentId: string) {
  return db.location.findMany({
    where: { parentId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
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

export async function createLocation(input: {
  name: string;
  description?: string;
  parentId?: string | null;
  colorHex?: string;
  colorMode?: "border" | "fill" | "none";
}) {
  const parsed = saveLocationSchema.parse({
    name: input.name,
    description: input.description ?? "",
    parentId: input.parentId || null,
    colorHex: input.colorHex ?? "",
    colorMode: input.colorMode ?? "none",
  });

  if (parsed.parentId) {
    const parent = await db.location.findUnique({
      where: { id: parsed.parentId },
      select: { id: true },
    });

    if (!parent) {
      throw new Error("Selected parent location does not exist.");
    }
  }

  const slug = await generateUniqueSlug(parsed.name);
  const appearance = parseAppearance(parsed);

  return db.location.create({
    data: {
      name: parsed.name,
      slug,
      parentId: parsed.parentId,
      description: normalizeDescription(parsed.description),
      colorHex: appearance.colorHex,
      colorMode: appearance.colorMode,
    },
  });
}

export async function updateLocation(input: {
  locationId: string;
  name: string;
  description?: string;
  colorHex?: string;
  colorMode?: "border" | "fill" | "none";
}) {
  const parsed = saveLocationSchema.omit({ parentId: true }).parse({
    name: input.name,
    description: input.description ?? "",
    colorHex: input.colorHex ?? "",
    colorMode: input.colorMode ?? "none",
  });

  const existingLocation = await db.location.findUnique({
    where: { id: input.locationId },
    select: { id: true },
  });

  if (!existingLocation) {
    throw new Error("Location not found.");
  }

  const slug = await generateUniqueSlug(parsed.name, existingLocation.id);
  const appearance = parseAppearance(parsed);

  return db.location.update({
    where: { id: existingLocation.id },
    data: {
      name: parsed.name,
      slug,
      description: normalizeDescription(parsed.description),
      colorHex: appearance.colorHex,
      colorMode: appearance.colorMode,
    },
  });
}

export async function deleteLocation(locationId: string) {
  const location = await db.location.findUnique({
    where: { id: locationId },
    select: {
      id: true,
      _count: {
        select: {
          children: true,
          assets: true,
        },
      },
    },
  });

  if (!location) {
    return;
  }

  if (location._count.children > 0 || location._count.assets > 0) {
    throw new Error("Location cannot be deleted while it still has children or assigned assets.");
  }

  await db.location.delete({
    where: { id: location.id },
  });
}

