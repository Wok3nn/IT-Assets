"use client";
import { useId, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { confirmationDialogClassName } from "./confirmation-dialog.styles";
import { Form } from "./action-form";
import { Field } from "./field";
import { DatabaseSummary } from "./database-summary";
import type { PublicProfile } from "./control-store";

function ConfirmationButtons({ close }: { close: () => void }) {
  const { pending } = useFormStatus();
  return <div className="flex flex-wrap items-center justify-end gap-3">
    <Button className="min-h-10" type="button" variant="secondary" disabled={pending} onClick={close}>Cancel</Button>
    <Button className="min-h-10" type="submit" disabled={pending}>Confirm activation</Button>
  </div>;
}

export function ActivationDialog({ profile, revision }: { profile: PublicProfile; revision: number }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  return <>
    <Button className="min-h-10" type="button" onClick={() => dialog.current?.showModal()}>Activate Database</Button>
    <dialog ref={dialog} aria-labelledby={title}
      className={confirmationDialogClassName}
      onCancel={(event) => { if (dialog.current?.querySelector("fieldset:disabled")) event.preventDefault(); }}>
      <h2 id={title} className="mb-4 text-xl font-semibold">Activate Database</h2>
      <Form op="activate" id={profile.id} version={profile.version} revision={revision} step="4">
        <DatabaseSummary profile={profile} active={false} />
        <p className="text-sm">Current workspace sessions end. Accounts and records are preserved. Compatibility is checked again before switching; readiness is verified after the supervisor restarts.</p>
        <Field name="confirm" label={`Type ${profile.database} to confirm activation`} autoFocus autoComplete="off" />
        <ConfirmationButtons close={() => dialog.current?.close()} />
      </Form>
    </dialog>
  </>;
}
