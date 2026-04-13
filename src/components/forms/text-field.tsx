import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const textFieldClassName =
  "w-full rounded-2xl border border-slate-300/90 bg-white/98 px-4 py-3 text-sm text-slate-950 placeholder:text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] outline-none transition focus:border-[#F69629]/75 focus:ring-2 focus:ring-[#F69629]/20 dark:border-[#596166] dark:bg-[#2b3033] dark:text-slate-50 dark:placeholder:text-slate-400 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] dark:focus:border-[#ffb45b] dark:focus:ring-[#F69629]/24";

export const TextField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input className={cn(textFieldClassName, className)} ref={ref} {...props} />,
);

TextField.displayName = "TextField";
