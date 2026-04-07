"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { ResetOverview } from "@/modules/settings/reset-management.service";

type ResetManagementPanelProps = {
  overview: ResetOverview;
};

type ResetActionCardConfig = {
  key: "assets" | "users" | "categories" | "departments" | "label-templates" | "locations" | "full-app";
  title: string;
  count: number;
  description: string;
  warning: string;
  impact: string;
  actionLabel: string;
  confirmLabel: string;
  confirmationPhrase?: string;
  requiresTypedConfirmation?: boolean;
  shouldRedirectToLogin?: boolean;
};

type ResetResult = {
  tone: "success" | "error";
  message: string;
};

const destructiveButtonClassName = "min-h-10 min-w-[10.75rem] text-sm bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-500 dark:text-white dark:hover:bg-rose-400";
const destructiveWideButtonClassName = `${destructiveButtonClassName} w-full`;
const resetCardClassName = "rounded-[24px] border border-rose-200/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,241,242,0.82)_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-[#59464b] dark:bg-[linear-gradient(180deg,rgba(57,62,66,0.98)_0%,rgba(49,53,57,0.96)_100%)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]";
const destructiveInfoPanelClassName = "rounded-lg border border-rose-200/70 bg-white/80 px-3 py-2 dark:border-[#51484b] dark:bg-[#2d3134]";
const mutedDarkPanelClassName = "rounded-2xl border border-[#4f4347] bg-[#312c2f] px-4 py-3 text-sm text-slate-200";
const recordBadgeClassName = "inline-flex select-none items-center rounded-full border border-rose-200/80 bg-rose-100/85 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-700 dark:border-[#72545b] dark:bg-[rgba(92,46,56,0.38)] dark:text-rose-100";

function ResetRecordBadge({ label }: { label: string }) {
  return <span className={recordBadgeClassName}>{label}</span>;
}

function ResetActionCard({
  action,
  onOpen,
}: {
  action: ResetActionCardConfig;
  onOpen: (key: ResetActionCardConfig["key"]) => void;
}) {
  return (
    <div className={resetCardClassName}>
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-slate-950 dark:text-slate-100">{action.title}</h3>
            <p className="mt-1.5 text-[13px] leading-5 text-slate-600 dark:text-slate-400">{action.description}</p>
          </div>
          <ResetRecordBadge label={formatCountLabel(action.count, "record")} />
        </div>

        <div className={destructiveInfoPanelClassName}>
          <div className="flex items-start gap-2.5">
            <p className="shrink-0 pt-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-700 dark:text-rose-200">Impact</p>
            <p className="text-[13px] leading-5 text-slate-600 dark:text-slate-400">{action.impact}</p>
          </div>
        </div>

        <div className="mt-auto flex justify-start pt-0.5">
          <Button
            className={destructiveButtonClassName}
            onClick={() => onOpen(action.key)}
            type="button"
          >
            {action.actionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatCountLabel(count: number, singular: string, plural = singular + "s") {
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildSuccessMessage(key: ResetActionCardConfig["key"], summary: Record<string, number>) {
  switch (key) {
    case "assets":
      return `Reset ${summary.assetCount} asset record${summary.assetCount === 1 ? "" : "s"}. Removed ${summary.detachedAssetScopeCount} asset-to-department link${summary.detachedAssetScopeCount === 1 ? "" : "s"}.`;
    case "users":
      return `Reset ${summary.userCount} user record${summary.userCount === 1 ? "" : "s"}. Cleared ${summary.clearedAssetAssignmentCount} asset assignment${summary.clearedAssetAssignmentCount === 1 ? "" : "s"} and detached ${summary.detachedAuditEntryCount} audit actor reference${summary.detachedAuditEntryCount === 1 ? "" : "s"}.`;
    case "categories":
      return `Reset ${summary.categoryCount} categor${summary.categoryCount === 1 ? "y" : "ies"}. Cleared ${summary.clearedAssetCategoryCount} asset category assignment${summary.clearedAssetCategoryCount === 1 ? "" : "s"}.`;
    case "departments":
      return `Reset ${summary.departmentCount} department${summary.departmentCount === 1 ? "" : "s"}. Removed ${summary.detachedAssetScopeCount} asset department link${summary.detachedAssetScopeCount === 1 ? "" : "s"} and ${summary.detachedUserScopeCount} user department link${summary.detachedUserScopeCount === 1 ? "" : "s"}.`;
    case "label-templates":
      return `Reset ${summary.templateCount} label template${summary.templateCount === 1 ? "" : "s"}. Cleared ${summary.clearedAssetTemplateCount} asset template assignment${summary.clearedAssetTemplateCount === 1 ? "" : "s"} and ${summary.clearedCategoryDefaultTemplateCount} category default${summary.clearedCategoryDefaultTemplateCount === 1 ? "" : "s"}.`;
    case "locations":
      return `Reset ${summary.locationCount} location${summary.locationCount === 1 ? "" : "s"}. Cleared ${summary.clearedAssetLocationCount} asset location assignment${summary.clearedAssetLocationCount === 1 ? "" : "s"}.`;
    case "full-app":
      return `Full app reset completed. Removed ${summary.assets} assets, ${summary.users} users, ${summary.categories} categories, ${summary.departments} departments, ${summary.labelTemplates} label templates, and ${summary.locations} locations.`;
  }
}

function ResetConfirmationDialog({
  action,
  acknowledgmentChecked,
  error,
  isSubmitting,
  onAcknowledgeChange,
  onClose,
  onConfirm,
  onTypedValueChange,
  typedValue,
}: {
  action: ResetActionCardConfig;
  acknowledgmentChecked: boolean;
  error: string | null;
  isSubmitting: boolean;
  onAcknowledgeChange: (value: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
  onTypedValueChange: (value: string) => void;
  typedValue: string;
}) {
  const typedConfirmationReady = !action.requiresTypedConfirmation || typedValue.trim() === action.confirmationPhrase;
  const canConfirm = acknowledgmentChecked && typedConfirmationReady && !isSubmitting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button
        aria-label="Close reset confirmation dialog"
        className="absolute inset-0 bg-slate-950/72"
        disabled={isSubmitting}
        onClick={onClose}
        type="button"
      />
      <div className="relative z-10 w-full max-w-2xl rounded-[28px] border border-[#6d4247] bg-[#2c3134] p-6 shadow-[0_28px_56px_rgba(0,0,0,0.4)]">
        <p className="text-sm uppercase tracking-[0.24em] text-rose-300">Restricted reset action</p>
        <h2 className="mt-3 text-2xl font-semibold text-slate-100">{action.title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">{action.warning}</p>

        <div className="mt-5 rounded-3xl border border-rose-900/60 bg-[linear-gradient(180deg,rgba(127,29,29,0.28)_0%,rgba(70,18,23,0.22)_100%)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-200">What this removes</p>
          <p className="mt-2 text-sm leading-6 text-rose-100">{action.impact}</p>
        </div>

        <label className={`mt-5 flex items-start gap-3 ${mutedDarkPanelClassName}`}>
          <input
            checked={acknowledgmentChecked}
            className="ui-check mt-0.5"
            disabled={isSubmitting}
            onChange={(event) => onAcknowledgeChange(event.target.checked)}
            type="checkbox"
          />
          <span>I understand this reset is destructive and cannot be undone from inside the app.</span>
        </label>

        {action.requiresTypedConfirmation ? (
          <label className="mt-4 block space-y-2">
            <span className="text-sm font-medium text-slate-200">Type {action.confirmationPhrase} to enable the reset</span>
            <input
              className="w-full rounded-2xl border border-[#5b4c50] bg-[#353b3f] px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-[#F69629]/70"
              disabled={isSubmitting}
              onChange={(event) => onTypedValueChange(event.target.value)}
              spellCheck={false}
              type="text"
              value={typedValue}
            />
          </label>
        ) : null}

        {error ? <div className="mt-4 rounded-2xl border border-rose-900/60 bg-rose-950/35 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <Button disabled={isSubmitting} onClick={onClose} type="button" variant="ghost">Cancel</Button>
          <Button
            className={destructiveButtonClassName}
            disabled={!canConfirm}
            onClick={onConfirm}
            type="button"
          >
            {isSubmitting ? "Resetting..." : action.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ResetManagementPanel({ overview }: ResetManagementPanelProps) {
  const router = useRouter();
  const [pendingActionKey, setPendingActionKey] = useState<ResetActionCardConfig["key"] | null>(null);
  const [typedValue, setTypedValue] = useState("");
  const [acknowledgmentChecked, setAcknowledgmentChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResetResult | null>(null);

  const actions = useMemo<ResetActionCardConfig[]>(() => [
    {
      key: "assets",
      title: "Reset Assets",
      count: overview.assets,
      description: "Removes asset records only. The rest of the app structure stays in place.",
      warning: "This permanently removes every asset from the app and strips asset-to-department links first so the database stays consistent.",
      impact: "Deletes assets and clears asset-to-department links.",
      actionLabel: "Open asset reset",
      confirmLabel: "Reset assets",
    },
    {
      key: "users",
      title: "Reset Users",
      count: overview.users,
      description: "Removes user records only. Assets and the rest of the structure remain.",
      warning: "This permanently removes every user, clears current asset assignments, detaches audit-log actor references, and deletes sessions and user role/scope links.",
      impact: "Deletes users, clears asset assignments, and ends the current admin session.",
      actionLabel: "Open user reset",
      confirmLabel: "Reset users",
      shouldRedirectToLogin: true,
    },
    {
      key: "categories",
      title: "Reset Categories",
      count: overview.categories,
      description: "Removes the category tree and clears category assignments from assets.",
      warning: "This permanently removes every category node and clears category assignments from existing assets before deletion.",
      impact: "Clears asset links, removes parent relationships, then deletes categories.",
      actionLabel: "Open category reset",
      confirmLabel: "Reset categories",
    },
    {
      key: "departments",
      title: "Reset Departments",
      count: overview.departments,
      description: "Removes department records and detaches linked asset and user assignments.",
      warning: "This permanently removes every department and removes all user/asset department assignments as part of the same reset.",
      impact: "Deletes departments and removes user/asset department joins.",
      actionLabel: "Open department reset",
      confirmLabel: "Reset departments",
    },
    {
      key: "label-templates",
      title: "Reset Label Templates",
      count: overview.labelTemplates,
      description: "Removes saved label templates and clears related asset/category references.",
      warning: "This permanently removes every saved label template and clears related default-template assignments before deletion.",
      impact: "Deletes templates and clears asset/category template references.",
      actionLabel: "Open label reset",
      confirmLabel: "Reset label templates",
    },
    {
      key: "locations",
      title: "Reset Locations",
      count: overview.locations,
      description: "Removes location records and clears location assignments from assets.",
      warning: "This permanently removes every location and clears assigned locations from assets before deletion.",
      impact: "Clears asset links, removes parent relationships, then deletes locations.",
      actionLabel: "Open location reset",
      confirmLabel: "Reset locations",
    },
    {
      key: "full-app",
      title: "Full App Reset",
      count: overview.assets + overview.users + overview.categories + overview.departments + overview.labelTemplates + overview.locations,
      description: "Removes every dataset managed in this reset surface and returns the app to a near-empty operational state.",
      warning: "This is the most destructive reset in the app. It removes all datasets listed on this page, ends the current admin session, and should only be used when intentionally returning the app to a near-empty operational state.",
      impact: "The reset removes all assets, users, categories, departments, label templates, and locations. Asset/category/location/template assignments and user-related joins are cleared in a safe order before final deletion. Global settings, roles, statuses, and setup state are not removed in this pass.",
      actionLabel: "Open full reset",
      confirmLabel: "Reset full app",
      confirmationPhrase: "RESET APP",
      requiresTypedConfirmation: true,
      shouldRedirectToLogin: true,
    },
  ], [overview]);

  const pendingAction = actions.find((action) => action.key === pendingActionKey) ?? null;
  const standardActions = actions.filter((action) => action.key !== "full-app");
  const fullResetAction = actions.find((action) => action.key === "full-app") ?? null;

  async function handleConfirmReset() {
    if (!pendingAction) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/settings/reset/${pendingAction.key}`, { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Reset failed.");
      }

      setResult({ tone: "success", message: buildSuccessMessage(pendingAction.key, data.summary as Record<string, number>) });
      setPendingActionKey(null);
      setTypedValue("");
      setAcknowledgmentChecked(false);

      if (data.shouldRedirectToLogin || pendingAction.shouldRedirectToLogin) {
        window.setTimeout(() => {
          window.location.href = "/login";
        }, 1400);
      } else {
        window.setTimeout(() => {
          router.refresh();
        }, 1000);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Reset failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function openAction(key: ResetActionCardConfig["key"]) {
    setPendingActionKey(key);
    setTypedValue("");
    setAcknowledgmentChecked(false);
    setError(null);
  }

  return (
    <div className="space-y-5">
      {result ? (
        <div className={result.tone === "success"
          ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"
          : "rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200"}
        >
          {result.message}
        </div>
      ) : null}

      <section className="rounded-[28px] border border-[#ece7df] bg-white/92 p-5 shadow-panel backdrop-blur dark:border-[#464c4f] dark:bg-[#383d40]/92">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">Admin reset surface</p>
            <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.01em] text-slate-950 dark:text-slate-100">Selective resets</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">Compact destructive controls with confirmation before execution.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {standardActions.map((action) => (
            <ResetActionCard action={action} key={action.key} onOpen={openAction} />
          ))}
        </div>
      </section>

      {fullResetAction ? (
        <section className="rounded-[28px] border border-[#8a545b] bg-[linear-gradient(180deg,rgba(255,247,248,0.98)_0%,rgba(255,235,238,0.94)_100%)] p-5 shadow-panel backdrop-blur dark:border-[#6a4b52] dark:bg-[linear-gradient(180deg,rgba(55,60,64,0.98)_0%,rgba(49,53,57,0.96)_100%)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch xl:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm uppercase tracking-[0.28em] text-rose-700 dark:text-rose-200">Highest risk</p>
              <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.01em] text-slate-950 dark:text-slate-100">{fullResetAction.title}</h2>
              <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-400">{fullResetAction.description}</p>
              <div className={`mt-3 ${destructiveInfoPanelClassName}`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-700 dark:text-rose-200">Included datasets</p>
                <p className="mt-1 text-[13px] leading-5 text-slate-600 dark:text-slate-400">Assets, users, categories, departments, label templates, and locations. Setup state, global settings, roles, and statuses stay in place.</p>
              </div>
            </div>
            <div className="xl:flex xl:w-[18.5rem]">
              <div className="flex h-full w-full flex-col rounded-[22px] border border-rose-300/80 bg-rose-100/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] dark:border-[#71545a] dark:bg-[#303539] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <ResetRecordBadge label={formatCountLabel(fullResetAction.count, "tracked record")} />
                <p className="mt-2 text-[13px] leading-5 text-slate-600 dark:text-slate-400">Resets every tracked dataset on this page and signs out the current admin session.</p>
                <Button
                  className={`${destructiveWideButtonClassName} mt-auto pt-3`}
                  onClick={() => openAction(fullResetAction.key)}
                  type="button"
                >
                  {fullResetAction.actionLabel}
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {pendingAction ? (
        <ResetConfirmationDialog
          acknowledgmentChecked={acknowledgmentChecked}
          action={pendingAction}
          error={error}
          isSubmitting={isSubmitting}
          onAcknowledgeChange={setAcknowledgmentChecked}
          onClose={() => {
            if (isSubmitting) {
              return;
            }
            setPendingActionKey(null);
            setTypedValue("");
            setAcknowledgmentChecked(false);
            setError(null);
          }}
          onConfirm={handleConfirmReset}
          onTypedValueChange={setTypedValue}
          typedValue={typedValue}
        />
      ) : null}
    </div>
  );
}
