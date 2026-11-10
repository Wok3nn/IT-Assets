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

test("wizard cards are the single accessible step navigation", () => {
  const html = renderToStaticMarkup(createElement(SetupWizardShell, {
    steps: wizardSteps, currentStep: 3, completedSteps: [1, 2],
  }));
  assert.equal((html.match(/aria-current="step"/g) ?? []).length, 1);
  assert.equal((html.match(/aria-label="Completed"/g) ?? []).length, 2);
  for (let step = 1; step <= 5; step++) {
    assert.equal((html.match(new RegExp(`href="/setup/workspace\\?step=${step}"`, "g")) ?? []).length, 1);
  }
});
