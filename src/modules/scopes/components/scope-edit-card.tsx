import Link from "next/link";

import { AdminTextField, AdminTextareaField } from "@/components/admin/admin-fields";
import { ColorStyleFields } from "@/components/admin/color-style-fields";
import { FieldLabel, FieldLabelText } from "@/components/forms/field-label";
import { InsetCard } from "@/components/layout/inset-card";
import { PanelCard } from "@/components/layout/panel-card";
import { Button } from "@/components/ui/button";

export function ScopeEditCard({
  action,
  cancelHref,
  defaultColorHex,
  defaultColorMode,
  defaultDescription,
  defaultName,
  isSystem,
  returnTo,
  scopeId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  cancelHref: string;
  defaultColorHex?: string | null;
  defaultColorMode?: string | null;
  defaultDescription?: string | null;
  defaultName: string;
  isSystem: boolean;
  returnTo: string;
  scopeId: string;
}) {
  return (
    <PanelCard>
      <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Edit department</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Update this department without mixing the form back into the main listing.
      </p>

      {isSystem ? (
        <InsetCard className="mt-5 border-emerald-200/80 bg-emerald-50/90 dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <p className="text-sm text-emerald-800 dark:text-emerald-200">
            System departments are fixed and cannot be edited.
          </p>
        </InsetCard>
      ) : null}

      <form action={action} className="mt-5 space-y-4">
        <input name="scopeId" type="hidden" value={scopeId} />
        <input name="returnTo" type="hidden" value={returnTo} />

        <FieldLabel>
          <FieldLabelText>Name</FieldLabelText>
          <AdminTextField
            defaultValue={defaultName}
            disabled={isSystem}
            maxLength={80}
            minLength={2}
            name="name"
            required
            type="text"
          />
        </FieldLabel>

        <FieldLabel>
          <FieldLabelText>Description</FieldLabelText>
          <AdminTextareaField
            defaultValue={defaultDescription ?? ""}
            disabled={isSystem}
            maxLength={240}
            name="description"
            rows={4}
          />
        </FieldLabel>

        <ColorStyleFields
          defaultColorHex={defaultColorHex}
          defaultColorMode={defaultColorMode}
          disabled={isSystem}
          helperText="Border or soft fill."
        />

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link href={cancelHref}>
            <Button type="button" variant="ghost">
              Back
            </Button>
          </Link>
          <Button disabled={isSystem} type="submit">
            Save department
          </Button>
        </div>
      </form>
    </PanelCard>
  );
}
