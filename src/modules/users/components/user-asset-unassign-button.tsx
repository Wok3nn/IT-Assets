"use client";

import { useRef, type MouseEvent } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

function SubmitButton({ assetLabel, onConfirm }: { assetLabel: string; onConfirm: (event: MouseEvent<HTMLButtonElement>) => void }) {
  const { pending } = useFormStatus();

  return (
    <Button
      className="px-3 py-1.5 text-xs hover:bg-red-600 hover:text-white hover:ring-red-600 dark:hover:bg-red-500"
      disabled={pending}
      onClick={onConfirm}
      type="submit"
      variant="secondary"
    >
      {pending ? "Unassigning..." : `Unassign ${assetLabel}`}
    </Button>
  );
}

export function UserAssetUnassignButton({
  action,
  assetId,
  assetLabel,
  userId,
  userName,
}: {
  action: (formData: FormData) => void | Promise<void>;
  assetId: string;
  assetLabel: string;
  userId: string;
  userName: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form action={action} ref={formRef}>
      <input name="assetId" type="hidden" value={assetId} />
      <input name="userId" type="hidden" value={userId} />
      <SubmitButton
        assetLabel={assetLabel}
        onConfirm={(event) => {
          event.preventDefault();
          event.stopPropagation();

          if (window.confirm(`Unassign ${assetLabel} from ${userName}?`)) {
            formRef.current?.requestSubmit();
          }
        }}
      />
    </form>
  );
}
