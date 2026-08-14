import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_KEY_ENV = "APP_SETTINGS_ENCRYPTION_KEY";
const ENVELOPE_VERSION = "v1";
const GCM_IV_BYTES = 12;
const GCM_AUTH_TAG_BYTES = 16;
const REQUIRED_KEY_BYTES = 32;

export class AppSettingsEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppSettingsEncryptionError";
  }
}

function base64UrlEncode(value: Buffer) {
  return value.toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url");
}

function decodeEncryptionKey(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (/^[a-f0-9]{64}$/i.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  try {
    return Buffer.from(trimmed, "base64url");
  } catch {
    return null;
  }
}

export function getAppSettingsEncryptionKeyStatus() {
  const key = decodeEncryptionKey(process.env[ENCRYPTION_KEY_ENV] ?? "");

  return {
    configured: Boolean(key && key.length === REQUIRED_KEY_BYTES),
  };
}

function getRequiredEncryptionKey() {
  const key = decodeEncryptionKey(process.env[ENCRYPTION_KEY_ENV] ?? "");

  if (!key || key.length !== REQUIRED_KEY_BYTES) {
    throw new AppSettingsEncryptionError(`${ENCRYPTION_KEY_ENV} must be a 32-byte key encoded as base64/base64url or 64-character hex.`);
  }

  return key;
}

export function encryptAppSettingSecret(plaintext: string) {
  const key = getRequiredEncryptionKey();
  const iv = randomBytes(GCM_IV_BYTES);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv, {
    authTagLength: GCM_AUTH_TAG_BYTES,
  });
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    ENVELOPE_VERSION,
    base64UrlEncode(iv),
    base64UrlEncode(authTag),
    base64UrlEncode(ciphertext),
  ].join(":");
}

export function decryptAppSettingSecret(envelope: string) {
  const [version, ivValue, authTagValue, ciphertextValue] = envelope.split(":");

  if (version !== ENVELOPE_VERSION || !ivValue || !authTagValue || !ciphertextValue) {
    throw new AppSettingsEncryptionError("Encrypted setting uses an unsupported or invalid format.");
  }

  const key = getRequiredEncryptionKey();
  const iv = base64UrlDecode(ivValue);
  const authTag = base64UrlDecode(authTagValue);
  const ciphertext = base64UrlDecode(ciphertextValue);

  if (iv.length !== GCM_IV_BYTES || authTag.length !== GCM_AUTH_TAG_BYTES) {
    throw new AppSettingsEncryptionError("Encrypted setting uses an invalid AES-GCM envelope.");
  }

  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv, {
    authTagLength: GCM_AUTH_TAG_BYTES,
  });
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
