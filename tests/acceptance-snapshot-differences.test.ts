import test from "node:test";
import assert from "node:assert/strict";
import { prepareInstallationConfiguration, prepareLegacyAuthentication, parseLegacyConnection } from "../src/modules/database-management/legacy-adoption";
import { prepareManagedConfiguration } from "../src/modules/database-management/managed-configuration-capture";
import { canonicalInstallationConfiguration } from "../src/modules/database-management/installation-configuration";
const modulePath = "../scripts/acceptance/snapshot-differences.mjs";
const diagnosticPath = "../scripts/acceptance/snapshot-validation.mjs";

test("real legacy and managed capture differ on absent Entra fields even with Entra disabled", async () => {
  const { configurationMismatchDetails } = await import(modulePath);
  const settings = new Map([["app.title", "Fixture"], ["session.timeoutMinutes", "15"]]);
  const profile = parseLegacyConnection("mysql://acceptance:fixture@inventory:3306/it_assets");
  const legacy = prepareInstallationConfiguration(settings, profile, []);
  const managed = prepareManagedConfiguration(settings, prepareLegacyAuthentication(settings), profile, () => { throw Error("No branding expected"); }, legacy.timeZone);
  assert.notEqual(canonicalInstallationConfiguration(legacy), canonicalInstallationConfiguration(managed));
  assert.deepEqual(configurationMismatchDetails(legacy, managed), [
    "DIAGNOSTIC_DETAIL: category=settings field=settings.authentication.entra.tenantId reason=MISSING_EXPECTED_EMPTY_ACTUAL",
    "DIAGNOSTIC_DETAIL: category=settings field=settings.authentication.entra.clientId reason=MISSING_EXPECTED_EMPTY_ACTUAL",
    "DIAGNOSTIC_DETAIL: category=settings field=settings.authentication.entra.redirectUri reason=MISSING_EXPECTED_EMPTY_ACTUAL",
    "DIAGNOSTIC_DETAIL: category=settings credential=entra-reference reason=CREDENTIAL_MISSING_EXPECTED",
  ]);
  // Prove the strict verifier still rejects this expected representation difference.
  const { snapshotDiagnostics, verifyAdoption } = await import(diagnosticPath);
  const diagnostic = snapshotDiagnostics("1");
  await assert.rejects(verifyAdoption({
    store: { entraRuntime: () => null, mailRuntime: () => null }, configuration: managed,
    enabled: [true, false, true, true], fingerprint: (value: string) => value,
    load: async (name: string) => name === "legacy-adoption" ? { inspectLegacyAdoption: async () => ({ installation: legacy }) } : { canonicalInstallationConfiguration },
    readLegacyUrl: () => "mysql://acceptance:fixture@inventory:3306/it_assets",
  }, diagnostic));
  assert.equal(diagnostic.line(), "DIAGNOSTIC: stage=configuration-comparison reason=CONFIGURATION_MISMATCH");
  assert.equal(diagnostic.details().length, 4);
});

test("difference details distinguish missing, null/empty, known normalization and unequal fields without values", async () => {
  const { configurationMismatchDetails } = await import(modulePath);
  const before = { settings: { "app.title": " Fixture ", "session.timeoutMinutes": "015", "mail.senderMailbox": null, "mail.tenantId": "", "mail.clientId": "private-left" }, timeZone: "UTC" };
  const after = { settings: { "app.title": "Fixture", "session.timeoutMinutes": "15", "mail.senderMailbox": "", "mail.clientId": "private-right" }, timeZone: "America/Toronto" };
  const details = configurationMismatchDetails(before, after).join("\n");
  for (const code of ["TRIM_NORMALIZATION_ONLY", "NUMBER_NORMALIZATION_ONLY", "NULL_VS_EMPTY", "EMPTY_EXPECTED_MISSING_ACTUAL", "UNEQUAL_VALUES"]) assert.ok(details.includes(code));
  for (const value of ["Fixture", "private-left", "private-right", "America/Toronto", "UTC", "015"]) assert.ok(!details.includes(value));
});

test("credential diagnostics expose only fixed states and never echo keys, references, hashes or filenames", async () => {
  const { configurationMismatchDetails } = await import(modulePath);
  const marker = "DO_NOT_OUTPUT_private_marker";
  const before = { settings: { "authentication.entra.clientSecret": "", "mail.clientSecret": marker, "mail.clientSecretEncrypted": marker }, settingsKeyHash: marker };
  const after = { settings: { "authentication.entra.clientSecret": marker, "mail.clientSecret": "different", [marker]: marker }, settingsKeyHash: "different", branding: [{ name: marker, base64: marker }] };
  const output = configurationMismatchDetails(before, after).join("\n");
  assert.match(output, /CREDENTIAL_EMPTY_VS_CONFIGURED/);
  assert.match(output, /CREDENTIAL_STATE_DIFFERENT/);
  assert.match(output, /CREDENTIAL_MISSING_ACTUAL/);
  assert.ok(!output.includes(marker));
  assert.ok(!output.includes("different"));
  assert.ok(!output.includes("clientSecret"));
  assert.deepEqual(configurationMismatchDetails({ [marker]: 1 }, { [marker]: 2 }), ["DIAGNOSTIC_DETAIL: category=configuration reason=UNCLASSIFIED_DIFFERENCE"]);
});

test("mismatch detail diagnostics are opt-in and do not escape into later failure stages", async () => {
  const { snapshotDiagnostics } = await import(diagnosticPath);
  for (const option of [undefined, "0", "true", "1"]) {
    const diagnostic = snapshotDiagnostics(option);
    diagnostic.at("CONFIGURATION_MISMATCH");
    diagnostic.mismatch('{"timeZone":"UTC"}', '{"timeZone":"America/Toronto"}');
    assert.equal(diagnostic.details().length, option === "1" ? 1 : 0);
    diagnostic.at("EVIDENCE_WRITE_FAILED");
    assert.deepEqual(diagnostic.details(), []);
  }
});
