"use client";

import { useActionState } from "react";

import { FieldLabel, FieldLabelText } from "@/components/forms/field-label";
import { SelectField } from "@/components/forms/select-field";
import { TextareaField } from "@/components/forms/textarea-field";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { GUEST_TYPE_OPTIONS } from "@/modules/users/guest-profile-options";

export type GuestProfileFormState = {
  values: {
    displayName: string;
    guestType: string;
    notes: string;
  };
  error: string | null;
};

type GuestProfileFormProps = {
  action: (state: GuestProfileFormState, formData: FormData) => Promise<GuestProfileFormState>;
  initialState: GuestProfileFormState;
  submitLabel: string;
};

export function GuestProfileForm({ action, initialState, submitLabel }: GuestProfileFormProps) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-[28px] border border-[#ece7df] bg-white/94 p-5 shadow-panel dark:border-[#4b5255] dark:bg-[#2f3437]">
      {state.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {state.error}
        </div>
      ) : null}

      <FieldLabel>
        <FieldLabelText>Display name</FieldLabelText>
        <TextField defaultValue={state.values.displayName} maxLength={120} name="displayName" required type="text" />
      </FieldLabel>

      <FieldLabel>
        <FieldLabelText>Guest type</FieldLabelText>
        <SelectField defaultValue={state.values.guestType || "Guest"} name="guestType" required>
          {GUEST_TYPE_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </SelectField>
      </FieldLabel>

      <FieldLabel>
        <FieldLabelText>Notes</FieldLabelText>
        <TextareaField defaultValue={state.values.notes} maxLength={2000} name="notes" placeholder="Optional internal notes" rows={4} />
      </FieldLabel>

      <Button className="w-full" type="submit">{submitLabel}</Button>
    </form>
  );
}
