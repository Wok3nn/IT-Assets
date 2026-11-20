import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { canonicalInstallationConfiguration } from "../src/modules/database-management/installation-configuration";

const modulePath = "../scripts/acceptance/snapshot-validation.mjs";
const secret = "DO_NOT_PRINT_fixture_secret_or_mysql://credentials@host/database";
const expected = () => ({ format: 1, source: { provider: "mariadb", host: "inventory", port: 3306, database: "it_assets" },
  settings: { "app.title": "Fixture", "session.timeoutMinutes": "15", "mail.clientSecret": secret },
  branding: [], timeZone: "UTC", settingsKeyHash: null });
function fixture() {
  const modules: Record<string, Record<string, unknown>> = {
    "legacy-adoption": { inspectLegacyAdoption: async () => ({ installation: expected() }) },
    "installation-entra": { persistEntraCredential: (value: unknown) => value },
    "installation-mail": { persistMailCredential: (value: unknown) => value },
    "installation-configuration": { canonicalInstallationConfiguration },
  };
  const input = {
    store: { entraRuntime: () => true, mailRuntime: () => true,
      organization: () => ({ appTitle: "Fixture" }), presentation: () => ({ appTitle: "Fixture" }) },
    configuration: expected(), enabled: [true, true, true, true],
    fingerprint: (value: string) => createHash("sha256").update(value).digest("hex"),
    load: async (name: string) => modules[name],
    readLegacyUrl: () => "mysql://acceptance:fixture@inventory:3306/it_assets",
  };
  return { input, modules };
}

test("adoption diagnostics distinguish inspection, normalization, canonical mismatch, categories and titles", async () => {
  const { snapshotDiagnostics, verifyAdoption } = await import(modulePath);
  const cases: [string, string, (f: ReturnType<typeof fixture>) => void][] = [
    ["legacy-inspection", "LEGACY_TARGET_REJECTED", f => { f.input.readLegacyUrl = () => "mysql://acceptance:fixture@wrong-host/it_assets"; }],
    ["legacy-inspection", "LEGACY_INSPECTION_FAILED", f => { f.modules["legacy-adoption"].inspectLegacyAdoption = () => { throw Error(secret); }; }],
    ["credential-normalization", "ENTRA_NORMALIZATION_FAILED", f => { f.modules["installation-entra"].persistEntraCredential = () => { throw Error(secret); }; }],
    ["credential-normalization", "MAIL_NORMALIZATION_FAILED", f => { f.modules["installation-mail"].persistMailCredential = () => { throw Error(secret); }; }],
    ["configuration-comparison", "CANONICALIZATION_FAILED", f => { f.modules["installation-configuration"].canonicalInstallationConfiguration = () => { throw Error(secret); }; }],
    ["configuration-comparison", "CONFIGURATION_MISMATCH", f => { f.input.configuration.settings["app.title"] = "Different title"; }],
    ["configuration-comparison", "CONFIGURATION_MISMATCH", f => { f.input.configuration.settings["mail.clientSecret"] = "different-private-value"; }],
    ["configuration-comparison", "CONFIGURATION_MISMATCH", f => { f.input.configuration.timeZone = "America/Toronto"; }],
    ["runtime-categories", "APPEARANCE_NOT_ENABLED", f => { f.input.enabled[0] = false; }],
    ["runtime-categories", "EMAIL_NOT_ENABLED", f => { f.input.enabled[2] = false; }],
    ["runtime-categories", "TIMEZONE_NOT_ENABLED", f => { f.input.enabled[3] = false; }],
    ["runtime-categories", "ENTRA_NOT_ENABLED", f => {
      const configuration = { ...expected(), settings: { ...expected().settings, "authentication.entra.secretReference": "IT_ASSETS_ENTRA_SECRET_FIXTURE" } };
      f.input.configuration = configuration;
      f.modules["legacy-adoption"].inspectLegacyAdoption = async () => ({ installation: configuration });
      f.input.enabled[1] = false;
    }],
    ["titles", "TITLE_READ_FAILED", f => { f.input.store.organization = () => { throw Error(secret); }; }],
    ["titles", "TITLE_MISMATCH", f => { f.input.store.organization = () => ({ appTitle: "Different title" }); }],
  ];
  for (const [stage, reason, change] of cases) {
    const f = fixture(); change(f);
    const diagnostic = snapshotDiagnostics("1");
    await assert.rejects(verifyAdoption(f.input, diagnostic));
    assert.equal(diagnostic.line(), `DIAGNOSTIC: stage=${stage} reason=${reason}`);
    assert.ok(!diagnostic.line().includes(secret));
  }
});

test("diagnostic mode preserves successful checks and never relaxes a mismatch", async () => {
  const { snapshotDiagnostics, verifyAdoption } = await import(modulePath);
  for (const option of [undefined, "", "0", "true", "1"]) {
    const { input } = fixture();
    await verifyAdoption(input, snapshotDiagnostics(option));
    input.configuration.settings["app.title"] = "Mismatch";
    await assert.rejects(verifyAdoption(input, snapshotDiagnostics(option)));
  }
});

test("only explicit opt-in emits allowlisted stages; exception text and unknown codes cannot leak", async () => {
  const { snapshotDiagnostics } = await import(modulePath);
  for (const option of [undefined, "", "0", "true", secret]) {
    const diagnostic = snapshotDiagnostics(option);
    diagnostic.at("CONFIGURATION_MISMATCH");
    assert.equal(diagnostic.line(), null);
  }
  const diagnostic = snapshotDiagnostics("1");
  for (const [reason, stage] of [
    ["CONTROL_STORE_LOAD_FAILED", "control-store"], ["CONFIGURATION_MISSING", "control-store"],
    ["EVIDENCE_READ_FAILED", "evidence"], ["EVIDENCE_COMPARISON_FAILED", "evidence"], ["EVIDENCE_WRITE_FAILED", "evidence"],
    ["CLEANUP_FAILED", "environment"], ["DIGEST_KEY_UNAVAILABLE", "environment"],
  ]) {
    diagnostic.at(reason);
    assert.equal(diagnostic.line(), `DIAGNOSTIC: stage=${stage} reason=${reason}`);
  }
  diagnostic.at(secret);
  assert.equal(diagnostic.line(), "DIAGNOSTIC: stage=environment reason=UNEXPECTED_ERROR");
});

test("snapshot CLI ordinary failure output stays byte-identical and opt-in adds only a safe classification", () => {
  const run = (option: string) => spawnSync(process.execPath, ["scripts/acceptance/snapshot.mjs", secret], {
    encoding: "utf8", env: { ...process.env, IT_ASSETS_ACCEPTANCE_DIAGNOSTICS: option },
  });
  const normal = run("0"), diagnostic = run("1");
  const message = "FAIL: acceptance snapshot refused or comparison changed. Check private evidence and quiescence; no raw data is printed.\n";
  assert.equal(normal.status, 1); assert.equal(diagnostic.status, 1);
  assert.equal(normal.stdout, ""); assert.equal(diagnostic.stdout, "");
  assert.equal(normal.stderr, message);
  assert.equal(diagnostic.stderr, message + "DIAGNOSTIC: stage=environment reason=INVALID_ARGUMENTS\n");
});

test("control-store failures and missing configuration are classified without disclosing decrypted values", async () => {
  const { snapshotDiagnostics, readInstallationState } = await import(modulePath);
  for (const missing of [false, true]) {
    const diagnostic = snapshotDiagnostics("1");
    assert.throws(() => readInstallationState({ installationConfiguration: () => {
      if (missing) return null;
      throw Error(secret);
    } }, diagnostic));
    assert.equal(diagnostic.line(), `DIAGNOSTIC: stage=control-store reason=${missing ? "CONFIGURATION_MISSING" : "CONTROL_STORE_LOAD_FAILED"}`);
  }
});
