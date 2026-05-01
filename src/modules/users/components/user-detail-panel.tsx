import Link from "next/link";
import type { ReactNode } from "react";

import { PageHero } from "@/components/layout/page-hero";
import { PanelCard } from "@/components/layout/panel-card";
import { Button } from "@/components/ui/button";
import { AssetStatusPill } from "@/modules/assets/asset-status-pill";
import { buildAssetHref } from "@/modules/assets/assets-routing";
import { buildUserEditHref, USERS_DIRECTORY_HREF } from "@/modules/users/users-routing";

import { ScopeBadges } from "./scope-badges";
import { UserAssetUnassignButton } from "./user-asset-unassign-button";

type DetailUser = {
  id: string;
  name: string;
  email: string;
  canLogin: boolean;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  _count: {
    assets: number;
    auditEntries: number;
    sessions: number;
  };
  userRoles: Array<{ role: { key: string; name: string } }>;
  userScopes: Array<{ scope: { id: string; name: string; colorHex: string | null; colorMode: string | null } }>;
};

type AssignedAsset = {
  id: string;
  name: string;
  make: string | null;
  model: string | null;
  assetTag: string;
  category: { name: string } | null;
  status: { name: string; color: string | null } | null;
  assignedLocation: { name: string } | null;
};

function formatDateTimeLabel(value?: Date | null) {
  return value ? value.toLocaleString() : "Not recorded";
}

function getAssetDisplayName(asset: AssignedAsset) {
  return asset.model?.trim() || asset.name.trim() || asset.assetTag;
}

function ProfileField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-[#ece7df] bg-[#f8f9fb] p-4 dark:border-[#4b5255] dark:bg-[#34393c]">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-2 text-sm font-medium text-slate-950 dark:text-slate-100">{children}</div>
    </div>
  );
}

function FeedbackBanner({ message, tone }: { message: string; tone: "success" | "error" }) {
  const className = tone === "success"
    ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
    : "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200";

  return <div className={className}>{message}</div>;
}

export function UserDetailPanel({
  assignedAssets,
  canEditUser,
  canUnassignAssets,
  canViewAssets,
  feedback,
  unassignAction,
  user,
}: {
  assignedAssets: AssignedAsset[];
  canEditUser: boolean;
  canUnassignAssets: boolean;
  canViewAssets: boolean;
  feedback?: { message: string; tone: "success" | "error" } | null;
  unassignAction: (formData: FormData) => void | Promise<void>;
  user: DetailUser;
}) {
  const primaryRole = user.userRoles[0]?.role.name ?? "Unassigned";
  const loginLabel = user.canLogin ? "Login enabled" : "No login";

  return (
    <div className="space-y-6">
      <PageHero>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Users</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">{user.name}</h1>
            <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
              View this user profile and the assets currently assigned to them.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {canEditUser ? (
              <Link href={buildUserEditHref(user.id, USERS_DIRECTORY_HREF)}>
                <Button type="button" variant="secondary">Edit user</Button>
              </Link>
            ) : null}
            <Link href={USERS_DIRECTORY_HREF}>
              <Button type="button" variant="ghost">Back to users</Button>
            </Link>
          </div>
        </div>
      </PageHero>

      {feedback ? <FeedbackBanner message={feedback.message} tone={feedback.tone} /> : null}

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <PanelCard className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Profile</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950 dark:text-slate-100">User details</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className={user.isActive ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"}>
                {user.isActive ? "Active" : "Inactive"}
              </span>
              <span className={user.canLogin ? "rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" : "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"}>
                {loginLabel}
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <ProfileField label="Role">{primaryRole}</ProfileField>
            <ProfileField label="Assigned assets">{user._count.assets}</ProfileField>
            <ProfileField label="Created">{formatDateTimeLabel(user.createdAt)}</ProfileField>
            <ProfileField label="Last login">{formatDateTimeLabel(user.lastLoginAt)}</ProfileField>
          </div>

          <div className="mt-5 rounded-3xl border border-[#ece7df] bg-[#f8f9fb] p-4 dark:border-[#4b5255] dark:bg-[#34393c]">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Departments</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <ScopeBadges scopes={user.userScopes.map(({ scope }) => scope)} />
            </div>
          </div>
        </PanelCard>

        <PanelCard className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Assigned assets</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950 dark:text-slate-100">Current assignments</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {canViewAssets ? `${assignedAssets.length} asset${assignedAssets.length === 1 ? "" : "s"} visible for this user.` : "Asset viewing is not available for this role."}
              </p>
            </div>
            {canViewAssets ? (
              <Link href={`/assets?userId=${encodeURIComponent(user.id)}`}>
                <Button type="button" variant="secondary">Open asset filter</Button>
              </Link>
            ) : null}
          </div>

          {!canViewAssets ? (
            <div className="mt-5 rounded-3xl border border-dashed border-[#ece7df] bg-[#f8f9fb] px-5 py-8 text-center text-sm text-slate-500 dark:border-[#4b5255] dark:bg-[#34393c] dark:text-slate-400">
              You can view this user, but asset details require asset access.
            </div>
          ) : assignedAssets.length === 0 ? (
            <div className="mt-5 rounded-3xl border border-dashed border-[#ece7df] bg-[#f8f9fb] px-5 py-8 text-center text-sm text-slate-500 dark:border-[#4b5255] dark:bg-[#34393c] dark:text-slate-400">
              No assets are currently assigned to this user.
            </div>
          ) : (
            <div className="mt-5 overflow-hidden rounded-[28px] border border-[#ece7df] dark:border-[#4b5255]">
              <div className="w-full overflow-x-auto">
                <table className="min-w-[820px] w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
                  <thead className="bg-[#f8f9fb] dark:bg-[#34393c]">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Asset</th>
                      <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Category</th>
                      <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Status</th>
                      <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Location</th>
                      <th className="px-4 py-2.5 text-right font-medium text-slate-500 dark:text-slate-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white/96 dark:divide-slate-800 dark:bg-[#34393c]">
                    {assignedAssets.map((asset) => {
                      const assetLabel = asset.assetTag || getAssetDisplayName(asset);

                      return (
                        <tr key={asset.id} className="align-middle">
                          <td className="px-4 py-3">
                            <Link className="font-semibold text-[#b56613] underline-offset-4 transition hover:underline dark:text-[#ffd7ab]" href={buildAssetHref(asset.id)}>
                              {asset.assetTag}
                            </Link>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{getAssetDisplayName(asset)}</p>
                          </td>
                          <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{asset.category?.name ?? "Unassigned"}</td>
                          <td className="px-3 py-3">{asset.status ? <AssetStatusPill color={asset.status.color} label={asset.status.name} /> : <span className="text-slate-500 dark:text-slate-400">No status</span>}</td>
                          <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{asset.assignedLocation?.name ?? "Unassigned"}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end">
                              {canUnassignAssets ? (
                                <UserAssetUnassignButton
                                  action={unassignAction}
                                  assetId={asset.id}
                                  assetLabel={assetLabel}
                                  userId={user.id}
                                  userName={user.name}
                                />
                              ) : (
                                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300">View only</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </PanelCard>
      </div>
    </div>
  );
}
