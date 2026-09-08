import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IntegrationsPanel } from "../src/modules/integrations/components/integrations-panel";

test("integration panel shows truthful unconfigured state and semantic form controls", () => {
  const html = renderToStaticMarkup(createElement(IntegrationsPanel, {
    action: async () => ({}), integrations: [{ id: "deskmap", name: "DeskMap", description: "Assigned asset cards", enabled: false,
      credentialConfigured: false, expiresAt: null, lastSuccessAt: null, status: "Not configured", grants: [], activity: [] }],
  }));
  assert.match(html, /Not configured/);
  assert.match(html, /Awaiting|None/);
  assert.match(html, /assigned-assets:read/);
  assert.match(html, /disabled="">Enable access/);
  assert.match(html, /<label/);
  assert.match(html, /No activity recorded/);
  assert.doesNotMatch(html, /Connected|tokenHash/);
});
