import Link from "next/link";

import { PageHero } from "@/components/layout/page-hero";
import { PanelCard } from "@/components/layout/panel-card";
import { Button } from "@/components/ui/button";

export function SettingsPlaceholderPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-6">
      <PageHero>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Settings</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950 dark:text-slate-100">{title}</h1>
            <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">{description}</p>
          </div>
          <Link href="/settings"><Button type="button" variant="ghost">Back to settings</Button></Link>
        </div>
      </PageHero>

      <PanelCard>
        <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Planned section</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          This settings area has a stable destination now, but the detailed controls are still staged.
        </p>
      </PanelCard>
    </div>
  );
}
