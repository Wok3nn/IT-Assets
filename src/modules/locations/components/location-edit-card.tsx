import Link from "next/link";

import { AdminTextField, AdminTextareaField } from "@/components/admin/admin-fields";
import { ColorStyleFields } from "@/components/admin/color-style-fields";
import { FieldLabel, FieldLabelText } from "@/components/forms/field-label";
import { PanelCard } from "@/components/layout/panel-card";
import { Button } from "@/components/ui/button";

export function LocationEditCard({
  action,
  cancelHref,
  defaultColorHex,
  defaultColorMode,
  defaultDescription,
  defaultName,
  locationId,
  returnTo,
}: {
  action: (formData: FormData) => void | Promise<void>;
  cancelHref: string;
  defaultColorHex?: string | null;
  defaultColorMode?: string | null;
  defaultDescription?: string | null;
  defaultName: string;
  locationId: string;
  returnTo: string;
}) {
  return (
    <PanelCard>
      <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Edit location</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Update this location on its own page so branch browsing stays focused.
      </p>

      <form action={action} className="mt-5 space-y-4">
        <input name="locationId" type="hidden" value={locationId} />
        <input name="returnTo" type="hidden" value={returnTo} />

        <FieldLabel>
          <FieldLabelText>Name</FieldLabelText>
          <AdminTextField
            defaultValue={defaultName}
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
            maxLength={240}
            name="description"
            rows={4}
          />
        </FieldLabel>

        <ColorStyleFields
          defaultColorHex={defaultColorHex}
          defaultColorMode={defaultColorMode}
          helperText="Border or soft fill."
        />

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link href={cancelHref}>
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </Link>
          <Button type="submit">Save location</Button>
        </div>
      </form>
    </PanelCard>
  );
}
