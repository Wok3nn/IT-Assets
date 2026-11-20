import type { InputHTMLAttributes } from "react";
import { TextField } from "@/components/forms/text-field";
import { SettingsHelp } from "./settings-section";
import { FieldError } from "./action-form";

export function Field({ name, label, help, type = "text", value, required = true, ...props }: {
  name: string;
  label: string;
  help?: string;
  value?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "value">) {
  return (
    <div className="min-w-0 text-sm"><label className="flex min-w-0 flex-col gap-1">
      <span>{label}{required && <span aria-hidden="true"> *</span>}</span>
      <TextField
        {...props}
        type={type}
        name={name}
        defaultValue={value}
        required={required}
        autoComplete={type === "password" ? "off" : props.autoComplete}
      />
      </label>
      {help && (help.length > 80 ? <SettingsHelp label={`Help with ${label.toLowerCase()}`}>{help}</SettingsHelp> : <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{help}</p>)}
      <FieldError name={name} />
    </div>
  );
}
