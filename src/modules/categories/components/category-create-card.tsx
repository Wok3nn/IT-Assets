import Link from "next/link";

import { AdminSelectField, AdminTextField } from "@/components/admin/admin-fields";
import { ColorStyleFields } from "@/components/admin/color-style-fields";
import { FieldLabel, FieldLabelText } from "@/components/forms/field-label";
import { PanelCard } from "@/components/layout/panel-card";
import { Button } from "@/components/ui/button";

import { buildCategoryTreeLabel } from "../category-tree";

type CategoryParentOption = {
  id: string;
  name: string;
  parentId: string | null;
};

type LabelTemplateOption = {
  id: string;
  name: string;
};

export function CategoryCreateCard({
  action,
  cancelHref,
  defaultLabelTemplateId,
  defaultParentId,
  labelTemplateOptions,
  parentOptions,
}: {
  action: (formData: FormData) => void | Promise<void>;
  cancelHref: string;
  defaultLabelTemplateId?: string;
  defaultParentId: string;
  labelTemplateOptions: LabelTemplateOption[];
  parentOptions: CategoryParentOption[];
}) {
  return (
    <PanelCard>
      <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">New category</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Create a parent category or place a child category under an existing branch.</p>

      <form action={action} className="mt-5 space-y-4">
        <FieldLabel>
          <FieldLabelText>Parent category</FieldLabelText>
          <AdminSelectField defaultValue={defaultParentId} name="parentId">
            <option value="">Top-level category</option>
            {parentOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {buildCategoryTreeLabel(parentOptions, category.id) ?? category.name}
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
            placeholder={defaultParentId ? "Ultrabooks" : "Laptops"}
            required
            type="text"
          />
        </FieldLabel>

        <FieldLabel>
          <FieldLabelText>Default label template</FieldLabelText>
          <AdminSelectField defaultValue={defaultLabelTemplateId ?? ""} name="defaultLabelTemplateId">
            <option value="">No default template</option>
            {labelTemplateOptions.map((template) => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </AdminSelectField>
        </FieldLabel>

        <ColorStyleFields defaultColorMode="border" defaultColorHex="#2563EB" helperText="Border or soft fill." />

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link href={cancelHref}><Button type="button" variant="ghost">Cancel</Button></Link>
          <Button type="submit">Create category</Button>
        </div>
      </form>
    </PanelCard>
  );
}
