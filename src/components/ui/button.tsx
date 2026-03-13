import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition",
        variant === "primary" &&
          "bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900",
        variant === "secondary" &&
          "bg-white/80 text-slate-900 ring-1 ring-slate-200 hover:bg-white",
        variant === "ghost" &&
          "bg-transparent text-slate-700 hover:bg-slate-100",
        className,
      )}
      {...props}
    />
  );
}
