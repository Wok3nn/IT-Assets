import { configurationMismatchDetails } from "./snapshot-differences.mjs";
// Only allowlisted literals may reach diagnostic output. Never print an Error,
// its message/cause, configuration values, paths, URLs or database results.
const stages = Object.freeze({
  UNEXPECTED_ERROR: "environment",
  INVALID_ARGUMENTS: "environment",
  DIGEST_KEY_UNAVAILABLE: "environment",
  CONTROL_STORE_LOAD_FAILED: "control-store",
  CONFIGURATION_MISSING: "control-store",
  LEGACY_TARGET_REJECTED: "legacy-inspection",
  LEGACY_INSPECTION_FAILED: "legacy-inspection",
  ENTRA_NORMALIZATION_FAILED: "credential-normalization",
  MAIL_NORMALIZATION_FAILED: "credential-normalization",
  CANONICALIZATION_FAILED: "configuration-comparison",
  CONFIGURATION_MISMATCH: "configuration-comparison",
  APPEARANCE_NOT_ENABLED: "runtime-categories",
  EMAIL_NOT_ENABLED: "runtime-categories",
  TIMEZONE_NOT_ENABLED: "runtime-categories",
  ENTRA_NOT_ENABLED: "runtime-categories",
  TITLE_READ_FAILED: "titles",
  TITLE_MISMATCH: "titles",
  SNAPSHOT_BUILD_FAILED: "environment",
  INVENTORY_READ_FAILED: "environment",
  EVIDENCE_READ_FAILED: "evidence",
  EVIDENCE_COMPARISON_FAILED: "evidence",
  EVIDENCE_WRITE_FAILED: "evidence",
  CLEANUP_FAILED: "environment",
});

export function snapshotDiagnostics(option) {
  let reason = "UNEXPECTED_ERROR";
  let details = [];
  return {
    at(code) { reason = Object.hasOwn(stages, code) ? code : "UNEXPECTED_ERROR"; },
    line() { return option === "1" ? `DIAGNOSTIC: stage=${stages[reason]} reason=${reason}` : null; },
    mismatch(expected, actual) {
      if (option !== "1") return;
      try { details = configurationMismatchDetails(JSON.parse(expected), JSON.parse(actual)); }
      catch { details = ["DIAGNOSTIC_DETAIL: category=configuration reason=DETAILS_UNAVAILABLE"]; }
    },
    details() { return option === "1" && reason === "CONFIGURATION_MISMATCH" ? details : []; },
  };
}

export function readInstallationState(store, diagnostic) {
  diagnostic.at("CONTROL_STORE_LOAD_FAILED");
  const configuration = store.installationConfiguration();
  diagnostic.at("CONFIGURATION_MISSING");
  if (!configuration) throw Error();
  diagnostic.at("CONTROL_STORE_LOAD_FAILED");
  const enabled = [store.presentationRuntime(), store.entraRuntime(), store.mailRuntime(), store.timezoneRuntime()].map(Boolean);
  return { configuration, enabled };
}

// Comparison-only projection of defaults materialized by appearance save and
// managed authentication capture. Never mutate stored/captured configuration.
export function adoptionComparisonExpected(expected, actual, authentication, entraEnabled) {
  const settings = { ...expected.settings };
  // These are the legacy settings.service and installation-presentation defaults.
  // Only accept their exact strings when the source row was absent.
  for (const [key, value] of [["app.title", "IT-Asset-Tracker"], ["session.timeoutMinutes", "15"]]) {
    if (!Object.hasOwn(settings, key) && actual.settings[key] === value) settings[key] = value;
  }
  if (!entraEnabled && authentication?.entraEnabled === false && authentication?.entraSsoEnabled === false) {
    for (const suffix of ["tenantId", "clientId", "redirectUri", "secretReference"]) {
      const key = "authentication.entra." + suffix;
      if (!Object.hasOwn(settings, key) && actual.settings[key] === "") settings[key] = "";
    }
  }
  return { ...expected, settings };
}

// Same adoption checks and order as snapshot.mjs; dependencies are explicit so
// failure classifications can be tested without Docker, secrets or databases.
export async function verifyAdoption({ store, configuration, enabled, fingerprint, load, readLegacyUrl }, diagnostic) {
  diagnostic.at("LEGACY_INSPECTION_FAILED");
  const adoption = await load("legacy-adoption");
  diagnostic.at("LEGACY_TARGET_REJECTED");
  const input = readLegacyUrl();
  const parsed = new URL(input);
  if (parsed.hostname !== "inventory" || parsed.pathname !== "/it_assets" || parsed.username !== "acceptance") throw Error();
  diagnostic.at("LEGACY_INSPECTION_FAILED");
  const inspected = await adoption.inspectLegacyAdoption(input, "/legacy-branding", true);
  let expected = inspected.installation;
  diagnostic.at("ENTRA_NORMALIZATION_FAILED");
  if (store.entraRuntime()) expected = (await load("installation-entra")).persistEntraCredential(expected);
  diagnostic.at("MAIL_NORMALIZATION_FAILED");
  if (store.mailRuntime()) expected = (await load("installation-mail")).persistMailCredential(expected);
  diagnostic.at("CANONICALIZATION_FAILED");
  const canonical = (await load("installation-configuration")).canonicalInstallationConfiguration;
  // Validate original payloads before projecting only known materialized defaults.
  canonical(expected);
  const actualCanonical = canonical(configuration);
  const expectedCanonical = canonical(adoptionComparisonExpected(expected, configuration, inspected.authentication, enabled[1]));
  const matches = fingerprint(expectedCanonical) === fingerprint(actualCanonical);
  diagnostic.at("CONFIGURATION_MISMATCH");
  if (!matches) {
    diagnostic.mismatch(expectedCanonical, actualCanonical);
    throw Error();
  }
  diagnostic.at("APPEARANCE_NOT_ENABLED");
  if (!enabled[0]) throw Error();
  diagnostic.at("EMAIL_NOT_ENABLED");
  if (!enabled[2]) throw Error();
  diagnostic.at("TIMEZONE_NOT_ENABLED");
  if (!enabled[3]) throw Error();
  diagnostic.at("ENTRA_NOT_ENABLED");
  if (expected.settings["authentication.entra.secretReference"] && !enabled[1]) throw Error();
  diagnostic.at("TITLE_READ_FAILED");
  const titlesMatch = store.organization()?.appTitle === store.presentation()?.appTitle;
  diagnostic.at("TITLE_MISMATCH");
  if (!titlesMatch) throw Error();
}
