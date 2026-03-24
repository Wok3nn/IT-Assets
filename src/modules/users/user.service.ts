import { randomUUID } from "node:crypto";

import { z } from "zod";

import { db } from "@/services/database";
import { hashPassword } from "@/services/password";

const baseRoles = [
  { key: "SUPER_ADMIN", name: "Super Admin" },
  { key: "ADMIN", name: "Admin" },
  { key: "MANAGER", name: "Manager" },
  { key: "VIEWER", name: "Viewer" },
] as const;

const emailSchema = z.string().trim().email().max(160);

const createUserSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: emailSchema,
    allowLogin: z.boolean().default(false),
    password: z.string().max(128).optional(),
    roleKey: z.string().trim().min(1),
    scopeIds: z.array(z.string().trim().min(1)).default([]),
    isActive: z.boolean().default(true),
  })
  .superRefine((input, ctx) => {
    if (input.allowLogin && (!input.password || input.password.trim().length < 8)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: "A temporary password with at least 8 characters is required when login is enabled.",
      });
    }
  });

const updateUserSchema = z.object({
  userId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
  allowLogin: z.boolean().default(false),
  password: z.string().max(128).optional(),
  roleKey: z.string().trim().min(1),
  scopeIds: z.array(z.string().trim().min(1)).default([]),
  isActive: z.boolean().default(true),
  actorUserId: z.string().trim().min(1).optional(),
});

async function ensureBaseRoles() {
  await Promise.all(
    baseRoles.map((role) =>
      db.role.upsert({
        where: { key: role.key },
        update: { name: role.name },
        create: role,
      }),
    ),
  );
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function sanitizePassword(password?: string) {
  const trimmed = password?.trim();
  return trimmed ? trimmed : null;
}

function buildPasswordHash(allowLogin: boolean, password?: string | null) {
  if (allowLogin && password) {
    return hashPassword(password);
  }

  return hashPassword(randomUUID());
}

async function getRoleIdOrThrow(roleKey: string) {
  await ensureBaseRoles();

  const role = await db.role.findUnique({
    where: {
      key: roleKey,
    },
    select: {
      id: true,
    },
  });

  if (!role) {
    throw new Error("Role not found.");
  }

  return role.id;
}

async function validateScopeIds(scopeIds: string[]) {
  if (scopeIds.length === 0) {
    return [];
  }

  const scopes = await db.scope.findMany({
    where: {
      id: {
        in: scopeIds,
      },
    },
    select: {
      id: true,
    },
  });

  if (scopes.length !== scopeIds.length) {
    throw new Error("One or more selected groups no longer exist.");
  }

  return scopeIds;
}

export async function listUsers() {
  return db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      canLogin: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      _count: {
        select: {
          sessions: true,
          assets: true,
          auditEntries: true,
        },
      },
      userRoles: {
        select: {
          role: {
            select: {
              key: true,
              name: true,
            },
          },
        },
      },
      userScopes: {
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
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

export async function getUserById(userId: string) {
  return db.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      canLogin: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      _count: {
        select: {
          sessions: true,
          assets: true,
          auditEntries: true,
        },
      },
      userRoles: {
        select: {
          role: {
            select: {
              key: true,
              name: true,
            },
          },
        },
      },
      userScopes: {
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
  });
}

export async function listAssignableRoles() {
  await ensureBaseRoles();

  return db.role.findMany({
    select: {
      id: true,
      key: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });
}

export async function listAssignableScopes() {
  return db.scope.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      colorHex: true,
      colorMode: true,
    },
    orderBy: {
      name: "asc",
    },
  });
}

export async function createUser(input: {
  name: string;
  email: string;
  allowLogin?: boolean;
  password?: string;
  roleKey: string;
  scopeIds?: string[];
  isActive?: boolean;
}) {
  const parsed = createUserSchema.parse({
    ...input,
    email: normalizeEmail(input.email),
    password: sanitizePassword(input.password) ?? undefined,
    scopeIds: Array.from(new Set(input.scopeIds ?? [])).filter(Boolean),
  });

  const [roleId, scopeIds] = await Promise.all([getRoleIdOrThrow(parsed.roleKey), validateScopeIds(parsed.scopeIds)]);

  return db.user.create({
    data: {
      name: parsed.name,
      email: parsed.email,
      passwordHash: buildPasswordHash(parsed.allowLogin, parsed.password),
      canLogin: parsed.allowLogin,
      isActive: parsed.isActive,
      userRoles: {
        create: {
          roleId,
        },
      },
      userScopes: {
        create: scopeIds.map((scopeId) => ({
          scopeId,
        })),
      },
    },
  });
}

export async function updateUser(input: {
  userId: string;
  name: string;
  email: string;
  allowLogin?: boolean;
  password?: string;
  roleKey: string;
  scopeIds?: string[];
  isActive?: boolean;
  actorUserId?: string;
}) {
  const parsed = updateUserSchema.parse({
    ...input,
    email: normalizeEmail(input.email),
    password: sanitizePassword(input.password) ?? undefined,
    scopeIds: Array.from(new Set(input.scopeIds ?? [])).filter(Boolean),
  });

  if (parsed.actorUserId && parsed.actorUserId === parsed.userId && !parsed.isActive) {
    throw new Error("You cannot deactivate the account you are currently using.");
  }

  if (parsed.actorUserId && parsed.actorUserId === parsed.userId && !parsed.allowLogin) {
    throw new Error("You cannot disable login for the account you are currently using.");
  }

  const existingUser = await db.user.findUnique({
    where: {
      id: parsed.userId,
    },
    select: {
      id: true,
      canLogin: true,
    },
  });

  if (!existingUser) {
    throw new Error("User not found.");
  }

  if (parsed.allowLogin && !existingUser.canLogin && (!parsed.password || parsed.password.length < 8)) {
    throw new Error("Set a temporary password before enabling login for this user.");
  }

  const [roleId, scopeIds] = await Promise.all([getRoleIdOrThrow(parsed.roleKey), validateScopeIds(parsed.scopeIds)]);

  const nextData: {
    name: string;
    email: string;
    canLogin: boolean;
    isActive: boolean;
    passwordHash?: string;
    userRoles: {
      deleteMany: {};
      create: {
        roleId: string;
      };
    };
    userScopes: {
      deleteMany: {};
      create: { scopeId: string }[];
    };
  } = {
    name: parsed.name,
    email: parsed.email,
    canLogin: parsed.allowLogin,
    isActive: parsed.isActive,
    userRoles: {
      deleteMany: {},
      create: {
        roleId,
      },
    },
    userScopes: {
      deleteMany: {},
      create: scopeIds.map((scopeId) => ({
        scopeId,
      })),
    },
  };

  if (!parsed.allowLogin) {
    nextData.passwordHash = buildPasswordHash(false);
  } else if (parsed.password) {
    nextData.passwordHash = buildPasswordHash(true, parsed.password);
  }

  return db.user.update({
    where: {
      id: existingUser.id,
    },
    data: nextData,
  });
}

export async function deleteUser(userId: string, actorUserId?: string) {
  if (actorUserId && actorUserId === userId) {
    throw new Error("You cannot delete the account you are currently using.");
  }

  const user = await db.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      _count: {
        select: {
          assets: true,
          auditEntries: true,
        },
      },
    },
  });

  if (!user) {
    return;
  }

  if (user._count.assets > 0 || user._count.auditEntries > 0) {
    throw new Error("User cannot be deleted while they are linked to assets or audit history.");
  }

  await db.user.delete({
    where: {
      id: user.id,
    },
  });
}

