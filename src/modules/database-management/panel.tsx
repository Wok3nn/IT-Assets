import { Form } from "./action-form";
import type { Inspection } from "./setup-state";
import { PanelCard } from "@/components/layout/panel-card";
import { TextField } from "@/components/forms/text-field";
import { SelectField } from "@/components/forms/select-field";
import { Button } from "@/components/ui/button";

import type { PublicProfile } from "./control-store";
export function Field({
  name,
  label,
  type = "text",
  value,
  required = true,
}: {
  name: string;
  label: string;
  type?: string;
  value?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1 text-sm">
      {label}
      <TextField
        type={type}
        name={name}
        defaultValue={value}
        required={required}
        autoComplete={type === "password" ? "off" : undefined}
      />
    </label>
  );
}
function ProfileFields({ p }: { p?: PublicProfile }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field name="name" label="Connection name" value={p?.name} />
      <label>
        Provider
        <SelectField name="provider" defaultValue={p?.provider ?? "sqlserver"}>
          <option value="sqlserver">
            Microsoft SQL Server (SQL authentication)
          </option>
          <option value="mariadb">MariaDB</option>
        </SelectField>
      </label>
      <Field
        name="host"
        label="Server hostname or IPv4 address"
        value={p?.host}
      />
      <Field
        name="port"
        label="TCP port (SQL Server 1433; MariaDB 3306)"
        type="number"
        value={String(p?.port ?? 1433)}
      />
      <Field
        name="database"
        label="Existing database name"
        value={p?.database}
      />
      <Field
        name="username"
        label={
          p ? "New database login (blank keeps current)" : "Database login"
        }
        required={!p}
      />
      <Field
        name="password"
        label={p ? "New password (blank keeps current)" : "Database password"}
        type="password"
        required={!p}
      />
      <label className="text-sm">
        <input
          type="checkbox"
          name="trust"
          defaultChecked={p?.trustCertificate}
        />{" "}
        Trust a self-signed SQL Server certificate (isolated development only)
      </label>
    </div>
  );
}
export function DatabasePanel({
  profiles,
  active,
  revision,
  activity,
  inspections = {},
  stage = "all",
}: {
  profiles: PublicProfile[];
  inspections?: Record<string, Inspection | null>;
  stage?: "all" | "connections" | "prepare" | "activate";
  active: string | null;
  revision: number;
  activity: { at: string; action: string; target: string | null }[];
}) {
  return (
    <>
      <PanelCard>
        <p>
          Active inventory:{" "}
          <strong>
            {profiles.find((p) => p.id === active)?.name ?? "None selected"}
          </strong>
        </p>
        <p className="mt-2 text-sm">
          Save a connection → Test Connection & Inspect Schema → Activate.
          Initialize only an explicitly empty database. Existing compatible
          databases do not need initialization.
        </p>
        <p className="mt-2 text-sm">
          Your installation account does not grant inventory access. Use Back to
          IT Assets to leave management and open the workspace.
        </p>
      </PanelCard>
      {["all", "connections"].includes(stage) && (
        <PanelCard>
          <details key={profiles.length} open={profiles.length === 0}>
            <summary className="mb-3 cursor-pointer text-xl font-semibold">
              Add a connection
            </summary>
            <Form op="save" revision={revision}>
              <ProfileFields />
              <Button type="submit">Save connection</Button>
            </Form>
          </details>
        </PanelCard>
      )}
      {profiles.map((p) => {
        const evidence = inspections[p.id];
        const status =
          evidence?.version === p.version ? evidence.status : undefined;
        return (
          <PanelCard key={p.id}>
            <h2 className="text-xl font-semibold">
              {p.name}
              {p.id === active ? " · Active" : ""}
            </h2>
            <p className="break-words">
              {p.provider} · {p.host}:{p.port} / {p.database}
            </p>
            <p role="status" className="mt-2 font-medium">
              {status && "Last inspection: "}
              {status === "compatible"
                ? "Connected — Compatible Database · Existing IT Assets Database Detected"
                : status === "empty"
                  ? "Connected — Empty Database"
                  : status === "failed"
                    ? "Connection Failed — test again for diagnostics"
                    : status
                      ? "Connected — Incompatible or Partial Database"
                      : "Not verified — test connection and inspect schema"}
            </p>
            <div className="my-4 flex flex-wrap gap-2">
              {["validate", "inspect"].map((op) => (
                <Form
                  key={op}
                  op={op}
                  id={p.id}
                  version={p.version}
                  revision={revision}
                >
                  <Button type="submit" variant="secondary">
                    {op === "validate"
                      ? "Test Connection & Inspect Schema"
                      : "Reinspect schema"}
                  </Button>
                </Form>
              ))}
            </div>
            {p.id !== active && (
              <div className="space-y-4">
                <details>
                  <summary>Edit connection</summary>
                  <Form
                    op="save"
                    id={p.id}
                    version={p.version}
                    revision={revision}
                  >
                    <ProfileFields p={p} />
                    <Button type="submit">Save changes</Button>
                  </Form>
                </details>
                {["all", "prepare"].includes(stage) && status === "empty" && (
                  <details>
                    <summary>Initialize an empty database</summary>
                    <Form
                      op="initialize"
                      id={p.id}
                      version={p.version}
                      revision={revision}
                    >
                      <p>
                        Creates inventory tables and a separate workspace
                        administrator. Use a dedicated empty database.
                      </p>
                      <Field
                        name="workspaceEmail"
                        label="New workspace administrator email"
                        type="email"
                      />
                      <Field
                        name="workspacePassword"
                        label="New workspace password (at least 14 characters)"
                        type="password"
                      />
                      <Field
                        name="workspaceConfirmPassword"
                        label="Confirm workspace password"
                        type="password"
                      />
                      <Field
                        name="confirm"
                        label={`Type ${p.database} to confirm initialization`}
                      />
                      <Button type="submit">Initialize database</Button>
                    </Form>
                  </details>
                )}
                {["all", "activate"].includes(stage) &&
                  status === "compatible" && (
                    <details>
                      <summary>Activate this inventory</summary>
                      <Form
                        op="activate"
                        id={p.id}
                        version={p.version}
                        revision={revision}
                      >
                        <p>
                          Current asset sessions end. No records will be copied
                          or deleted.
                        </p>
                        <Field
                          name="confirm"
                          label={`Type ${p.database} to confirm switching`}
                        />
                        <Button type="submit">Activate database</Button>
                      </Form>
                    </details>
                  )}
                <Form
                  op="remove"
                  id={p.id}
                  version={p.version}
                  revision={revision}
                >
                  <Button type="submit" variant="ghost">
                    Remove saved profile
                  </Button>
                </Form>
              </div>
            )}
          </PanelCard>
        );
      })}
      {activity.length > 0 && (
        <PanelCard>
          <h2 className="text-xl font-semibold">
            Database management activity
          </h2>
          <ul>
            {activity.map((a, i) => (
              <li key={i}>
                {a.at} UTC · {a.action}{" "}
                {profiles.find((p) => p.id === a.target)?.name}
              </li>
            ))}
          </ul>
        </PanelCard>
      )}
    </>
  );
}
