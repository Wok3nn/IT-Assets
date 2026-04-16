import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const DISABLED_LOCAL_PASSWORD_PREFIX = "__ENTRA_ONLY__:";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");

  return `${salt}:${hash}`;
}

export function buildDisabledLocalPasswordHash() {
  return `${DISABLED_LOCAL_PASSWORD_PREFIX}${randomBytes(16).toString("hex")}`;
}

export function hasLocalPasswordConfigured(storedHash: string) {
  return !storedHash.startsWith(DISABLED_LOCAL_PASSWORD_PREFIX);
}

export function verifyPassword(password: string, storedHash: string) {
  if (!hasLocalPasswordConfigured(storedHash)) {
    return false;
  }

  const [salt, hash] = storedHash.split(":");

  if (!salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, KEY_LENGTH);

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

