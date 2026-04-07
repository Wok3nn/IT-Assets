import Link from "next/link";

import { AdminSelectField, AdminTextField, AdminTextareaField } from "@/components/admin/admin-fields";
import { ColorStyleFields } from "@/components/admin/color-style-fields";
import { FieldLabel, FieldLabelText } from "@/components/forms/field-label";
import { PanelCard } from "@/components/layout/panel-card";
import { Button } from "@/components/ui/button";

import { buildLocationTreeLabel } from "../location-tree";

type LocationParentOption = {
  id: string;
  name: string;
  parentId: string | null;
};

export function LocationCreateCard({
  action,
  cancelHref,
  parentOptions,
  defaultParentId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  cancelHref: string;
  parentOptions: LocationParentOption[];
  defaultParentId: string;
}) {
  return (
    <PanelCard>
      <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">New location</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Create a parent location or place a child location under an existing branch.</p>

      <form action={action} className="mt-5 space-y-4">
        <FieldLabel>
          <FieldLabelText>Parent location</FieldLabelText>
          <AdminSelectField defaultValue={defaultParentId} name="parentId">
            <option value="">Top-level location</option>
            {parentOptions.map((location) => (
              <option key={location.id} value={location.id}>
                {buildLocationTreeLabel(parentOptions, location.id) ?? location.name}
              </option>
            ))}
          </AdminSelectField>
        </FieldLabel>

        <FieldLabel>
          <FieldLabelText>Name</FieldLabelText>
          <AdminTextField
            maxLength={80}
            minLength={2}
            name="name"
            placeholder={defaultParentId ? "3rd Row" : "Garage"}
            required
            type="text"
          />
        </FieldLabel>

        <FieldLabel>
          <FieldLabelText>Description</FieldLabelText>
          <AdminTextareaField
            maxLength={240}
            name="description"
            placeholder="Storage area for spare networking equipment."
            rows={4}
          />
        </FieldLabel>

        <ColorStyleFields defaultColorMode="border" defaultColorHex="#2563EB" helperText="Border or soft fill." />

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link href={cancelHref}><Button type="button" variant="ghost">Cancel</Button></Link>
          <Button type="submit">Create location</Button>
        </div>
      </form>
    </PanelCard>
  );
}
