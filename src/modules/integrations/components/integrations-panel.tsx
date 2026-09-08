"use client";

import { useActionState, type ReactNode } from "react";
import { PanelCard } from "@/components/layout/panel-card";
import { TextField } from "@/components/forms/text-field";
import { SelectField } from "@/components/forms/select-field";
import { Button } from "@/components/ui/button";
import { ASSIGNMENT_SCOPE, type IntegrationOverview } from "../integrations.shared";

export type IntegrationActionResult = { error?: string; message?: string; token?: string };
type IntegrationAction = (state: IntegrationActionResult, data: FormData) => Promise<IntegrationActionResult>;

function IntegrationForm({ action, id, operation, children }: {
  action: IntegrationAction; id: string; operation: string; children: ReactNode;
}) {
  const [result, submit, pending] = useActionState(action, {});
  return <form action={submit} className="space-y-3">
    <input type="hidden" name="integrationId" value={id} />
    <input type="hidden" name="operation" value={operation} />
    <fieldset disabled={pending} className="space-y-3">
      {children}
    </fieldset>
    {pending && <p role="status">Saving…</p>}
    {result.error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{result.error}</p>}
    {result.message && <p role="status" className="text-sm">{result.message}</p>}
    {result.token && <div className="space-y-2">
      <p className="text-sm">Copy this credential to the consumer’s server secret store now. It cannot be retrieved later. Rotation invalidates the previous credential and disables access until enabled again.</p>
      <TextField aria-label="New integration credential" readOnly value={result.token} autoComplete="off" />
    </div>}
  </form>;
}

export function IntegrationsPanel({ integrations, action }: { integrations: IntegrationOverview[]; action: IntegrationAction }) {
  return <div className="space-y-6">
    {integrations.map((integration) => <PanelCard key={integration.id} aria-label={integration.name}>
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold">{integration.name}</h2>
          <p className="mt-1 text-sm">{integration.description}</p>
          <p className="mt-2 text-sm font-medium">{integration.status} · {integration.enabled ? "Enabled" : "Disabled"}</p>
        </div>
        <dl className="grid gap-3 text-sm md:grid-cols-3">
          <div><dt className="font-medium">Data scope</dt><dd>{ASSIGNMENT_SCOPE}</dd></div>
          <div><dt className="font-medium">Credential expiry</dt><dd>{integration.expiresAt ?? "Not configured"}</dd></div>
          <div><dt className="font-medium">Last successful request (UTC)</dt><dd>{integration.lastSuccessAt ?? "None"}</dd></div>
        </dl>
        <p className="text-sm">Access covers current assigned assets of explicitly approved users. Guest profiles and Borrowed Items are excluded. DeskMap still needs its own server connector.</p>
        <div className="grid gap-4 md:grid-cols-3">
          <IntegrationForm action={action} id={integration.id} operation="rotate">
            <Button type="submit" variant="secondary">{integration.credentialConfigured ? "Rotate credential" : "Create credential"}</Button>
          </IntegrationForm>
          <IntegrationForm action={action} id={integration.id} operation={integration.enabled ? "disable" : "enable"}>
            <Button type="submit" variant="secondary" disabled={!integration.enabled && (!integration.credentialConfigured || integration.grants.length === 0)}>{integration.enabled ? "Disable access" : "Enable access"}</Button>
          </IntegrationForm>
          <IntegrationForm action={action} id={integration.id} operation="revoke">
            <Button type="submit" variant="ghost" disabled={!integration.credentialConfigured}>Revoke credential</Button>
          </IntegrationForm>
        </div>
        <details className="space-y-4">
          <summary className="cursor-pointer font-medium">Configure approved users ({integration.grants.length})</summary>
          <IntegrationForm action={action} id={integration.id} operation="grant">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">Identity type
                <SelectField name="identityType" defaultValue="entra"><option value="entra">Entra tenant + Object ID</option><option value="local">Application user ID</option></SelectField>
              </label>
              <label className="space-y-1 text-sm">Application user ID
                <TextField name="userId" required maxLength={30} placeholder="ID from the user profile URL" />
              </label>
              <label className="space-y-1 text-sm">Entra tenant ID (Entra only)
                <TextField name="tenantId" maxLength={36} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
              </label>
              <label className="space-y-1 text-sm">Entra user Object ID (Entra only)
                <TextField name="objectId" maxLength={36} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
              </label>
            </div>
            <p className="text-sm">Verify both IDs before approving. This grants access to all assets currently assigned to that user. Saving an existing identity replaces its mapping.</p>
            <Button type="submit">Approve user mapping</Button>
          </IntegrationForm>
          <ul className="space-y-3">
            {integration.grants.map((grant) => <li key={grant.key} className="break-all text-sm">
              <p>{grant.identity} → {grant.userId}</p>
              <IntegrationForm action={action} id={integration.id} operation="remove-grant">
                <input type="hidden" name="grantKey" value={grant.key} />
                <Button type="submit" variant="ghost" aria-label={`Remove approval for ${grant.identity}`}>Remove approval</Button>
              </IntegrationForm>
            </li>)}
          </ul>
        </details>
        <details>
          <summary className="cursor-pointer font-medium">Recent activity</summary>
          <ul className="mt-3 space-y-2 text-sm">{integration.activity.map((entry) => <li key={entry.id}>{entry.createdAt} — {entry.summary}</li>)}</ul>
          {integration.activity.length === 0 && <p className="mt-3 text-sm">No activity recorded.</p>}
        </details>
      </div>
    </PanelCard>)}
  </div>;
}
