import Link from "next/link";
import { PageHero } from "@/components/layout/page-hero";
import { PanelCard } from "@/components/layout/panel-card";
import { managementPath } from "./control-store";
export function SetupOverview({
  registered,
  active,
}: {
  registered: boolean;
  active: boolean;
}) {
  return (
    <>
      <PageHero>
        <p className="text-sm font-semibold uppercase tracking-wider">
          Installation setup
        </p>
        <h1 className="mt-2 text-3xl font-semibold">
          {active ? "Your IT Assets installation" : "Welcome to IT Assets"}
        </h1>
        <p className="mt-3 max-w-3xl">
          Start locally, connect your database, then manage your assets.
          Microsoft SQL Server and MariaDB are supported.
        </p>
      </PageHero>
      <PanelCard>
        <h2 className="text-xl font-semibold">
          {active
            ? "An asset workspace is selected"
            : "No asset database connected"}
        </h2>
        <p className="mt-2">
          {active
            ? "Sign in with your workspace account to open the inventory. Database Management requires a separate installation administrator sign-in."
            : "Setup works without an external database. Assets, users and inventory settings become available after you activate a compatible database."}
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          <Link
            href={managementPath}
            prefetch={false}
            className="font-semibold underline"
          >
            {registered
              ? "Open Database Management"
              : "Enroll installation administrator"}
          </Link>
          {active && (
            <Link
              href="/login"
              prefetch={false}
              className="font-semibold underline"
            >
              Sign in to asset workspace
            </Link>
          )}
        </div>
      </PanelCard>
      <div className="grid gap-6 xl:grid-cols-2">
        <PanelCard>
          <h2 className="text-xl font-semibold">Your setup checklist</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5">
            <li>
              {registered
                ? "Installation administrator enrolled."
                : "Enroll with the one-time token stored privately on this server."}
            </li>
            <li>
              Sign in to Database Management with your installation account.
            </li>
            <li>
              Save a SQL Server or MariaDB connection; test connectivity and
              inspect its schema.
            </li>
            <li>
              For an empty database, explicitly initialize it and create a
              workspace administrator. For a compatible existing database, skip
              initialization.
            </li>
            <li>
              Activate the compatible connection, then sign in with a workspace
              account.
            </li>
          </ol>
        </PanelCard>
        <PanelCard>
          <h2 className="text-xl font-semibold">
            Two accounts, distinct responsibilities
          </h2>
          <p className="mt-3">
            The installation administrator manages connections and configuration
            stored locally. This identity does not grant access to inventory
            records.
          </p>
          <p className="mt-3">
            Workspace accounts and permissions belong to the selected asset
            database. Connecting an existing database preserves its users and
            records.
          </p>
          <p className="mt-3 text-sm">
            IT Assets is a self-hosted inventory application. Setup never
            imports, resets or upgrades an existing database automatically.
          </p>
        </PanelCard>
      </div>
    </>
  );
}
