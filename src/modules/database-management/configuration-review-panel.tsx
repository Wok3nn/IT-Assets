import { control } from "./control-store";
import { Form } from "./action-form";
import { Field } from "./field";
import { PanelCard } from "@/components/layout/panel-card";
import { Button } from "@/components/ui/button";
export function ConfigurationReviewPanel() {
  const reviews = control().configurationReviews();
  if (!reviews.length) return null;
  return <PanelCard><h2 className="text-xl font-semibold">Captured configuration reviews</h2>
    <p className="my-3">Compare the captured profile with installation configuration at capture time. Secrets remain hidden. Choosing the profile replaces the shared snapshot and organization title; only already-enabled appearance, session policy and Entra credentials take effect. Mail and timezone remain staged. This does not enable configuration or switch databases.</p>
    {reviews.map(review => <details key={review.id} className="my-4" open={review.status === "pending"}>
      <summary>{review.profile} · {review.capturedAt} · {review.status}</summary>
      {review.stale && <p role="alert">Installation settings changed after capture. This review cannot overwrite them. Capture a refreshed review explicitly.</p>}
      <div className="overflow-x-auto"><table className="my-3 w-full text-left text-sm">
        <thead><tr><th>Setting</th><th>Installation at capture</th><th>Captured profile</th></tr></thead>
        <tbody>{review.differences.map(item => <tr key={item.key}><td className="p-2">{item.key}</td><td className="break-all p-2">{item.current}</td><td className="break-all p-2">{item.captured}</td></tr>)}</tbody>
      </table></div>
      {!review.differences.length && <p>No global setting differences.</p>}
      {review.status === "pending" && <>
        <Form op="configuration-resolve" id={review.id}><input type="hidden" name="decision" value="keep" /><Button type="submit" variant="secondary">Keep current installation configuration</Button></Form>
        {!review.stale && <Form op="configuration-resolve" id={review.id}><input type="hidden" name="decision" value="profile" />
          <Field name="confirmation" label="Type APPLY SNAPSHOT to use these captured values (not current live profile values)" />
          <Button type="submit">Use captured profile configuration</Button>
        </Form>}
      </>}
      {review.status === "applied" && <Form op="configuration-restore" id={review.id}>
        <Field name="confirmation" label="Type RESTORE to restore the previous installation values; later edits block this operation" />
        <Button type="submit" variant="secondary">Restore previous installation values</Button>
      </Form>}
    </details>)}
  </PanelCard>;
}
