"use client";
import { useId, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Form } from "./action-form";
import { confirmationDialogClassName } from "./confirmation-dialog.styles";

function ImportButtons({ close }: { close: () => void }) {
  const { pending } = useFormStatus();
  return <div className="flex flex-wrap justify-end gap-3">
    <Button autoFocus type="button" variant="secondary" disabled={pending} onClick={close}>Cancel</Button>
    <Button type="submit" disabled={pending}>Confirm</Button>
  </div>;
}

export function ConfigurationImportDialog({ reviewId }: { reviewId: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId(), description = useId();
  return <>
    <Button type="button" onClick={() => dialog.current?.showModal()}>Use imported settings</Button>
    <dialog ref={dialog} aria-labelledby={title} aria-describedby={description} className={confirmationDialogClassName}
      onCancel={event => { if (dialog.current?.querySelector("fieldset:disabled")) event.preventDefault(); }}>
      <h2 id={title} className="mb-4 text-xl font-semibold">Use imported settings?</h2>
      <Form op="configuration-resolve" id={reviewId}>
        <input type="hidden" name="decision" value="profile" />
        <input type="hidden" name="confirmation" value="APPLY SNAPSHOT" />
        <p id={description} className="text-sm">This will replace the current shared settings with the imported settings from the existing database.</p>
        <ImportButtons close={() => dialog.current?.close()} />
      </Form>
    </dialog>
  </>;
}
