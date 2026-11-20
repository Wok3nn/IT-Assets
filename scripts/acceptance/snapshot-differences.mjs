// Fixed output vocabulary only. Never enumerate input keys into diagnostic output.
const fields = [
  ["format", ["format"]],
  ...["provider", "host", "port", "database"].map(key => ["source", ["source", key]]),
  ...["app.title", "session.timeoutMinutes", "branding.logo.light", "branding.logo.dark", "branding.icon.light", "branding.icon.dark",
    "authentication.entra.tenantId", "authentication.entra.clientId", "authentication.entra.redirectUri",
    "mail.tenantId", "mail.clientId", "mail.senderMailbox"].map(key => ["settings", ["settings", key]]),
  ["timeZone", ["timeZone"]],
  ["branding", ["branding"]],
];
const credentials = [
  ["settings", ["settings", "authentication.entra.secretReference"], "entra-reference"],
  ["settings", ["settings", "authentication.entra.clientSecret"], "entra-secret"],
  ["settings", ["settings", "mail.clientSecretEncrypted"], "email-encrypted-secret"],
  ["settings", ["settings", "mail.clientSecret"], "email-secret"],
  ["settingsKeyHash", ["settingsKeyHash"], "email-key-state"],
];
const trimmed = new Set(["settings.app.title", "settings.authentication.entra.tenantId", "settings.authentication.entra.clientId",
  "settings.authentication.entra.redirectUri", "settings.mail.tenantId", "settings.mail.clientId", "settings.mail.senderMailbox"]);
function read(object, path) {
  for (const key of path) {
    if (!object || !Object.hasOwn(object, key)) return { present: false, value: undefined };
    object = object[key];
  }
  return { present: true, value: object };
}
const equal = (left, right) => left.present === right.present && JSON.stringify(left.value) === JSON.stringify(right.value);
const empty = value => value === null || value === "" || value === undefined;

export function configurationMismatchDetails(expected, actual) {
  const lines = [];
  for (const [category, path] of fields) {
    const left = read(expected, path), right = read(actual, path);
    if (equal(left, right)) continue;
    const field = path.join(".");
    let reason = "UNEQUAL_VALUES";
    if (!left.present) reason = right.value === "" ? "MISSING_EXPECTED_EMPTY_ACTUAL" : "MISSING_EXPECTED";
    else if (!right.present) reason = left.value === "" ? "EMPTY_EXPECTED_MISSING_ACTUAL" : "MISSING_ACTUAL";
    else if ((left.value === null && right.value === "") || (left.value === "" && right.value === null)) reason = "NULL_VS_EMPTY";
    else if (trimmed.has(field) && typeof left.value === "string" && typeof right.value === "string" && left.value.trim() === right.value.trim()) reason = "TRIM_NORMALIZATION_ONLY";
    else if (field === "settings.session.timeoutMinutes" && typeof left.value === "string" && typeof right.value === "string" && left.value.trim() && right.value.trim() && Number.isFinite(Number(left.value)) && Number(left.value) === Number(right.value)) reason = "NUMBER_NORMALIZATION_ONLY";
    else if (empty(left.value) !== empty(right.value)) reason = "EMPTY_VS_VALUE";
    lines.push(`DIAGNOSTIC_DETAIL: category=${category} field=${field} reason=${reason}`);
  }
  for (const [category, path, field] of credentials) {
    const left = read(expected, path), right = read(actual, path);
    if (equal(left, right)) continue;
    const reason = !left.present ? "CREDENTIAL_MISSING_EXPECTED" : !right.present ? "CREDENTIAL_MISSING_ACTUAL"
      : empty(left.value) !== empty(right.value) ? "CREDENTIAL_EMPTY_VS_CONFIGURED" : "CREDENTIAL_STATE_DIFFERENT";
    lines.push(`DIAGNOSTIC_DETAIL: category=${category} credential=${field} reason=${reason}`);
  }
  return lines.length ? lines : ["DIAGNOSTIC_DETAIL: category=configuration reason=UNCLASSIFIED_DIFFERENCE"];
}
