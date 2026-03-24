import type { HTMLAttributes, LabelHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const fieldLabelClassName = "text-sm font-medium text-slate-700 dark:text-slate-200";

export function FieldLabel({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block space-y-2", className)} {...props} />;
}

export function FieldLabelText({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn(fieldLabelClassName, className)} {...props} />;
}
