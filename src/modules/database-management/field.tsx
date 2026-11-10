import type { InputHTMLAttributes } from "react";
import { TextField } from "@/components/forms/text-field";
import { FieldError } from "./action-form";

export function Field({ name, label, help, type = "text", value, required = true, ...props }: {
  name: string;
  label: string;
  help?: string;
  value?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "value">) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm">
      <span>{label}{required && <span aria-hidden="true"> *</span>}</span>
      <TextField
        {...props}
        type={type}
        name={name}
        defaultValue={value}
        required={required}
        autoComplete={type === "password" ? "off" : props.autoComplete}
      />
      {help && <span className="text-xs text-slate-600 dark:text-slate-300">{help}</span>}
      <FieldError name={name} />
    </label>
  );
}
