import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { hashPassword, verifyPassword } from "../../services/password";

export const managementPath = "/settings/database-management";
export const managementWorkspacePath = managementPath + "/workspace";
export const installationPath = "/installation";
// New name avoids ambiguity with old path-scoped cookies during upgrade.
export const controlCookie = "it_assets_management_visit";
export const visitFingerprint = (token: string) => hash(token).toString("hex");
export const managed = () => process.env.IT_ASSETS_MANAGED === "1";
const hash = (s: string) => createHash("sha256").update(s).digest();
const same = (a: string, b: string) => timingSafeEqual(hash(a), hash(b));
export class ControlError extends Error {}
export const profileSchema = z.object({
  name: z.string().trim().min(1).max(80),
  provider: z.enum(["sqlserver", "mariadb"]),
  host: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9][A-Za-z0-9.-]{0,252}$/),
  port: z.coerce.number().int().min(1).max(65535),
  database: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_][A-Za-z0-9_ -]{0,126}$/)
    .refine(
      (s) =>
        ![
          "master",
          "model",
          "msdb",
          "tempdb",
          "mysql",
          "information_schema",
          "performance_schema",
          "sys",
        ].includes(s.toLowerCase()),
    ),
  username: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[^{}\x00-\x1f]+$/),
  password: z
    .string()
    .min(1)
    .max(256)
    .regex(/^[^{}\x00-\x1f]+$/),
  trustCertificate: z.boolean().default(false),
});
export type Profile = z.infer<typeof profileSchema>;
export type PublicProfile = Omit<Profile, "password" | "username"> & {
  id: string;
  version: string;
};
type State = { revision: number; active: string | null };
type Admin = { email: string; passwordHash: string };

function privateFile(file: string, length: number) {
  try {
    writeFileSync(file, randomBytes(length).toString("base64url"), {
      flag: "wx",
      mode: 0o600,
    });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  }
  return readFileSync(file, "utf8").trim();
}

export class ControlStore {
  private db: DatabaseSync;
  private key: Buffer;
  private enrollment: string;
  constructor(directory: string) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const { DatabaseSync } = process.getBuiltinModule(
      "node:sqlite",
    ) as typeof import("node:sqlite");
    this.db = new DatabaseSync(path.join(directory, "control.sqlite"));
    this.db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS state(id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, active TEXT);
      INSERT OR IGNORE INTO state VALUES(1,0,NULL);
      CREATE TABLE IF NOT EXISTS admin(id INTEGER PRIMARY KEY CHECK(id=1),email TEXT NOT NULL,passwordHash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS session(digest TEXT PRIMARY KEY,expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS profile(id TEXT PRIMARY KEY, metadata TEXT NOT NULL, secret TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, action TEXT NOT NULL, target TEXT);
      CREATE TABLE IF NOT EXISTS throttle(id INTEGER PRIMARY KEY CHECK(id=1), attempts INTEGER, untilMs INTEGER);
      CREATE TABLE IF NOT EXISTS auth_config(profile TEXT PRIMARY KEY, config TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS operation(id INTEGER PRIMARY KEY CHECK(id=1), nonce TEXT NOT NULL);`);
    const keyFile = path.join(directory, "control.key");
    // Never silently replace a lost key when encrypted profiles already exist.
    const saved = this.db.prepare("SELECT 1 FROM profile LIMIT 1").get();
    this.key = Buffer.from(
      saved ? readFileSync(keyFile, "utf8").trim() : privateFile(keyFile, 32),
      "base64url",
    );
    if (this.key.length !== 32)
      throw new ControlError(
        "Invalid control key; restore the original key from backup.",
      );
    this.enrollment = path.join(directory, "bootstrap-token");
    if (!this.registered()) privateFile(this.enrollment, 32);
  }
  close() {
    this.db.close();
  }
  // Offline recovery only: caller must own the supervisor's exclusive SQLite lock.
  recover(operation: "unlock" | "password", password?: string) {
    this.tx(() => {
      if (operation === "unlock") this.db.exec("DELETE FROM operation");
      else {
        if (!this.registered())
          throw new ControlError("Complete enrollment first.");
        const valid = z.string().min(14).max(128).parse(password);
        this.db
          .prepare("UPDATE admin SET passwordHash=? WHERE id=1")
          .run(hashPassword(valid));
        this.db.exec("DELETE FROM session; DELETE FROM throttle");
      }
      this.audit("offline operator recovery: " + operation);
    });
  }
  state() {
    return this.db
      .prepare("SELECT revision,active FROM state WHERE id=1")
      .get() as State;
  }
  private tx<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  audit(action: string, target: string | null = null) {
    this.db
      .prepare("INSERT INTO audit(action,target) VALUES(?,?)")
      .run(action, target);
  }
  activity() {
    return this.db
      .prepare("SELECT at,action,target FROM audit ORDER BY id DESC LIMIT 15")
      .all() as { at: string; action: string; target: string | null }[];
  }
  registered() {
    return Boolean(this.db.prepare("SELECT id FROM admin LIMIT 1").get());
  }
  enroll(token: string, email: string, password: string) {
    if (this.registered()) throw new ControlError("Registration is closed.");
    if (!same(token, readFileSync(this.enrollment, "utf8").trim()))
      throw new ControlError("Invalid bootstrap token.");
    const validEmail = z
      .string()
      .trim()
      .email()
      .max(191)
      .parse(email)
      .toLowerCase();
    z.string().min(14).max(128).parse(password);
    this.tx(() => {
      this.db
        .prepare("INSERT INTO admin VALUES(1,?,?)")
        .run(validEmail, hashPassword(password));
      this.audit("administrator enrolled");
    });
    unlinkSync(this.enrollment);
  }
  login(email: string, password: string) {
    const now = Date.now();
    const allowed = this.tx(() => {
      const window = this.db
        .prepare("SELECT attempts,untilMs FROM throttle WHERE id=1")
        .get();
      if (
        window &&
        Number(window.untilMs) > now &&
        Number(window.attempts) >= 10
      )
        return false;
      this.db
        .prepare("INSERT OR REPLACE INTO throttle VALUES(1,?,?)")
        .run(
          window && Number(window.untilMs) > now
            ? Number(window.attempts) + 1
            : 1,
          window && Number(window.untilMs) > now
            ? Number(window.untilMs)
            : now + 300000,
        );
      return true;
    });
    if (!allowed)
      throw new ControlError("Too many attempts. Wait five minutes.");
    const admin = this.db
      .prepare("SELECT email,passwordHash FROM admin WHERE id=1")
      .get() as Admin | undefined;
    if (
      !admin ||
      password.length > 128 ||
      !verifyPassword(password, admin.passwordHash) ||
      !same(admin.email, email.trim().toLowerCase())
    )
      throw new ControlError("Invalid sign-in.");
    const token = randomBytes(32).toString("base64url");
    this.tx(() => {
      this.db.prepare("DELETE FROM session WHERE expires<=?").run(now);
      this.db
        .prepare("INSERT INTO session VALUES(?,?)")
        .run(hash(token).toString("hex"), now + 3600000);
      this.db.exec("DELETE FROM throttle");
      this.audit("operator signed in");
    });
    return token;
  }
  authorized(token: string) {
    return Boolean(
      token &&
        this.db
          .prepare("SELECT 1 FROM session WHERE digest=? AND expires>?")
          .get(hash(token).toString("hex"), Date.now()),
    );
  }
  logout(token: string) {
    this.db
      .prepare("DELETE FROM session WHERE digest=?")
      .run(hash(token).toString("hex"));
  }
  profiles(): PublicProfile[] {
    return this.db
      .prepare("SELECT id,metadata FROM profile ORDER BY rowid")
      .all()
      .map((r) => ({ ...JSON.parse(String(r.metadata)), id: String(r.id) }));
  }
  profile(id: string): Profile {
    const r = this.db
      .prepare("SELECT metadata,secret FROM profile WHERE id=?")
      .get(id);
    if (!r) throw new ControlError("Profile does not exist.");
    const [iv, tag, data] = String(r.secret)
      .split(".")
      .map((s) => Buffer.from(s, "base64url"));
    const cipher = createDecipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(id + String(r.metadata)));
    cipher.setAuthTag(tag);
    return profileSchema.parse({
      ...JSON.parse(String(r.metadata)),
      ...JSON.parse(
        Buffer.concat([cipher.update(data), cipher.final()]).toString(),
      ),
    });
  }
  save(input: Profile, existing?: string) {
    const { username, password, ...meta } = profileSchema.parse(input);
    const id = existing || randomUUID();
    const metadata = JSON.stringify({ ...meta, version: randomUUID() }),
      iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(id + metadata));
    const data = Buffer.concat([
      cipher.update(JSON.stringify({ username, password }), "utf8"),
      cipher.final(),
    ]);
    this.tx(() => {
      this.inactive(id);
      if (existing) {
        const before = this.profile(id);
        if (
          before.host !== meta.host ||
          before.port !== meta.port ||
          before.database !== meta.database ||
          before.provider !== meta.provider
        )
          this.db.prepare("DELETE FROM auth_config WHERE profile=?").run(id);
      }
      this.db
        .prepare("INSERT OR REPLACE INTO profile VALUES(?,?,?)")
        .run(
          id,
          metadata,
          [iv, cipher.getAuthTag(), data]
            .map((x) => x.toString("base64url"))
            .join("."),
        );
      this.audit(existing ? "profile updated" : "profile created", id);
    });
    return id;
  }
  private inactive(id: string) {
    if (this.state().active === id)
      throw new ControlError("Switch away from the active profile first.");
  }
  remove(id: string) {
    this.tx(() => {
      this.inactive(id);
      this.db.prepare("DELETE FROM profile WHERE id=?").run(id);
      this.db.prepare("DELETE FROM auth_config WHERE profile=?").run(id);
      this.audit("profile removed", id);
    });
  }
  private pinnedProfile() {
    const { active, revision } = this.state();
    if (!active || String(revision) !== process.env.IT_ASSETS_REVISION)
      throw new ControlError("Inventory changed. Reload first.");
    return active;
  }
  authentication(): unknown {
    const row = this.db
      .prepare("SELECT config FROM auth_config WHERE profile=?")
      .get(this.pinnedProfile());
    return row ? JSON.parse(String(row.config)) : null;
  }
  saveAuthentication(config: { entraSecretReference: string }) {
    if (
      config.entraSecretReference &&
      !/^IT_ASSETS_ENTRA_SECRET_[A-Z0-9_]+$/.test(config.entraSecretReference)
    )
      throw new ControlError(
        "Use an IT_ASSETS_ENTRA_SECRET_ environment variable name for the managed client secret.",
      );
    this.tx(() => {
      const id = this.pinnedProfile();
      this.db
        .prepare("INSERT OR REPLACE INTO auth_config VALUES(?,?)")
        .run(id, JSON.stringify(config));
      this.audit("workspace authentication updated", id);
    });
  }
  activate(id: string | null, revision: number) {
    this.tx(() => {
      if (id) this.profile(id);
      if (
        !this.db
          .prepare(
            "UPDATE state SET active=?,revision=revision+1 WHERE id=1 AND revision=?",
          )
          .run(id, revision).changes
      )
        throw new ControlError("Selection changed; reload first.");
      this.audit(id ? "profile activated" : "asset database disconnected", id);
    });
  }
  async exclusive<T>(fn: () => Promise<T>) {
    const nonce = randomUUID();
    if (
      !this.db.prepare("INSERT OR IGNORE INTO operation VALUES(1,?)").run(nonce)
        .changes
    )
      throw new ControlError("Another database operation is in progress.");
    try {
      return await fn();
    } finally {
      this.db.prepare("DELETE FROM operation WHERE nonce=?").run(nonce);
    }
  }
}
let store: ControlStore | undefined;
export function control() {
  if (!managed() || !process.env.IT_ASSETS_CONTROL_DIR)
    throw new ControlError("Managed startup is required.");
  return (store ??= new ControlStore(process.env.IT_ASSETS_CONTROL_DIR));
}
