import { Prisma } from "@prisma/client";
import { z } from "zod";

import { getAuthenticationSettings } from "@/modules/settings/authentication-settings.service";
import { db } from "@/services/database";
import { buildDisabledLocalPasswordHash, hashPassword, hasLocalPasswordConfigured } from "@/services/password";

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

function isValidLocalPassword(password?: string | null) {
  return Boolean(password && password.trim().length >= 8);
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function canUseEntraOnlyLogin() {
  return getAuthenticationSettings().then((settings) => settings.entraEnabled && settings.entraSsoEnabled);
}

function buildPasswordHash(options: { allowLogin: boolean; password?: string | null; allowEntraOnlyLogin?: boolean }) {
  if (options.allowLogin && options.password) {
    return hashPassword(options.password);
  }

  if (options.allowLogin && options.allowEntraOnlyLogin) {
    return buildDisabledLocalPasswordHash();
  }

  if (!options.allowLogin) {
    return buildDisabledLocalPasswordHash();
  }

  return buildDisabledLocalPasswordHash();
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

  const [roleId, scopeIds, allowEntraOnlyLogin] = await Promise.all([
    getRoleIdOrThrow(parsed.roleKey),
    validateScopeIds(parsed.scopeIds),
    canUseEntraOnlyLogin(),
  ]);

  if (parsed.password && !isValidLocalPassword(parsed.password)) {
    throw new Error("A temporary password with at least 8 characters is required for local login.");
  }

  if (parsed.allowLogin && !isValidLocalPassword(parsed.password) && !allowEntraOnlyLogin) {
    throw new Error("A temporary password with at least 8 characters is required when login is enabled.");
  }

  try {
    return await db.user.create({
      data: {
        name: parsed.name,
        email: parsed.email,
        passwordHash: buildPasswordHash({
          allowLogin: parsed.allowLogin,
          password: parsed.password,
          allowEntraOnlyLogin,
        }),
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
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error("A user with this email already exists. Use a different email address or edit the existing user.");
    }

    throw error;
  }
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
      passwordHash: true,
    },
  });

  if (!existingUser) {
    throw new Error("User not found.");
  }

  const allowEntraOnlyLogin = await canUseEntraOnlyLogin();
  const hasExistingLocalPassword = hasLocalPasswordConfigured(existingUser.passwordHash);

  if (parsed.password && !isValidLocalPassword(parsed.password)) {
    throw new Error("A temporary password with at least 8 characters is required for local login.");
  }

  if (parsed.allowLogin && !existingUser.canLogin && !isValidLocalPassword(parsed.password) && !allowEntraOnlyLogin) {
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
    nextData.passwordHash = buildPasswordHash({ allowLogin: false });
  } else if (parsed.password) {
    nextData.passwordHash = buildPasswordHash({ allowLogin: true, password: parsed.password });
  } else if (!existingUser.canLogin && allowEntraOnlyLogin) {
    nextData.passwordHash = buildPasswordHash({ allowLogin: true, allowEntraOnlyLogin: true });
  } else if (existingUser.canLogin && !hasExistingLocalPassword && allowEntraOnlyLogin) {
    nextData.passwordHash = buildPasswordHash({ allowLogin: true, allowEntraOnlyLogin: true });
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

