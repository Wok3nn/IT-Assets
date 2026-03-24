import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

import { SelectField } from "@/components/forms/select-field";
import { TextField } from "@/components/forms/text-field";
import { TextareaField } from "@/components/forms/textarea-field";
import { cn } from "@/lib/utils";

export const adminFieldClassName =
  "focus:border-slate-400 dark:focus:border-slate-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-400";

export const adminColorPickerClassName =
  "color-picker h-10 w-10 cursor-pointer rounded-full border border-slate-200 bg-white p-1 disabled:cursor-not-allowed dark:border-[#4b5255] dark:bg-[#2f3437]";

export const AdminTextField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <TextField className={cn(adminFieldClassName, className)} ref={ref} {...props} />,
);

AdminTextField.displayName = "AdminTextField";

export const AdminSelectField = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <SelectField className={cn(adminFieldClassName, className)} ref={ref} {...props}>
      {children}
    </SelectField>
  ),
);

AdminSelectField.displayName = "AdminSelectField";

export const AdminTextareaField = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <TextareaField className={cn(adminFieldClassName, className)} ref={ref} {...props} />,
);

AdminTextareaField.displayName = "AdminTextareaField";
