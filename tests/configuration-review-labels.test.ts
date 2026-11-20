import test from "node:test";
import assert from "node:assert/strict";
import { configurationReviewLabel } from "../src/modules/database-management/configuration-review-labels";
import { installationSettingKeys } from "../src/modules/database-management/installation-configuration";

test("every review setting has a friendly label, including masked credential aliases", () => {
  for (const key of [...installationSettingKeys, "organization.appTitle", "authentication.entra.clientSecret", "mail.clientSecret", "timeZone", "mail encryption key", "branding files"]) {
    assert.notEqual(configurationReviewLabel(key), "Other setting", key);
    assert.doesNotMatch(configurationReviewLabel(key), /authentication\.|organization\.|branding\.|mail\./);
  }
  assert.equal(configurationReviewLabel("authentication.entra.clientId"), "Microsoft Entra Client ID");
  assert.equal(configurationReviewLabel("authentication.entra.redirectUri"), "Microsoft Entra Redirect URL");
  assert.equal(configurationReviewLabel("authentication.entra.secretReference"), "Microsoft Entra Secret");
  assert.equal(configurationReviewLabel("authentication.entra.tenantId"), "Microsoft Entra Tenant ID");
  assert.equal(configurationReviewLabel("organization.appTitle"), "Application name");
});
