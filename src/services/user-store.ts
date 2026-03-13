import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { appDataPaths, ensureAppDataDirs } from "@/services/app-data";

export type StoredUser = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  roles: string[];
  scopes: string[];
  isActive: boolean;
  createdAt: string;
};

async function writeUsers(users: StoredUser[]) {
  await ensureAppDataDirs();
  await writeFile(appDataPaths.users, JSON.stringify(users, null, 2), "utf8");
}

export async function readUsers() {
  try {
    const content = await readFile(appDataPaths.users, "utf8");
    return JSON.parse(content) as StoredUser[];
  } catch {
    return [];
  }
}

export async function findUserByEmail(email: string) {
  const users = await readUsers();
  return users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function createInitialAdmin(input: {
  email: string;
  displayName: string;
  passwordHash: string;
}) {
  const users = await readUsers();

  if (users.length > 0) {
    throw new Error("Initial admin already exists.");
  }

  const user: StoredUser = {
    id: randomUUID(),
    email: input.email,
    displayName: input.displayName,
    passwordHash: input.passwordHash,
    roles: ["SUPER_ADMIN"],
    scopes: [],
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  await writeUsers(users);

  return user;
}
