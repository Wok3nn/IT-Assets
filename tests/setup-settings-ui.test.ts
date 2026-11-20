import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SettingsSection, SettingsApproval } from "../src/modules/database-management/settings-section";
import { WizardFooter } from "../src/modules/database-management/wizard-footer";

test("existing database navigation remains in Step 3 and opens its settings disclosure", () => {
  const html = renderToStaticMarkup(createElement(WizardFooter, { step: 3, maximum: 3 }));
  assert.match(html, /Manage an existing database/);
  assert.match(html, /href="\/setup\/workspace\?step=3&amp;settings=1#existing-database-settings"/);
  assert.doesNotMatch(html, /\/settings\/database-management/);
});

test("settings help uses native disclosures and approval is required, visible and initially unchecked", () => {
  const section = { title: "Appearance & session", status: "Not enabled", description: "Choose shared settings.", help: "Applies across databases." };
  const html = renderToStaticMarkup(createElement(SettingsSection, section,
    createElement(SettingsApproval, { value: "APPLY SNAPSHOT" }, "Use MariaDB: inventory settings.")));
  assert.equal((html.match(/<details/g) ?? []).length, 2);
  assert.equal((html.match(/<summary/g) ?? []).length, 2);
  assert.match(html, /type="checkbox"/);
  assert.match(html, /required=""/);
  assert.match(html, /value="APPLY SNAPSHOT"/);
  assert.doesNotMatch(html, /checked=|type="hidden"|<details open/);
  assert.match(html, /Use MariaDB: inventory settings/);
});
