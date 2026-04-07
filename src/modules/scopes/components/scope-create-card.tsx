import Link from "next/link";

import { AdminTextField, AdminTextareaField } from "@/components/admin/admin-fields";
import { ColorStyleFields } from "@/components/admin/color-style-fields";
import { FieldLabel, FieldLabelText } from "@/components/forms/field-label";
import { PanelCard } from "@/components/layout/panel-card";
import { Button } from "@/components/ui/button";

export function ScopeCreateCard({
  action,
  cancelHref,
}: {
  action: (formData: FormData) => void | Promise<void>;
  cancelHref: string;
}) {
  return (
    <PanelCard>
      <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">New department</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Create a department record for user and asset visibility management.</p>

      <form action={action} className="mt-5 space-y-4">
        <FieldLabel>
          <FieldLabelText>Name</FieldLabelText>
          <AdminTextField maxLength={80} minLength={2} name="name" placeholder="IT" required type="text" />
        </FieldLabel>

        <FieldLabel>
          <FieldLabelText>Description</FieldLabelText>
          <AdminTextareaField
            maxLength={240}
            name="description"
            placeholder="Assets for the internal IT team."
            rows={4}
          />
        </FieldLabel>

        <ColorStyleFields defaultColorMode="border" defaultColorHex="#2563EB" helperText="Border or soft fill." />

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link href={cancelHref}><Button type="button" variant="ghost">Cancel</Button></Link>
          <Button type="submit">Create department</Button>
        </div>
      </form>
    </PanelCard>
  );
}
