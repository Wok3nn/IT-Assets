import Link from "next/link";
import { Button } from "@/components/ui/button";
import { databaseAction } from "./actions";
import { installationPath, managementPath } from "./control-store";

export function ManagementNavigation({
  authenticated = false,
  active = false,
}: {
  authenticated?: boolean;
  active?: boolean;
}) {
  if (!authenticated)
    return (
      <>
        <Link href={installationPath} prefetch={false}>
          Setup overview
        </Link>
        <Link href={managementPath} prefetch={false}>
          Database Management
        </Link>
        {active && (
          <Link href="/login" prefetch={false}>
            Back to IT Assets
          </Link>
        )}
      </>
    );
  return (
    <>
      <span aria-current="page" className="font-semibold">
        Database Management
      </span>
      <Exit destination="overview">Setup overview</Exit>
      <Exit destination={active ? "inventory" : "overview"}>
        Back to IT Assets
      </Exit>
      {active && <Exit destination="settings">Settings</Exit>}
      <form action={databaseAction}>
        <input type="hidden" name="op" value="logout" />
        <Button type="submit" variant="secondary">
          Sign out of Database Management
        </Button>
      </form>
    </>
  );
}
function Exit({
  destination,
  children,
}: {
  destination: string;
  children: React.ReactNode;
}) {
  return (
    <form action={databaseAction}>
      <input type="hidden" name="op" value="exit" />
      <input type="hidden" name="destination" value={destination} />
      <Button type="submit" variant="ghost">
        {children}
      </Button>
    </form>
  );
}
