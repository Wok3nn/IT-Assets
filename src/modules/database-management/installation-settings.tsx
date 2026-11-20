import { ConfigurationReviewPanel } from "./configuration-review-panel";
import { InstallationPresentationPanel } from "./installation-presentation-panel";
import { InstallationEntraPanel } from "./installation-entra-panel";
import { InstallationMailTimezonePanel } from "./installation-mail-timezone-panel";

export function InstallationSettings() {
  return <div className="min-w-0 space-y-4">
    <ConfigurationReviewPanel />
    <InstallationPresentationPanel />
    <InstallationEntraPanel />
    <InstallationMailTimezonePanel />
  </div>;
}

export function ExistingDatabaseSettings({ open }: { open: boolean }) {
  return <details id="existing-database-settings" open={open} className="scroll-mt-6">
    <summary className="min-h-11 cursor-pointer py-3 text-xl font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500">Existing database settings</summary>
    <p className="mb-4 text-sm">Review imported settings or manage this installation, even while the database is offline.</p>
    <InstallationSettings />
  </details>;
}
