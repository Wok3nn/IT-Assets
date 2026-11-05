import type { ReactNode } from "react";
import { PanelCard } from "@/components/layout/panel-card";
import { TextField } from "@/components/forms/text-field";
import { SelectField } from "@/components/forms/select-field";
import { Button } from "@/components/ui/button";
import { databaseAction } from "./actions";
import type { PublicProfile } from "./control-store";
function Field({
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
function Form({
  op,
  id,
  version,
  revision,
  children,
}: {
  op: string;
  id?: string;
  version?: string;
  revision?: number;
  children: ReactNode;
}) {
  return (
    <form action={databaseAction} className="space-y-3">
      <input type="hidden" name="op" value={op} />
      <input type="hidden" name="revision" value={revision ?? 0} />
      <input type="hidden" name="id" value={id ?? ""} />
      <input type="hidden" name="version" value={version ?? ""} />
      {children}
    </form>
  );
}
export function ControlLogin({ registered }: { registered: boolean }) {
  return (
    <PanelCard>
      <h2 className="mb-4 text-xl font-semibold">
        {registered
          ? "Local administrator sign-in"
          : "Register the installation administrator"}
      </h2>
      <Form op={registered ? "login" : "enroll"}>
        {!registered && (
          <Field
            name="bootstrap"
            label="One-time token from the control directory’s bootstrap-token file"
            type="password"
          />
        )}
        <Field name="email" label="Administrator email" type="email" />
        <Field
          name="password"
          label={
            registered ? "Password" : "New password (at least 14 characters)"
          }
          type="password"
        />
        <Button type="submit">
          {registered ? "Sign in" : "Register administrator"}
        </Button>
      </Form>
    </PanelCard>
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
}: {
  profiles: PublicProfile[];
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
        {active && (
          <a className="underline" href="/login">
            Open inventory sign-in
          </a>
        )}
        <Form op="logout">
          <Button type="submit" variant="ghost">
            Sign out of database management
          </Button>
        </Form>
      </PanelCard>
      <PanelCard>
        <h2 className="mb-3 text-xl font-semibold">Add a connection</h2>
        <Form op="save" revision={revision}>
          <ProfileFields />
          <Button type="submit">Save connection</Button>
        </Form>
      </PanelCard>
      {profiles.map((p) => (
        <PanelCard key={p.id}>
          <h2 className="text-xl font-semibold">
            {p.name}
            {p.id === active ? " · Active" : ""}
          </h2>
          <p>
            {p.provider} · {p.host}:{p.port} / {p.database}
          </p>
          <div className="my-4 flex gap-2">
            {["test", "inspect"].map((op) => (
              <Form
                key={op}
                op={op}
                id={p.id}
                version={p.version}
                revision={revision}
              >
                <Button type="submit" variant="secondary">
                  {op === "test" ? "Test connectivity" : "Inspect schema"}
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
                    name="confirm"
                    label={`Type ${p.database} to confirm initialization`}
                  />
                  <Button type="submit">Initialize database</Button>
                </Form>
              </details>
              <details>
                <summary>Activate this inventory</summary>
                <Form
                  op="activate"
                  id={p.id}
                  version={p.version}
                  revision={revision}
                >
                  <p>
                    Current asset sessions end. No records will be copied or
                    deleted.
                  </p>
                  <Field
                    name="confirm"
                    label={`Type ${p.database} to confirm switching`}
                  />
                  <Button type="submit">Activate database</Button>
                </Form>
              </details>
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
      ))}
      <PanelCard>
        <h2 className="text-xl font-semibold">Database management activity</h2>
        <ul>
          {activity.map((a, i) => (
            <li key={i}>
              {a.at} UTC · {a.action}{" "}
              {profiles.find((p) => p.id === a.target)?.name}
            </li>
          ))}
        </ul>
      </PanelCard>
    </>
  );
}
