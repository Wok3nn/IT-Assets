import { FieldError, Form } from "./action-form";
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
    <label className="block min-w-0 space-y-1 text-sm">
      {label}
      <TextField
        type={type}
        name={name}
        defaultValue={value}
        required={required}
        autoComplete={type === "password" ? "off" : undefined}
      />
      <FieldError name={name} />
    </label>
  );
}
function ProfileFields({ p }: { p?: PublicProfile }) {
  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      <Field name="name" label="Connection name" value={p?.name} />
      <label className="min-w-0 space-y-1 text-sm sm:col-span-2">
        Provider
        <SelectField name="provider" defaultValue={p?.provider ?? "sqlserver"}>
          <option value="sqlserver">
            Microsoft SQL Server (SQL authentication)
          </option>
          <option value="mariadb">MariaDB</option>
        </SelectField>
        <FieldError name="provider" />
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
  selected,
}: {
  profiles: PublicProfile[];
  inspections?: Record<string, Inspection | null>;
  stage?: "all" | "connections" | "prepare" | "activate";
  selected?: string;
  active: string | null;
  revision: number;
  activity: { at: string; action: string; target: string | null }[];
}) {
  return (
    <>
      {stage !== "prepare" && <PanelCard>
        <p>
          Active Database:{" "}
          <strong>
            {profiles.find((p) => p.id === active)?.name ?? "Not selected"}
          </strong>
        </p>
      </PanelCard>}
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
            {stage === "connections" && selected === p.id && <p className="mt-2 text-sm font-medium">Selected for workspace preparation</p>}
            <p role="status" className="mt-2 font-medium">
              {status && "Last inspection: "}
              {status === "compatible"
                ? "Connected — Compatible Database · Existing IT Assets Database Detected"
                : status === "empty"
                  ? "Connected — Empty Database"
                  : status === "failed"
                    ? "Disconnected — test again for diagnostics"
                    : status
                      ? "Connected — " + (status === "partial" ? "Partial" : "Incompatible") + " Database"
                      : "Not verified — test connection and inspect schema"}
            </p>
            {stage === "prepare" && status === "compatible" && <p className={p.id === active ? "mt-3 text-sm text-emerald-700 dark:text-emerald-300" : "mt-3 text-sm"}>{p.id === active ? "✓ Database activated." : "Compatible IT Assets workspace detected. Its accounts and records will be preserved. Initialization is unnecessary."}</p>}
            {stage === "prepare" && status !== "compatible" && status !== "empty" && <p role="alert" className="mt-3 text-sm">Return to Database Connection and inspect or select a compatible database. No destructive repair is available.</p>}
            <div className="my-4 flex flex-wrap gap-2">
              {(stage === "prepare" ? ["inspect"] : ["validate", "inspect"]).map((op) => (
                <Form
                  key={op}
                  op={op}
                  id={p.id}
                  version={p.version}
                  revision={revision}
                  step={stage === "prepare" ? "4" : "3"}
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
                {stage !== "prepare" && <details>
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
                </details>}
                {["all", "prepare"].includes(stage) && status === "empty" && (
                  <details>
                    <summary>Initialize an empty database</summary>
                    <Form
                      op="initialize"
                      id={p.id}
                      version={p.version}
                      revision={revision}
                      step="4"
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
                {["all", "prepare", "activate"].includes(stage) &&
                  status === "compatible" && (
                    <details>
                      <summary>Activate Database</summary>
                      <Form
                        op="activate"
                        id={p.id}
                        version={p.version}
                        revision={revision}
                        step="4"
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
                {stage !== "prepare" && <Form
                  op="remove"
                  id={p.id}
                  version={p.version}
                  revision={revision}
                >
                  <Button type="submit" variant="ghost">
                    Remove saved profile
                  </Button>
                </Form>}
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
