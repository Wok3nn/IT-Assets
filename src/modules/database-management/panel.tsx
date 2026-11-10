import { Form } from "./action-form";
import type { Inspection } from "./setup-state";
import { PanelCard } from "@/components/layout/panel-card";
import { Button } from "@/components/ui/button";
import type { PublicProfile } from "./control-store";
import { Field } from "./field";
import { ConnectionFields } from "./connection-fields";
import { ActivationDialog } from "./activation-dialog";
import { DatabaseSummary } from "./database-summary";
export { Field } from "./field";
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
              <ConnectionFields />
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
            {stage === "prepare" ? <DatabaseSummary profile={p} active={p.id === active} /> : <>
            <h2 className="text-xl font-semibold">
              {p.name}
              {p.id === active ? " · Active" : ""}
            </h2>
            <p className="break-words">
              {p.provider} · {p.host}:{p.port} / {p.database}
            </p>
            </>}
            {stage === "connections" && selected === p.id && <p className="mt-2 text-sm font-medium">Selected for workspace preparation</p>}
            {stage !== "prepare" && <p role="status" className="mt-2 font-medium">
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
            </p>}
            {stage === "prepare" && status === "compatible" && <p className="mt-3 text-sm">{p.id === active ? "This database is selected. Continue to verify application readiness." : "An existing IT Assets workspace is ready to use. Its accounts and records will be preserved. No initialization is needed."}</p>}
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
                  <Button className="min-h-10" type="submit" variant="secondary">
                    {op === "validate"
                      ? "Test Connection & Inspect Schema"
                      : "Reinspect schema"}
                  </Button>
                </Form>
              ))}
              {p.id !== active && ["all", "prepare", "activate"].includes(stage) && status === "compatible" && (
                <ActivationDialog profile={p} revision={revision} />
              )}
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
                    <ConnectionFields profile={p} />
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
