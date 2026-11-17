import { entraFields, entraValues, persistEntraCredential, type EntraFields } from "./installation-entra";
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
import { canonicalInstallationConfiguration, installationConfigurationSchema, type InstallationConfiguration } from "./installation-configuration";
import { presentationSchema, presentationValues } from "./installation-presentation";
import { configurationDigest, configurationDifferences, validatedReviewCandidate, type ConfigurationReview } from "./configuration-review";
import {
  organizationSchema,
  type Organization,
  type Inspection,
  type RuntimeState,
  type ReadyState,
} from "./setup-state";

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
    .regex(/^[A-Za-z0-9][A-Za-z0-9.-]{0,252}$/, "Use a hostname or IPv4 address without spaces."),
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
type LegacyAdoption = { id: string; fingerprint: string; settingsKeyHash: string | null; entraSecretHash: string | null };

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
      CREATE TABLE IF NOT EXISTS installation_config(id INTEGER PRIMARY KEY CHECK(id=1), envelope TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS configuration_review(id TEXT PRIMARY KEY, sourceHash TEXT NOT NULL, envelope TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS operation(id INTEGER PRIMARY KEY CHECK(id=1), nonce TEXT NOT NULL);`);
    try {
      this.db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE IF NOT EXISTS setup_record(key TEXT PRIMARY KEY,value TEXT NOT NULL);
        INSERT OR IGNORE INTO setup_record VALUES('format','1');`);
      if (this.readSetup<number>("format") !== 1)
        throw new ControlError(
          "Unsupported local setup format. Use the matching application version.",
        );
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      this.db.close();
      throw error;
    }
    const keyFile = path.join(directory, "control.key");
    // Never silently replace a lost key when encrypted profiles already exist.
    const saved = this.db.prepare("SELECT 1 FROM profile UNION ALL SELECT 1 FROM installation_config UNION ALL SELECT 1 FROM configuration_review LIMIT 1").get();
    try {
      this.key = Buffer.from(
        saved ? readFileSync(keyFile, "utf8").trim() : privateFile(keyFile, 32),
        "base64url",
      );
      if (this.key.length !== 32)
        throw new ControlError("Invalid control key; restore the original key from backup.");
    } catch {
      this.db.close();
      throw new ControlError("Missing or invalid control key; restore the original key from backup.");
    }
    this.enrollment = path.join(directory, "bootstrap-token");
    if (!this.registered()) privateFile(this.enrollment, 32);
  }
  close() {
    this.db.close();
  }
  // Internal server API. Never serialize this secret-bearing record to clients.
  installationConfiguration(): InstallationConfiguration | null {
    const row = this.db.prepare("SELECT envelope FROM installation_config WHERE id=1").get();
    if (!row) return null;
    try {
      const [iv, tag, data] = String(row.envelope).split(".").map(value => Buffer.from(value, "base64url"));
      const cipher = createDecipheriv("aes-256-gcm", this.key, iv);
      cipher.setAAD(Buffer.from("installation-config:1"));
      cipher.setAuthTag(tag);
      return installationConfigurationSchema.parse(JSON.parse(Buffer.concat([cipher.update(data), cipher.final()]).toString()));
    } catch {
      throw new ControlError("Installation configuration cannot be read. Restore the matching control store and key.");
    }
  }
  stageInstallationConfiguration(input: InstallationConfiguration): "imported" | "unchanged" {
    let serialized: string;
    try { serialized = canonicalInstallationConfiguration(input); }
    catch { throw new ControlError("Installation configuration failed validation. No values were imported."); }
    return this.tx(() => {
      const previous = this.installationConfiguration();
      if (previous) {
        const runtime = this.readSetup<{ importedHash: string }>("presentationRuntime");
        if (runtime?.importedHash === hash(serialized).toString("hex") || this.entraRuntime()?.importedHash === hash(serialized).toString("hex")) return "unchanged" as const;
        if (canonicalInstallationConfiguration(previous) !== serialized)
          throw new ControlError("Installation configuration already exists and differs. Explicit conflict resolution is required; nothing was overwritten.");
        return "unchanged" as const;
      }
      const title = input.settings["app.title"];
      if (title && this.organization() && this.organization()!.appTitle !== title)
        throw new ControlError("Installation organization conflicts with the imported title. Resolve it explicitly before retrying.");
      const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", this.key, iv);
      cipher.setAAD(Buffer.from("installation-config:1"));
      const data = Buffer.concat([cipher.update(serialized, "utf8"), cipher.final()]);
      this.db.prepare("INSERT INTO installation_config VALUES(1,?)").run(
        [iv, cipher.getAuthTag(), data].map(value => value.toString("base64url")).join("."),
      );
      this.audit("installation configuration staged; runtime unchanged");
      return "imported" as const;
    });
  }
  entraRuntime() { return this.readSetup<{ version: string; importedHash: string }>("entraRuntime"); }
  // Secret-bearing server-only transport. Public views must use entraPublic().
  entraTransport() {
    return this.tx(() => {
      const runtime = this.entraRuntime();
      if (!runtime) return null;
      try { return { ...entraValues(this.installationConfiguration()!), version: runtime.version }; }
      catch { throw new ControlError("Installation Entra configuration is incomplete. Restore the control backup."); }
    });
  }
  entraPublic() {
    const values = this.entraTransport();
    return values ? { tenantId: values.tenantId, clientId: values.clientId, redirectUri: values.redirectUri, version: values.version, credentialConfigured: true } : null;
  }
  enableEntra(token: string, expected: string) {
    this.tx(() => {
      if (!this.authorized(token)) throw new ControlError("Installation administrator sign-in required.");
      if (this.entraRuntime()) throw new ControlError("Installation Entra is already active.");
      if (this.presentationCandidateVersion() !== expected) throw new ControlError("Configuration changed. Reload before confirming.");
      let candidate;
      try { candidate = persistEntraCredential(this.installationConfiguration()!); }
      catch { throw new ControlError("Stage complete verified Entra credentials before enabling installation Entra."); }
      this.writeInstallationConfiguration(candidate);
      this.writeSetup("entraRuntime", { version: randomUUID(), importedHash: expected });
      this.audit("installation Entra enabled");
    });
  }
  saveEntra(token: string, expected: string, input: EntraFields, replacementSecret: string) {
    this.tx(() => {
      if (!this.authorized(token)) throw new ControlError("Installation administrator sign-in required.");
      const runtime = this.entraRuntime();
      if (!runtime || runtime.version !== expected) throw new ControlError("Installation Entra changed. Reload before saving.");
      let candidate;
      try {
        const values = entraFields.parse(input), previous = this.installationConfiguration()!;
        candidate = persistEntraCredential({ ...previous, settings: { ...previous.settings,
          "authentication.entra.tenantId": values.tenantId, "authentication.entra.clientId": values.clientId,
          "authentication.entra.redirectUri": values.redirectUri,
          "authentication.entra.clientSecret": replacementSecret || entraValues(previous).clientSecret } });
      } catch { throw new ControlError("Enter valid Entra tenant, client and callback values and a valid client secret."); }
      this.writeInstallationConfiguration(candidate);
      this.writeSetup("entraRuntime", { ...runtime, version: randomUUID() });
      this.audit("installation Entra updated");
    });
  }
  presentationRuntime() {
    return this.readSetup<{ version: string; importedHash: string }>("presentationRuntime");
  }
  private configurationBaseline() {
    return configurationDigest({ configuration: this.installationConfiguration(), organization: this.organization(), runtime: this.presentationRuntime(), ...(this.entraRuntime() ? { entraRuntime: this.entraRuntime() } : {}) });
  }
  private readConfigurationReview(id: string): ConfigurationReview {
    const row = this.db.prepare("SELECT envelope FROM configuration_review WHERE id=?").get(id);
    if (!row) throw new ControlError("Configuration review does not exist.");
    try {
      const [iv, tag, data] = String(row.envelope).split(".").map(value => Buffer.from(value, "base64url"));
      const cipher = createDecipheriv("aes-256-gcm", this.key, iv);
      cipher.setAAD(Buffer.from("configuration-review:" + id)); cipher.setAuthTag(tag);
      return JSON.parse(Buffer.concat([cipher.update(data), cipher.final()]).toString()) as ConfigurationReview;
    } catch { throw new ControlError("Configuration review cannot be read. Restore the matching control backup and key."); }
  }
  private writeConfigurationReview(id: string, review: ConfigurationReview) {
    const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from("configuration-review:" + id));
    const data = Buffer.concat([cipher.update(JSON.stringify(review), "utf8"), cipher.final()]);
    this.db.prepare("INSERT OR REPLACE INTO configuration_review VALUES(?,?,?)").run(id, review.sourceHash, [iv, cipher.getAuthTag(), data].map(value => value.toString("base64url")).join("."));
  }
  captureConfigurationReview(profile: string, profileVersion: string, input: InstallationConfiguration, refresh = false) {
    let candidate: InstallationConfiguration;
    try { candidate = validatedReviewCandidate(input); presentationValues(candidate); }
    catch { throw new ControlError("Captured configuration is invalid. No review was saved."); }
    return this.tx(() => {
      if (this.profiles().find(item => item.id === profile)?.version !== profileVersion) throw new ControlError("Source connection changed. Capture again.");
      const sourceHash = configurationDigest({ profile, profileVersion, candidate });
      if (!refresh) {
        const existing = this.db.prepare("SELECT id FROM configuration_review WHERE sourceHash=? ORDER BY rowid DESC LIMIT 1").get(sourceHash);
        if (existing) { this.readConfigurationReview(String(existing.id)); return String(existing.id); }
      }
      const baseline = this.configurationBaseline(), id = configurationDigest({ sourceHash, baseline });
      if (this.db.prepare("SELECT 1 FROM configuration_review WHERE id=?").get(id)) { this.readConfigurationReview(id); return id; }
      this.writeConfigurationReview(id, { profile, profileVersion, sourceHash, baseline, candidate,
        previous: this.installationConfiguration(), previousOrganization: this.organization(), previousRuntime: this.presentationRuntime(), previousEntraRuntime: this.entraRuntime(),
        capturedAt: new Date().toISOString(), status: "pending" });
      this.audit("configuration review captured; approval required", id);
      return id;
    });
  }
  configurationReviews() {
    return this.db.prepare("SELECT id FROM configuration_review ORDER BY rowid DESC").all().map(row => {
      const id = String(row.id), review = this.readConfigurationReview(id);
      const differences = configurationDifferences(review.previous, review.candidate);
      if (review.previousOrganization?.appTitle !== presentationValues(review.candidate).appTitle)
        differences.push({ key: "organization.appTitle", current: review.previousOrganization?.appTitle ?? "Not configured", captured: presentationValues(review.candidate).appTitle });
      return { id, profile: review.profile, capturedAt: review.capturedAt, status: review.status,
        stale: review.status === "pending" && review.baseline !== this.configurationBaseline(),
        differences };
    });
  }
  resolveConfigurationReview(token: string, id: string, decision: "keep" | "profile") {
    this.tx(() => {
      if (!this.authorized(token)) throw new ControlError("Installation administrator sign-in required.");
      if (!["keep", "profile"].includes(decision)) throw new ControlError("Choose an explicit configuration resolution.");
      const review = this.readConfigurationReview(id);
      if (review.status === (decision === "keep" ? "kept" : "applied")) return;
      if (review.status !== "pending") throw new ControlError("This review was already resolved differently.");
      if (decision === "keep") {
        review.status = "kept"; review.result = this.configurationBaseline();
        this.writeConfigurationReview(id, review); this.audit("configuration review resolved: keep", id);
        return;
      }
      if (review.baseline !== this.configurationBaseline()) throw new ControlError("Installation settings changed after capture. Capture an explicit refreshed review; nothing was overwritten.");
      if (this.profiles().find(item => item.id === review.profile)?.version !== review.profileVersion) throw new ControlError("Source connection changed. Capture a new review.");
      if (decision === "profile") {
        let candidate = review.candidate;
        if (this.entraRuntime()) {
          try { candidate = persistEntraCredential(candidate); }
          catch { throw new ControlError("Captured Entra credentials are incomplete. Capture a verified configuration first."); }
          this.writeSetup("entraRuntime", { ...this.entraRuntime(), version: randomUUID() });
        }
        this.writeInstallationConfiguration(candidate);
        const values = presentationValues(review.candidate), organization = this.organization(), runtime = this.presentationRuntime();
        if (organization) this.writeSetup("organization", { ...organization, appTitle: values.appTitle, version: randomUUID() });
        if (runtime) this.writeSetup("presentationRuntime", { ...runtime, version: randomUUID() });
      }
      review.status = "applied";
      review.result = this.configurationBaseline();
      this.writeConfigurationReview(id, review);
      this.audit("configuration review resolved: " + decision, id);
    });
  }
  restoreConfigurationReview(token: string, id: string) {
    this.tx(() => {
      if (!this.authorized(token)) throw new ControlError("Installation administrator sign-in required.");
      const review = this.readConfigurationReview(id);
      if (review.status === "restored") return;
      if (review.status !== "applied" || review.result !== this.configurationBaseline()) throw new ControlError("Configuration changed since this resolution. Restore would overwrite later edits; review the protected backup instead.");
      if (review.previous) this.writeInstallationConfiguration(review.previous);
      else this.db.prepare("DELETE FROM installation_config WHERE id=1").run();
      if (review.previousOrganization) this.writeSetup("organization", { ...review.previousOrganization, version: randomUUID() });
      else this.db.prepare("DELETE FROM setup_record WHERE key='organization'").run();
      if (review.previousRuntime) this.writeSetup("presentationRuntime", { ...review.previousRuntime, version: randomUUID() });
      else this.db.prepare("DELETE FROM setup_record WHERE key='presentationRuntime'").run();
      if (review.previousEntraRuntime) this.writeSetup("entraRuntime", { ...review.previousEntraRuntime, version: randomUUID() });
      else this.db.prepare("DELETE FROM setup_record WHERE key='entraRuntime'").run();
      review.status = "restored"; this.writeConfigurationReview(id, review);
      this.audit("configuration review restored", id);
    });
  }
  profileAuthentication(id: string): unknown {
    this.profile(id);
    const row = this.db.prepare("SELECT config FROM auth_config WHERE profile=?").get(id);
    return row ? JSON.parse(String(row.config)) : null;
  }
  presentation() {
    return this.tx(() => {
      const runtime = this.presentationRuntime();
      if (!runtime) return null;
      const configuration = this.installationConfiguration();
      if (!configuration) throw new ControlError("Installation configuration is incomplete. Restore the control backup.");
      return { ...presentationValues(configuration), version: runtime.version };
    });
  }
  private writeInstallationConfiguration(configuration: InstallationConfiguration) {
    let serialized: string;
    try { serialized = canonicalInstallationConfiguration(configuration); }
    catch { throw new ControlError("Invalid installation configuration. Nothing was saved."); }
    const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from("installation-config:1"));
    const data = Buffer.concat([cipher.update(serialized, "utf8"), cipher.final()]);
    this.db.prepare("INSERT OR REPLACE INTO installation_config VALUES(1,?)").run([iv, cipher.getAuthTag(), data].map(value => value.toString("base64url")).join("."));
  }
  presentationCandidateVersion() {
    const candidate = this.installationConfiguration();
    return candidate ? hash(canonicalInstallationConfiguration(candidate)).toString("hex") : "new";
  }
  enablePresentation(token: string, expected: string) {
    this.tx(() => {
      if (!this.authorized(token)) throw new ControlError("Installation administrator sign-in required.");
      if (this.presentationRuntime()) throw new ControlError("Installation presentation is already active.");
      if (this.presentationCandidateVersion() !== expected) throw new ControlError("Configuration changed. Reload before confirming.");
      let candidate = this.installationConfiguration();
      if (!candidate) {
        if (this.profiles().length || this.legacyAdoption()) throw new ControlError("Stage the existing installation configuration offline before enabling shared settings.");
        candidate = { format: 1, source: { provider: "installation" }, settings: { "app.title": this.organization()?.appTitle || "IT-Asset-Tracker", "session.timeoutMinutes": "15" }, branding: [], timeZone: null, settingsKeyHash: null };
      }
      let values;
      try { values = presentationValues(candidate); }
      catch { throw new ControlError("Imported presentation settings are invalid. Resolve the source configuration first."); }
      const organization = this.organization();
      if (organization && organization.appTitle !== values.appTitle) throw new ControlError("Organization title conflicts with the staged configuration. Resolve it before enabling.");
      this.writeInstallationConfiguration(candidate);
      this.writeSetup("presentationRuntime", { version: randomUUID(), importedHash: hash(canonicalInstallationConfiguration(candidate)).toString("hex") });
      this.audit("installation presentation enabled");
    });
  }
  savePresentation(token: string, expected: string, input: { appTitle: string; sessionTimeoutMinutes: number },
    uploads: { key: "branding.logo.light" | "branding.logo.dark" | "branding.icon.light" | "branding.icon.dark"; name: string; base64: string }[] = []) {
    const values = presentationSchema.parse(input);
    this.tx(() => {
      if (!this.authorized(token)) throw new ControlError("Installation administrator sign-in required.");
      const runtime = this.presentationRuntime();
      if (!runtime || runtime.version !== expected) throw new ControlError("Installation settings changed. Reload before saving.");
      const candidate = this.installationConfiguration()!;
      candidate.settings["app.title"] = values.appTitle;
      candidate.settings["session.timeoutMinutes"] = String(values.sessionTimeoutMinutes);
      for (const upload of uploads) {
        if (!["branding.logo.light", "branding.logo.dark", "branding.icon.light", "branding.icon.dark"].includes(upload.key)) throw new ControlError("Invalid branding field.");
        candidate.settings[upload.key] = "/branding/uploads/" + upload.name;
        candidate.branding.push({ name: upload.name, base64: upload.base64 });
      }
      candidate.branding = candidate.branding.filter(file => Object.entries(candidate.settings).some(([key, value]) => key.startsWith("branding.") && value === "/branding/uploads/" + file.name));
      this.writeInstallationConfiguration(candidate);
      const organization = this.organization();
      if (organization) this.writeSetup("organization", { ...organization, appTitle: values.appTitle, version: randomUUID() });
      this.writeSetup("presentationRuntime", { ...runtime, version: randomUUID() });
      this.audit("installation presentation updated");
    });
  }
  private readSetup<T>(key: string): T | null {
    const row = this.db
      .prepare("SELECT value FROM setup_record WHERE key=?")
      .get(key);
    return row ? (JSON.parse(String(row.value)) as T) : null;
  }
  private writeSetup(key: string, value: unknown) {
    this.db
      .prepare("INSERT OR REPLACE INTO setup_record VALUES(?,?)")
      .run(key, JSON.stringify(value));
  }
  organization() {
    return this.readSetup<Organization & { version: string }>("organization");
  }
  saveOrganization(input: Organization, version: string) {
    const valid = organizationSchema.parse(input);
    this.tx(() => {
      if ((this.organization()?.version ?? "") !== version)
        throw new ControlError(
          "Installation settings changed. Reload before saving.",
        );
      this.writeSetup("organization", { ...valid, version: randomUUID() });
      const runtime = this.presentationRuntime();
      if (runtime) {
        const configuration = this.installationConfiguration()!;
        configuration.settings["app.title"] = valid.appTitle;
        this.writeInstallationConfiguration(configuration);
        this.writeSetup("presentationRuntime", { ...runtime, version: randomUUID() });
      }
      this.audit("installation settings saved");
    });
  }
  inspection(id: string) {
    return this.readSetup<Inspection>("inspection:" + id);
  }
  recordInspection(id: string, value: Inspection) {
    if (this.profiles().find((p) => p.id === id)?.version !== value.version)
      throw new ControlError("Connection changed. Inspect again.");
    this.writeSetup("inspection:" + id, value);
    this.writeSetup("candidate", id);
    if (value.status !== "compatible") this.clearReadiness();
  }
  candidate() {
    return this.readSetup<string>("candidate");
  }
  resumeStep() {
    if (!this.organization()) return "1";
    if (this.state().active) return "5";
    const id = this.candidate(),
      evidence = id ? this.inspection(id) : null;
    return evidence?.status === "compatible"
      ? "4"
      : evidence && evidence.status !== "failed"
        ? "4"
        : "3";
  }
  runtime() {
    return this.readSetup<RuntimeState>("runtime");
  }
  setRuntime(value: RuntimeState) {
    this.writeSetup("runtime", value);
  }
  readiness() {
    return this.readSetup<ReadyState>("readiness");
  }
  clearReadiness() {
    this.db.prepare("DELETE FROM setup_record WHERE key='readiness'").run();
  }
  markReady(value: ReadyState) {
    const state = this.state(),
      runtime = this.runtime();
    if (
      state.active !== value.profile ||
      state.revision !== value.revision ||
      runtime?.generation !== value.generation
    )
      throw new ControlError("Activation changed. Wait for the new process.");
    const evidence = this.inspection(value.profile);
    if (
      this.profiles().find((p) => p.id === value.profile)?.version !==
        value.version ||
      evidence?.version !== value.version ||
      evidence.fingerprint !== value.fingerprint ||
      evidence.status !== "compatible"
    )
      throw new ControlError("Fresh compatible schema evidence is required.");
    this.writeSetup("readiness", value);
    if (this.organization() && this.registered())
      this.writeSetup("completedAt", new Date().toISOString());
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
  administratorEmail() {
    return this.db.prepare("SELECT email FROM admin WHERE id=1").get()?.email as string | undefined;
  }
  enroll(
    token: string,
    email: string,
    password: string,
    organization?: Organization,
  ) {
    if (this.registered()) throw new ControlError("Registration is closed.");
    this.limitAttempts();
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
    const settings = organization
      ? organizationSchema.parse(organization)
      : null;
    this.tx(() => {
      this.db
        .prepare("INSERT INTO admin VALUES(1,?,?)")
        .run(validEmail, hashPassword(password));
      if (settings)
        this.writeSetup("organization", { ...settings, version: randomUUID() });
      this.audit("administrator enrolled");
    });
    unlinkSync(this.enrollment);
  }
  private limitAttempts() {
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
  }
  login(email: string, password: string) {
    const now = Date.now();
    this.limitAttempts();
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
    return this.saveProfile(input, existing);
  }
  legacyAdoption() { return this.readSetup<LegacyAdoption>("legacyAdoption"); }
  assertLegacyRuntime(id: string | null, settingsKey: string, entraSecret: string) {
    const adopted = this.legacyAdoption();
    if (!adopted || adopted.id !== id) return;
    const row = this.db.prepare("SELECT config FROM auth_config WHERE profile=?").get(id);
    const usesAdoptedSecret = row && JSON.parse(String(row.config)).entraSecretReference === "IT_ASSETS_ENTRA_SECRET_UPGRADE";
    if ((adopted.settingsKeyHash && hash(settingsKey).toString("hex") !== adopted.settingsKeyHash) ||
      (!this.entraRuntime() && usesAdoptedSecret && adopted.entraSecretHash && hash(entraSecret).toString("hex") !== adopted.entraSecretHash))
      throw new ControlError("The adopted workspace requires its verified deployment secrets. Restore the original settings key and Entra secret before activation/startup.");
  }
  adoptLegacy(input: Profile, record: LegacyAdoption, authentication: { entraSecretReference: string }) {
    return this.saveProfile(input, undefined, { record, authentication });
  }
  private saveProfile(input: Profile, existing?: string, adoption?: { record: LegacyAdoption; authentication: { entraSecretReference: string } }) {
    const { username, password, ...meta } = profileSchema.parse(input);
    const id = adoption?.record.id || existing || randomUUID();
    const metadata = JSON.stringify({ ...meta, version: randomUUID() }),
      iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(id + metadata));
    const data = Buffer.concat([
      cipher.update(JSON.stringify({ username, password }), "utf8"),
      cipher.final(),
    ]);
    this.tx(() => {
      if (adoption && (this.legacyAdoption() || this.profiles().some(p => p.id === id || (p.provider === meta.provider && p.host === meta.host && p.port === meta.port && p.database === meta.database))))
        throw new ControlError("Legacy adoption already exists or conflicts with a saved profile.");
      this.inactive(id);
      if (existing) {
        const before = this.profile(id);
        if (
          before.host !== meta.host ||
          before.port !== meta.port ||
          before.database !== meta.database ||
          before.provider !== meta.provider
        ) {
          if (this.legacyAdoption()?.id === id)
            throw new ControlError("Create a separate connection for a different target. The adopted profile retains its original workspace files and configuration.");
          this.db.prepare("DELETE FROM auth_config WHERE profile=?").run(id);
        }
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
      this.db
        .prepare("DELETE FROM setup_record WHERE key=?")
        .run("inspection:" + id);
      this.writeSetup("candidate", id);
      this.clearReadiness();
      if (adoption) {
        this.writeSetup("legacyAdoption", adoption.record);
        this.db.prepare("INSERT INTO auth_config VALUES(?,?)").run(id, JSON.stringify(adoption.authentication));
        this.audit("legacy connection adopted; activation pending", id);
      }
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
      this.db
        .prepare("DELETE FROM setup_record WHERE key=?")
        .run("inspection:" + id);
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
  saveAuthentication(config: { entraSecretReference: string; [key: string]: unknown }) {
    if (
      config.entraSecretReference &&
      !/^IT_ASSETS_ENTRA_SECRET_[A-Z0-9_]+$/.test(config.entraSecretReference)
    )
      throw new ControlError(
        "Use an IT_ASSETS_ENTRA_SECRET_ environment variable name for the managed client secret.",
      );
    this.tx(() => {
      const id = this.pinnedProfile();
      if (this.entraRuntime()) {
        // Preserve original transport values for rollback; only workspace policy may change here.
        const previous = this.profileAuthentication(id) as Record<string, unknown> | null;
        const incoming = config as typeof config & Record<string, unknown>;
        config = { ...incoming, entraTenantId: previous?.entraTenantId ?? "", entraClientId: previous?.entraClientId ?? "",
          entraRedirectUri: previous?.entraRedirectUri ?? "", entraSecretReference: String(previous?.entraSecretReference ?? "") };
      }
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
      this.clearReadiness();
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
