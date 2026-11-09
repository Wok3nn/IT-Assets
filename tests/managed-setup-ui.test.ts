import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SetupWizardShell } from "../src/components/layout/setup-wizard-shell";
import { wizardSteps } from "../src/modules/database-management/setup-steps";
test("unified wizard reuses original frame, branding and five guided steps", () => {
  const html = renderToStaticMarkup(
    createElement(SetupWizardShell, { steps: wizardSteps }),
  );
  assert.match(html, /First-run setup/);
  assert.match(html, /rounded-\[40px\]/);
  assert.match(html, /asset-tracker-logo/);
  for (const step of wizardSteps)
    assert.ok(html.includes(step.title.replaceAll("&", "&amp;")));
  assert.doesNotMatch(html, /href="\/assets/);
});
