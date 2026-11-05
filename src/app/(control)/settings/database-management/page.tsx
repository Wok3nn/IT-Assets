import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/layout/page-hero";
import {
  control,
  controlCookie,
  managed,
} from "@/modules/database-management/control-store";
import {
  ControlLogin,
  DatabasePanel,
} from "@/modules/database-management/panel";
export const dynamic = "force-dynamic";
export default async function DatabaseManagement({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  if (!managed()) notFound();
  const store = control(),
    authorized = store.authorized(
      (await cookies()).get(controlCookie)?.value ?? "",
    );
  const { message } = await searchParams;
  return (
    <main className="mx-auto max-w-4xl space-y-5 p-6">
      <PageHero>
        <h1 className="text-3xl font-semibold">Database Management</h1>
        <p className="mt-2">
          Manage this installation independently of its asset database.
        </p>
      </PageHero>
      {message && <p role="status">{message}</p>}
      {authorized ? (
        <DatabasePanel
          {...store.state()}
          profiles={store.profiles()}
          activity={store.activity()}
        />
      ) : (
        <ControlLogin registered={store.registered()} />
      )}
    </main>
  );
}
