import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHero } from "@/components/layout/page-hero";
import { PanelCard } from "@/components/layout/panel-card";
import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUserPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { listGuestProfiles, type GuestStatusFilter } from "@/modules/users/guest-profile.service";
import { UsersSectionNav } from "@/modules/users/components/users-section-nav";
import { readSetupState } from "@/services/setup-state";

export const dynamic = "force-dynamic";

type GuestProfilesPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
  }>;
};

function parseGuestStatus(value?: string): GuestStatusFilter {
  return value === "archived" || value === "all" ? value : "active";
}

export default async function GuestProfilesPage({ searchParams }: GuestProfilesPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const q = params?.q?.trim() ?? "";
  const status = parseGuestStatus(params?.status);

  const [setupState, currentUser, permissionContext] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    getCurrentUserPermissionContext(),
  ]);

  if (!setupState?.isCompleted) redirect("/setup");
  if (!currentUser) redirect("/login");
  if (!permissionContext.capabilities.viewUsers) redirect("/dashboard");

  const guestProfiles = await listGuestProfiles({ q, status });
  const canEditGuests = permissionContext.capabilities.editUsers;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Users</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">Guest profiles</h1>
              <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">Track outside people who may temporarily receive assets. Guest profiles are not application users.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {canEditGuests ? (
                <Link href="/users/guests/new">
                  <Button type="button">New Guest Profile</Button>
                </Link>
              ) : null}
            </div>
          </div>
        </PageHero>

        <UsersSectionNav active="guest-profiles" />

        <PanelCard className="p-5">
          <form action="/users/guests" className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#F69629]/70 dark:border-[#4b5255] dark:bg-[#34393c] dark:text-slate-100"
              defaultValue={q}
              name="q"
              placeholder="Search display name or Guest type"
              type="search"
            />
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#F69629]/70 dark:border-[#4b5255] dark:bg-[#34393c] dark:text-slate-100"
              defaultValue={status}
              name="status"
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="all">All</option>
            </select>
            <div className="flex gap-2">
              <Button type="submit">Apply</Button>
              <Link href="/users/guests"><Button type="button" variant="ghost">Reset</Button></Link>
            </div>
          </form>

          <div className="mt-5 overflow-hidden rounded-[28px] border border-[#ece7df] dark:border-[#4b5255]">
            {guestProfiles.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No Guest Profiles matched the current filters.</div>
            ) : (
              <table className="min-w-[760px] w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
                <thead className="bg-[#f8f9fb] dark:bg-[#34393c]">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Guest Profile</th>
                    <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Type</th>
                    <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Status</th>
                    <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Assets</th>
                    <th className="px-4 py-2.5 text-right font-medium text-slate-500 dark:text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white/96 dark:divide-slate-800 dark:bg-[#34393c]">
                  {guestProfiles.map((guestProfile) => (
                    <tr key={guestProfile.id}>
                      <td className="px-4 py-3">
                        <Link className="font-medium text-slate-950 underline-offset-4 transition hover:text-[#b56613] hover:underline dark:text-slate-100 dark:hover:text-[#ffd1a0]" href={`/users/guests/${guestProfile.id}`}>
                          {guestProfile.displayName}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{guestProfile.guestType}</td>
                      <td className="px-3 py-3">
                        <span className={guestProfile.isActive ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"}>
                          {guestProfile.isActive ? "Active" : "Archived"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{guestProfile._count.assignedAssets} assigned</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Link href={`/users/guests/${guestProfile.id}`}><Button className="px-3 py-1.5 text-xs" type="button" variant="secondary">View</Button></Link>
                          {canEditGuests ? <Link href={`/users/guests/${guestProfile.id}/edit`}><Button className="px-3 py-1.5 text-xs" type="button" variant="secondary">Edit</Button></Link> : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </PanelCard>
      </div>
    </AppShell>
  );
}
