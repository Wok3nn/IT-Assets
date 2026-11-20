import { control } from "./control-store";
import { Form } from "./action-form";
import { SettingsSection, SettingsApproval, SettingsHelp } from "./settings-section";
import { Button } from "@/components/ui/button";
export function ConfigurationReviewPanel() {
  const store = control(), reviews = store.configurationReviews();
  const pending = reviews.filter(review => review.status === "pending").length;
  return <SettingsSection title="Import existing settings" status={pending ? `${pending} awaiting review` : reviews.length ? "Reviewed" : "No import ready"}
    open={pending > 0} description="Compare saved database settings before choosing what to keep."
    help={<><p>Your operator captures settings offline before they appear here. This screen never reads or modifies the source database.</p><p>Imports include appearance, session length, Entra, email and timezone settings. Approved values replace shared settings across databases; only already-enabled categories take effect. Importing does not enable a category or switch databases.</p><p>The comparison uses values saved at capture time, not live database values. Secrets stay hidden. Later installation changes block an outdated import; ask your operator to capture a refreshed review. An encrypted copy allows restoration unless later edits make it unsafe.</p></>}>
    {!reviews.length && <p className="text-sm">Ask your installation operator to prepare an import from the existing database.</p>}
    {reviews.map(review => {
      const source = review.source;
      const sourceLabel = source.provider === "installation" ? "Installation settings" : `${source.provider === "mariadb" ? "MariaDB" : "SQL Server"}: ${source.database}`;
      return <details key={review.id} className="border-t border-slate-300 py-3 dark:border-slate-600" open={review.status === "pending"}>
        <summary className="min-h-11 cursor-pointer py-2 font-medium">{sourceLabel} · {({ pending: "Awaiting review", kept: "Current settings kept", applied: "Imported", restored: "Restored" })[review.status]}</summary>
        <div className="min-w-0 space-y-3 pt-2">
          <p className="break-words text-sm">Current setup: <strong>{store.organization()?.appTitle ?? "IT Assets"}</strong></p>
          <p className="break-words text-sm">Existing database: <strong>{sourceLabel}</strong> · {review.capturedTitle}</p>
          {source.provider !== "installation" && <p className="break-all text-xs">Source: {source.host}:{source.port} / {source.database}</p>}
          <p className="text-xs">Saved for review: {review.capturedAt}</p>
          {review.stale && <p role="alert">Settings changed since this import was prepared. Keep current settings or ask your operator for a refreshed review.</p>}
          <SettingsHelp label={`Compare ${review.differences.length} changed settings`}>
            <p>Current setup at capture: {review.currentTitle}. Existing database values were saved at the time shown above.</p>
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Settings comparison"><table className="my-3 w-full min-w-[32rem] text-left text-sm">
              <caption className="sr-only">Current setup and existing database settings at capture</caption>
              <thead><tr><th scope="col">Setting</th><th scope="col">Current setup at capture</th><th scope="col">Existing database</th></tr></thead>
              <tbody>{review.differences.map(item => <tr key={item.key}><th scope="row" className="break-words p-2 font-normal">{item.key}</th><td className="break-all p-2">{item.current}</td><td className="break-all p-2">{item.captured}</td></tr>)}</tbody>
            </table></div>
            {!review.differences.length && <p>No shared setting differences.</p>}
          </SettingsHelp>
          {review.status === "pending" && <>
            <Form op="configuration-resolve" id={review.id}><input type="hidden" name="decision" value="keep" /><Button type="submit" variant="secondary">Keep current settings</Button></Form>
            {!review.stale && <Form op="configuration-resolve" id={review.id}><input type="hidden" name="decision" value="profile" />
              <SettingsApproval value="APPLY SNAPSHOT">Replace current shared settings with the saved settings from {sourceLabel}.</SettingsApproval>
              <Button type="submit">Use existing database settings</Button>
            </Form>}
          </>}
          {review.status === "applied" && <Form op="configuration-restore" id={review.id}>
            <SettingsApproval value="RESTORE">Restore the shared settings saved before this import. Later edits may block restoration.</SettingsApproval>
            <Button type="submit" variant="secondary">Restore previous settings</Button>
          </Form>}
        </div>
      </details>;
    })}
  </SettingsSection>;
}
