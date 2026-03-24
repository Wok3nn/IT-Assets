import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const textFieldClassName =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#F69629]/70 dark:border-[#4b5255] dark:bg-[#2f3437] dark:text-slate-100 dark:focus:border-[#F69629]/70";

export const TextField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input className={cn(textFieldClassName, className)} ref={ref} {...props} />,
);

TextField.displayName = "TextField";
