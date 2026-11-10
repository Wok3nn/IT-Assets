"use client";
import { useState } from "react";
import { SelectField } from "@/components/forms/select-field";
import { TextField } from "@/components/forms/text-field";
import type { PublicProfile } from "./control-store";
import { Field } from "./field";
import { FieldError } from "./action-form";

export function ConnectionFields({ profile }: { profile?: PublicProfile }) {
  const [provider, setProvider] = useState(profile?.provider ?? "sqlserver");
  const [port, setPort] = useState(String(profile?.port ?? 1433));
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-600 dark:text-slate-300">* Required fields. Use database credentials, not VM, Docker host or IT Assets sign-in credentials.</p>
      <div className="grid min-w-0 items-start gap-x-5 gap-y-4 sm:grid-cols-2">
        <Field name="name" label="Connection Name (Custom Name)" value={profile?.name}
          help="A friendly label, such as Office Inventory. It need not match the database name." />
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span>Database type <span aria-hidden="true">*</span></span>
          <SelectField name="provider" value={provider} required onChange={(event) => {
            const next = event.target.value as PublicProfile["provider"];
            if (port === (provider === "mariadb" ? "3306" : "1433")) setPort(next === "mariadb" ? "3306" : "1433");
            setProvider(next);
          }}>
            <option value="sqlserver">Microsoft SQL Server</option>
            <option value="mariadb">MariaDB</option>
          </SelectField>
          <span className="text-xs text-slate-600 dark:text-slate-300">Choose the database engine hosting your inventory.</span>
          <FieldError name="provider" />
        </label>
        <Field name="host" label="Database hostname / IP" value={profile?.host}
          help="Address reachable from IT Assets. In Compose, use the actual database service name on the shared network." />
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span>TCP port <span aria-hidden="true">*</span></span>
          <TextField type="number" name="port" required min={1} max={65535} value={port} onChange={(event) => setPort(event.target.value)} />
          <span className="text-xs text-slate-600 dark:text-slate-300">{provider === "mariadb" ? "Usually 3306" : "Usually 1433"}. Use the database listener port, or the published port when connecting through a host.</span>
          <FieldError name="port" />
        </label>
        <div className="sm:col-span-2">
          <Field name="database" label="Database name" value={profile?.database}
            help="Exact existing database name. Saving a connection does not create, initialize or activate it." />
        </div>
        <Field name="username" label="Database username" required={!profile}
          help={profile ? "Blank keeps the saved database login. Re-enter both credentials if changing the target." : "Use a dedicated database account scoped to this inventory, not a server or application account."} />
        <Field name="password" label="Database password" type="password" required={!profile}
          help={profile ? "Blank keeps the encrypted password. Saved passwords are never displayed." : "Password for that database account. Stored encrypted in the private control directory."} />
      </div>
      {provider === "sqlserver" && <label className="flex items-start gap-2 text-sm">
        <input className="mt-1" type="checkbox" name="trust" defaultChecked={profile?.trustCertificate} />
        Trust a self-signed SQL Server certificate (isolated development only)
      </label>}
      {provider === "mariadb" && <p className="text-xs text-slate-600 dark:text-slate-300">
        For this repository’s legacy Compose example, the database service is mariadb. Check your deployed Compose file; the managed example supplies only web. MariaDB transport security follows the existing deployment configuration.
      </p>}
    </div>
  );
}
