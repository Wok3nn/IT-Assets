import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ControlStore, control } from "../src/modules/database-management/control-store";
import { prepareInstallationConfiguration } from "../src/modules/database-management/legacy-adoption";
import { prepareManagedConfiguration } from "../src/modules/database-management/managed-configuration-capture";
import { encryptAppSettingSecret } from "../src/services/app-settings-encryption";
import { getApplicationTimeZone, getCalendarDateKey, getCalendarDateUtc, getDaysBetweenCalendarDates } from "../src/modules/borrowed-items/borrowed-items-calendar";
import type { PrismaClient } from "@prisma/client";

const fields = { tenantId: "11111111-1111-4111-8111-111111111111", clientId: "22222222-2222-4222-8222-222222222222", senderMailbox: "sender@example.invalid" };
const secret = "disposable-mail-secret-persistent";
const profile = { name: "Fixture", provider: "mariadb" as const, host: "127.0.0.1", port: 1, database: "mail_fixture", username: "fixture", password: "fixture", trustCertificate: false };
function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), "mail-timezone-")), store = new ControlStore(directory);
  store.enroll(readFileSync(path.join(directory, "bootstrap-token"), "utf8").trim(), "operator@example.invalid", "Disposable mail password", { siteName: "Fixture", appTitle: "Fixture" });
  const token = store.login("operator@example.invalid", "Disposable mail password");
  return { directory, store, token };
}
function capture() {
  process.env.APP_SETTINGS_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64url");
  process.env.APP_TIME_ZONE = "America/Toronto";
  const settings = new Map([["mail.tenantId", fields.tenantId], ["mail.clientId", fields.clientId], ["mail.senderMailbox", fields.senderMailbox],
    ["mail.clientSecretEncrypted", encryptAppSettingSecret(secret)], ["mail.enabled", "true"], ["mail.adminRecipient", "private-workspace@example.invalid"], ["mail.dueReminderEnabled", "true"]]);
  return { settings, candidate: prepareInstallationConfiguration(settings, profile, []) };
}
test("legacy and managed mail capture preserve encrypted credentials without importing notification policy", () => {
  const { directory, store, token } = fixture(), { settings, candidate } = capture();
  const managedCandidate = prepareManagedConfiguration(settings, null, profile, () => { throw new Error("no files expected"); });
  assert.equal(managedCandidate.settings["mail.clientSecret"], secret);
  assert.equal(candidate.timeZone, "America/Toronto");
  assert.equal(candidate.settings["mail.clientSecretEncrypted"], settings.get("mail.clientSecretEncrypted"));
  assert.doesNotMatch(JSON.stringify(candidate), /private-workspace|mail.enabled|dueReminderEnabled/);
  store.stageInstallationConfiguration(candidate);
  assert.throws(() => store.enableMailTimezone("workspace-token", store.presentationCandidateVersion(), "mail"), /sign-in/);
  store.enableMailTimezone(token, store.presentationCandidateVersion(), "mail");
  store.enableMailTimezone(token, store.presentationCandidateVersion(), "timezone");
  delete process.env.APP_SETTINGS_ENCRYPTION_KEY;
  delete process.env.APP_TIME_ZONE;
  const maria = store.save(profile), sql = store.save({ ...profile, provider: "sqlserver" });
  for (const id of [maria, sql, maria]) {
    store.activate(id, store.state().revision);
    assert.equal(store.mailTransport()!.clientSecret, secret);
    assert.equal(store.timezone()!.timeZone, "America/Toronto");
  }
  assert.doesNotMatch(JSON.stringify(store.mailPublic()), new RegExp(secret));
  store.close();
  assert.ok(!readFileSync(path.join(directory, "control.sqlite")).includes(Buffer.from(secret)));
  const recreated = mkdtempSync(path.join(tmpdir(), "mail-recreated-"));
  cpSync(directory, recreated, { recursive: true }); // Stopped disposable store + key only.
  const reopened = new ControlStore(recreated);
  assert.equal(reopened.mailTransport()!.clientSecret, secret);
  assert.equal(reopened.timezone()!.timeZone, "America/Toronto"); reopened.close();
});
test("old ciphertext-only snapshots require the original key and interrupted enablement is retryable", () => {
  const { directory, store, token } = fixture(), { candidate } = capture();
  delete candidate.settings["mail.clientSecret"];
  store.stageInstallationConfiguration(candidate);
  const key = process.env.APP_SETTINGS_ENCRYPTION_KEY!;
  process.env.APP_SETTINGS_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString("base64url");
  assert.throws(() => store.enableMailTimezone(token, store.presentationCandidateVersion(), "mail"), /original mail key/);
  assert.equal(store.mailRuntime(), null);
  process.env.APP_SETTINGS_ENCRYPTION_KEY = key;
  const db = new DatabaseSync(path.join(directory, "control.sqlite"));
  db.exec("CREATE TRIGGER fail_mail BEFORE INSERT ON audit BEGIN SELECT RAISE(ABORT, 'fixture interruption'); END");
  assert.throws(() => store.enableMailTimezone(token, store.presentationCandidateVersion(), "mail"), /interruption/);
  assert.equal(store.mailRuntime(), null);
  assert.equal(store.installationConfiguration()!.settings["mail.clientSecret"], undefined);
  db.exec("DROP TRIGGER fail_mail"); db.close(); store.close();
  const reopened = new ControlStore(directory);
  reopened.enableMailTimezone(token, reopened.presentationCandidateVersion(), "mail");
  assert.equal(reopened.mailTransport()!.clientSecret, secret); reopened.close();
});
test("mail/timezone reviews reject stale approval and preserve encrypted rollback with rotated versions", () => {
  const { store, token } = fixture(), { candidate } = capture();
  store.stageInstallationConfiguration(candidate);
  store.enableMailTimezone(token, store.presentationCandidateVersion(), "mail");
  store.enableMailTimezone(token, store.presentationCandidateVersion(), "timezone");
  const id = store.save(profile), version = store.profiles()[0].version;
  const replacement = store.installationConfiguration()!;
  replacement.settings["mail.clientSecret"] = "review-replacement"; replacement.timeZone = "Europe/Paris";
  const review = store.captureConfigurationReview(id, version, replacement);
  const oldVersion = store.mailPublic()!.version;
  store.saveMail(token, oldVersion, fields, "newest-mail-secret");
  assert.throws(() => store.saveMail(token, oldVersion, fields, "lost"), /changed/);
  assert.throws(() => store.resolveConfigurationReview(token, review, "profile"), /changed after capture/);
  const fresh = store.captureConfigurationReview(id, version, replacement, true);
  assert.doesNotMatch(JSON.stringify(store.configurationReviews()), /newest-mail-secret|review-replacement/);
  store.resolveConfigurationReview(token, fresh, "profile"); store.resolveConfigurationReview(token, fresh, "profile");
  assert.equal(store.mailTransport()!.clientSecret, "review-replacement"); assert.equal(store.timezone()!.timeZone, "Europe/Paris");
  store.restoreConfigurationReview(token, fresh); store.restoreConfigurationReview(token, fresh);
  assert.equal(store.mailTransport()!.clientSecret, "newest-mail-secret"); assert.equal(store.timezone()!.timeZone, "America/Toronto");
  assert.throws(() => store.saveTimezone(token, store.timezone()!.version, "Invalid/Zone"), /IANA/);
  assert.throws(() => store.saveTimezone(token, store.timezone()!.version, "+03:00"), /IANA/);
  const tzVersion = store.timezone()!.version;
  store.saveTimezone(token, tzVersion, "UTC");
  assert.throws(() => store.saveTimezone(token, tzVersion, "Europe/Paris"), /changed/);
  store.saveMail(token, store.mailPublic()!.version, fields, "", true);
  assert.equal(store.mailPublic()!.credentialConfigured, false);
  assert.equal(store.mailTransport()!.clientSecret, ""); // Original ciphertext must not resurrect a cleared credential.
  store.close();
});
test("runtime reads preserve workspace notification isolation, offline transport and DST calendar semantics", async () => {
  const { directory, store: setup, token } = fixture(), { candidate } = capture();
  setup.stageInstallationConfiguration(candidate);
  setup.enableMailTimezone(token, setup.presentationCandidateVersion(), "mail");
  setup.enableMailTimezone(token, setup.presentationCandidateVersion(), "timezone"); setup.close();
  process.env.IT_ASSETS_MANAGED = "1"; process.env.IT_ASSETS_CONTROL_DIR = directory;
  const store = control(), maria = store.save(profile), sql = store.save({ ...profile, provider: "sqlserver" });
  const { getExchangeEmailSettings, getExchangeEmailRuntimeConfig, updateExchangeEmailSettings, clearExchangeEmailClientSecret } = await import("../src/modules/settings/exchange-email-settings.service");
  const { sendBorrowedItemCreatedNotifications } = await import("../src/modules/borrowed-items/borrowed-item-notifications.service");
  const { processBorrowedItemReminders } = await import("../src/modules/borrowed-items/borrowed-item-reminders.service");
  const policies = new Map([[maria, new Map([["mail.enabled", "true"], ["mail.adminRecipient", "maria@example.invalid"]])], [sql, new Map<string, string>()]]);
  for (const id of [maria, sql, maria]) {
    store.activate(id, store.state().revision); process.env.IT_ASSETS_REVISION = String(store.state().revision);
    const policy = policies.get(id)!;
    const mock = { setting: { findMany: async () => [...policy].map(([key, value]) => ({ key, value })), upsert: async ({ where, update }: { where: { key: string }; update: { value: string } }) => { policy.set(where.key, update.value); } } };
    global.prismaClientsByUrl = new Map([["managed:" + store.state().revision, mock as unknown as PrismaClient]]);
    const settings = await getExchangeEmailSettings();
    assert.equal(settings.senderMailbox, fields.senderMailbox);
    assert.equal(settings.adminRecipient, id === maria ? "maria@example.invalid" : "");
    assert.equal(settings.mailEnabled, id === maria);
    assert.equal((await getExchangeEmailRuntimeConfig())!.clientSecret, secret);
    assert.equal(getApplicationTimeZone(), "America/Toronto");
    await updateExchangeEmailSettings({ ...settings, senderMailbox: "forged@example.invalid", clientSecret: "" });
    assert.equal(store.mailPublic()!.senderMailbox, fields.senderMailbox);
    assert.equal(policy.has("mail.senderMailbox"), false);
    await assert.rejects(() => clearExchangeEmailClientSecret(), /installation administrator/);
    if (id === sql) assert.deepEqual(await sendBorrowedItemCreatedNotifications({} as Parameters<typeof sendBorrowedItemCreatedNotifications>[0]), { attempted: 0, sent: 0, failed: 0, skipped: 0 });
  }
  assert.equal(getCalendarDateKey(new Date("2026-03-08T04:30:00Z")), "2026-03-07");
  assert.equal(getCalendarDateKey(new Date("2026-03-08T07:30:00Z")), "2026-03-08");
  assert.equal(getCalendarDateKey(new Date("2026-11-01T05:30:00Z")), getCalendarDateKey(new Date("2026-11-01T06:30:00Z")));
  assert.equal(getDaysBetweenCalendarDates("2026-03-07", "2026-03-09"), 2);
  assert.equal(getCalendarDateUtc("2026-03-08").toISOString(), "2026-03-08T00:00:00.000Z");
  await assert.rejects(() => processBorrowedItemReminders(), /disabled/);
  store.activate(null, store.state().revision);
  assert.equal((await getExchangeEmailRuntimeConfig())!.clientSecret, secret);
  await assert.rejects(() => getExchangeEmailSettings(), /No active database/);
  const { sendGraphMail, sanitizeMailError } = await import("../src/services/graph-mail");
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => { calls++; throw new Error("must not dispatch"); };
  await assert.rejects(() => sendGraphMail({ ...fields, clientSecret: secret }, { to: "fixture@example.invalid", subject: "fixture", textBody: "fixture" }), /Workspace changed/);
  assert.equal(calls, 0);
  store.activate(maria, store.state().revision); process.env.IT_ASSETS_REVISION = String(store.state().revision);
  global.fetch = async () => { calls++; store.activate(sql, store.state().revision); return Response.json({ access_token: "fixture-token" }); };
  await assert.rejects(() => sendGraphMail({ ...fields, clientSecret: secret }, { to: "fixture@example.invalid", subject: "fixture", textBody: "fixture" }), /Workspace changed/);
  assert.equal(calls, 1); // No sendMail request after a switch during token acquisition.
  assert.doesNotMatch(sanitizeMailError(new Error(secret)), new RegExp(secret));
  global.fetch = originalFetch;
  store.close(); delete process.env.IT_ASSETS_MANAGED; delete process.env.APP_TIME_ZONE; delete process.env.APP_SETTINGS_ENCRYPTION_KEY;
});

test("fresh mail/timezone enablement retries preserve edits and can precede presentation setup", () => {
  const { store, token } = fixture();
  store.enableMailTimezone(token, "new", "mail");
  store.saveMail(token, store.mailPublic()!.version, fields, "new-admin-secret");
  store.enableMailTimezone(token, "new", "mail");
  assert.equal(store.mailTransport()!.clientSecret, "new-admin-secret");
  const candidateVersion = store.presentationCandidateVersion();
  store.enableMailTimezone(token, candidateVersion, "timezone");
  store.saveTimezone(token, store.timezone()!.version, "Europe/Paris");
  store.enableMailTimezone(token, candidateVersion, "timezone");
  assert.equal(store.timezone()!.timeZone, "Europe/Paris");
  store.enablePresentation(token, store.presentationCandidateVersion());
  assert.equal(store.presentation()!.appTitle, "Fixture");
  store.close();
});

test("Graph transport uses preserved credentials and never exposes echoed provider secrets", async () => {
  const { sendGraphMail, sanitizeMailError } = await import("../src/services/graph-mail");
  const originalFetch = global.fetch;
  let calls = 0;
  try {
    global.fetch = async (url, init) => {
      calls++;
      if (calls === 1) {
        assert.ok(String(url).endsWith("/token"));
        assert.equal((init!.body as URLSearchParams).get("client_secret"), secret);
        return Response.json({ access_token: "disposable-token" });
      }
      assert.ok(String(url).includes(encodeURIComponent(fields.senderMailbox)));
      assert.equal((init!.headers as Record<string, string>).Authorization, "Bearer disposable-token");
      assert.equal(JSON.parse(String(init!.body)).message.toRecipients[0].emailAddress.address, "recipient@example.invalid");
      return new Response(null, { status: 202 });
    };
    await sendGraphMail({ ...fields, clientSecret: secret }, { to: "recipient@example.invalid", subject: "mocked", textBody: "No network call" });
    assert.equal(calls, 2);
    global.fetch = async () => Response.json({ error_description: secret, access_token: "echoed-token" }, { status: 401 });
    await assert.rejects(() => sendGraphMail({ ...fields, clientSecret: secret }, { to: "recipient@example.invalid", subject: "mocked", textBody: "mocked" }), error => {
      assert.equal(sanitizeMailError(error), "Microsoft Graph token request failed (HTTP 401).");
      assert.doesNotMatch(String(error), new RegExp(secret)); return true;
    });
  } finally { global.fetch = originalFetch; }
});
