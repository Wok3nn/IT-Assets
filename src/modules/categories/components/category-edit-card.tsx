import Link from "next/link";

import { AdminSelectField, AdminTextField } from "@/components/admin/admin-fields";
import { ColorStyleFields } from "@/components/admin/color-style-fields";
import { FieldLabel, FieldLabelText } from "@/components/forms/field-label";
import { PanelCard } from "@/components/layout/panel-card";
import { Button } from "@/components/ui/button";

type LabelTemplateOption = {
  id: string;
  name: string;
};

export function CategoryEditCard({
  action,
  cancelHref,
  categoryId,
  defaultColorHex,
  defaultColorMode,
  defaultLabelTemplateId,
  defaultName,
  labelTemplateOptions,
  returnTo,
}: {
  action: (formData: FormData) => void | Promise<void>;
  cancelHref: string;
  categoryId: string;
  defaultColorHex?: string | null;
  defaultColorMode?: string | null;
  defaultLabelTemplateId?: string | null;
  defaultName: string;
  labelTemplateOptions: LabelTemplateOption[];
  returnTo: string;
}) {
  return (
    <PanelCard>
      <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Edit category</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Update this category without interrupting the main browse view.
      </p>

      <form action={action} className="mt-5 space-y-4">
        <input name="categoryId" type="hidden" value={categoryId} />
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
          <FieldLabelText>Default label template</FieldLabelText>
          <AdminSelectField defaultValue={defaultLabelTemplateId ?? ""} name="defaultLabelTemplateId">
            <option value="">No default template</option>
            {labelTemplateOptions.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </AdminSelectField>
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
          <Button type="submit">Save category</Button>
        </div>
      </form>
    </PanelCard>
  );
}
