import { z } from "zod";

import { GUEST_TYPE_OPTIONS } from "@/modules/users/guest-profile-options";
import { db } from "@/services/database";

export type GuestStatusFilter = "active" | "archived" | "all";

const requiredIdSchema = z.string().trim().cuid();
const guestProfileSchema = z.object({
  displayName: z.string().trim().min(1, "Enter a display name.").max(120),
    guestType: z.string().trim().min(1, "Choose a Guest type.").max(80)
      .refine((value) => GUEST_TYPE_OPTIONS.includes(value as (typeof GUEST_TYPE_OPTIONS)[number]), "Choose a valid Guest type."),
  notes: z.union([z.string().trim().max(2000), z.literal("")]).optional(),
});

function normalizeOptional(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function listGuestProfiles(options?: { q?: string; status?: GuestStatusFilter }) {
  const q = options?.q?.trim();
  const status = options?.status ?? "active";

  return db.guestProfile.findMany({
    where: {
      ...(status === "active" ? { isActive: true } : status === "archived" ? { isActive: false } : {}),
      ...(q
        ? {
            OR: [
              { displayName: { contains: q } },
              { guestType: { contains: q } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      displayName: true,
      guestType: true,
      notes: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          assignedAssets: true,
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { displayName: "asc" }],
  });
}

export async function listActiveGuestProfilesForAssignment() {
  return db.guestProfile.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      displayName: true,
      guestType: true,
    },
    orderBy: [{ displayName: "asc" }],
  });
}

export async function getGuestProfileById(guestProfileId: string) {
  const id = requiredIdSchema.parse(guestProfileId);

  return db.guestProfile.findUnique({
    where: { id },
    select: {
      id: true,
      displayName: true,
      guestType: true,
      notes: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          assignedAssets: true,
        },
      },
    },
  });
}

export async function createGuestProfile(input: { displayName: string; guestType: string; notes?: string }) {
  const parsed = guestProfileSchema.parse(input);

  return db.guestProfile.create({
    data: {
      displayName: parsed.displayName,
      guestType: parsed.guestType,
      notes: normalizeOptional(parsed.notes),
    },
  });
}

export async function updateGuestProfile(input: { guestProfileId: string; displayName: string; guestType: string; notes?: string }) {
  const guestProfileId = requiredIdSchema.parse(input.guestProfileId);
  const parsed = guestProfileSchema.parse(input);

  return db.guestProfile.update({
    where: { id: guestProfileId },
    data: {
      displayName: parsed.displayName,
      guestType: parsed.guestType,
      notes: normalizeOptional(parsed.notes),
    },
  });
}

export async function archiveGuestProfile(guestProfileId: string) {
  const id = requiredIdSchema.parse(guestProfileId);
  const guestProfile = await db.guestProfile.findUnique({
    where: { id },
    select: {
      id: true,
      _count: {
        select: {
          assignedAssets: true,
        },
      },
    },
  });

  if (!guestProfile) {
    throw new Error("Guest Profile not found.");
  }

  if (guestProfile._count.assignedAssets > 0) {
    throw new Error("Check in assigned assets before archiving this Guest Profile.");
  }

  return db.guestProfile.update({
    where: { id: guestProfile.id },
    data: { isActive: false },
  });
}

export async function restoreGuestProfile(guestProfileId: string) {
  const id = requiredIdSchema.parse(guestProfileId);

  return db.guestProfile.update({
    where: { id },
    data: { isActive: true },
  });
}
