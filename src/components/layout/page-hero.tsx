import type { ElementType, HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export const pageHeroClassName =
  "rounded-[32px] border border-[#ece7df] bg-white/92 p-6 shadow-panel backdrop-blur dark:border-[#464c4f] dark:bg-[#383d40]/92 dark:shadow-[0_18px_40px_rgba(0,0,0,0.18)]";

type PageHeroProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  children: ReactNode;
};

export function PageHero({ as: Component = "section", children, className, ...props }: PageHeroProps) {
  return (
    <Component className={cn(pageHeroClassName, className)} {...props}>
      {children}
    </Component>
  );
}
