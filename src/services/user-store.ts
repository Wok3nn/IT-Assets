import { db } from "@/services/database";

export type StoredUser = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  roles: string[];
  scopes: string[];
  canLogin: boolean;
  isActive: boolean;
  createdAt: string;
};

function mapUser(user: {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  canLogin: boolean;
  isActive: boolean;
  createdAt: Date;
  userRoles: { role: { key: string } }[];
  userScopes: { scope: { slug: string } }[];
}) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.name,
    passwordHash: user.passwordHash,
    roles: user.userRoles.map(({ role }) => role.key),
    scopes: user.userScopes.map(({ scope }) => scope.slug),
    canLogin: user.canLogin,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  } satisfies StoredUser;
}

export async function readUsers() {
  const users = await db.user.findMany({
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
      userScopes: {
        include: {
          scope: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return users.map(mapUser);
}

export async function findUserByEmail(email: string) {
  const user = await db.user.findUnique({
    where: {
      email: email.toLowerCase(),
    },
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
      userScopes: {
        include: {
          scope: true,
        },
      },
    },
  });

  return user ? mapUser(user) : null;
}

export async function createInitialAdmin(input: {
  email: string;
  displayName: string;
  passwordHash: string;
}) {
  const existingUsers = await db.user.count();

  if (existingUsers > 0) {
    throw new Error("Initial admin already exists.");
  }

  const user = await db.$transaction(async (tx) => {
    const role = await tx.role.upsert({
      where: {
        key: "SUPER_ADMIN",
      },
      update: {
        name: "Super Admin",
      },
      create: {
        key: "SUPER_ADMIN",
        name: "Super Admin",
      },
    });

    return tx.user.create({
      data: {
        name: input.displayName,
        email: input.email.toLowerCase(),
        passwordHash: input.passwordHash,
        canLogin: true,
        isActive: true,
        userRoles: {
          create: {
            roleId: role.id,
          },
        },
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
        userScopes: {
          include: {
            scope: true,
          },
        },
      },
    });
  });

  return mapUser(user);
}

