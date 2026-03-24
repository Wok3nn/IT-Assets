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
        "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-70",
        variant === "primary" &&
          "bg-[#F69629] text-white hover:bg-[#e5871e] hover:shadow-[0_12px_24px_rgba(246,150,41,0.28)] dark:bg-[#F69629] dark:text-[#2F3437] dark:hover:bg-[#ffab4b]",
        variant === "secondary" &&
          "bg-white/88 text-slate-900 ring-1 ring-[#f3d2ae] hover:bg-[#fff5ea] hover:ring-[#F69629]/35 dark:bg-[#3a4043] dark:text-slate-100 dark:ring-[#4a5257] dark:hover:bg-[#464d50] dark:hover:ring-[#F69629]/35",
        variant === "ghost" &&
          "bg-transparent text-slate-700 hover:bg-[rgba(246,150,41,0.12)] hover:text-[#b56613] dark:text-slate-200 dark:hover:bg-[rgba(246,150,41,0.18)] dark:hover:text-[#ffd1a0]",
        className,
      )}
      {...props}
    />
  );
}

