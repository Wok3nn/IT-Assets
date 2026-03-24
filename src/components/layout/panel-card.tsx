import type { ElementType, HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export const panelCardClassName =
  "rounded-3xl border border-[#ece7df] bg-white/92 p-5 shadow-panel backdrop-blur dark:border-[#4b5255] dark:bg-[#34393c]/92 dark:shadow-[0_18px_40px_rgba(0,0,0,0.16)]";

type PanelCardProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  children: ReactNode;
};

export function PanelCard({ as: Component = "section", children, className, ...props }: PanelCardProps) {
  return (
    <Component className={cn(panelCardClassName, className)} {...props}>
      {children}
    </Component>
  );
}
