import { FieldLabel, FieldLabelText } from "@/components/forms/field-label";
import { InsetCard } from "@/components/layout/inset-card";

import { AdminSelectField, adminColorPickerClassName } from "./admin-fields";

type ColorStyleFieldsProps = {
  defaultColorHex?: string | null;
  defaultColorMode?: string | null;
  disabled?: boolean;
  helperText: string;
  title?: string;
};

export function ColorStyleFields({
  defaultColorHex,
  defaultColorMode,
  disabled = false,
  helperText,
  title = "Color styling",
}: ColorStyleFieldsProps) {
  return (
    <InsetCard>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{title}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{helperText}</p>
        </div>
        <input
          className={adminColorPickerClassName}
          defaultValue={defaultColorHex ?? "#2563EB"}
          disabled={disabled}
          name="colorHex"
          type="color"
        />
      </div>

      <FieldLabel className="mt-4">
        <FieldLabelText>Style</FieldLabelText>
        <AdminSelectField defaultValue={defaultColorMode ?? "border"} disabled={disabled} name="colorMode">
          <option value="border">Color border</option>
          <option value="fill">Soft fill</option>
          <option value="none">No color styling</option>
        </AdminSelectField>
      </FieldLabel>
    </InsetCard>
  );
}
