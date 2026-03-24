import type { ElementType, HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export const insetCardClassName =
  "rounded-3xl border border-[#ece7df] bg-[#f8f9fb] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-[#4b5255] dark:bg-[#34393c] dark:shadow-[0_14px_28px_rgba(0,0,0,0.18)]";

type InsetCardProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  children: ReactNode;
};

export function InsetCard({ as: Component = "div", children, className, ...props }: InsetCardProps) {
  return (
    <Component className={cn(insetCardClassName, className)} {...props}>
      {children}
    </Component>
  );
}
