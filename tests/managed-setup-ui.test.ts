import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InstallationShell } from "../src/components/layout/installation-shell";
import { SetupOverview } from "../src/modules/database-management/setup-overview";

test("offline setup shell exposes useful setup navigation without inventory creation", () => {
  const html = renderToStaticMarkup(
    createElement(
      InstallationShell,
      {
        context: "No asset database connected",
        navigation: "Setup overview",
      },
      createElement(SetupOverview, {
        registered: false,
        active: false,
      }),
    ),
  );
  assert.match(html, /Welcome to IT Assets/);
  assert.match(html, /Enroll installation administrator/);
  assert.match(html, /Installation navigation/);
  assert.match(html, /minmax\(0,1fr\)/);
  assert.match(html, /min-w-0/);
  assert.doesNotMatch(html, /href="\/(assets|users|settings"|login)/);
  assert.match(html, /skip initialization/);
  const ready = renderToStaticMarkup(
    createElement(SetupOverview, { registered: true, active: true }),
  );
  assert.match(ready, /Sign in to asset workspace/);
  assert.match(ready, /does not grant access to inventory records/);
});
