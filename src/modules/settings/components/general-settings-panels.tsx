"use client";

import { Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { FieldLabel, FieldLabelText } from "@/components/forms/field-label";
import { TextField } from "@/components/forms/text-field";
import { PageHero } from "@/components/layout/page-hero";
import { PanelCard } from "@/components/layout/panel-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AssetStatusPill } from "@/modules/assets/asset-status-pill";

type GeneralSettingsData = {
  startingAssetTagNumber: number;
};

type AssetStatus = {
  id: string;
  key: string;
  name: string;
  color: string | null;
  _count: {
    assets: number;
  };
};

type EditableStatus = {
  id: string;
  key: string;
  name: string;
  color: string;
  assetCount: number;
};

type GeneralSettingsSectionKey = "assetTag" | "statuses" | "newStatus";

const SETTINGS_HUB_HREF = "/settings";
const DEFAULT_NEW_STATUS_COLOR = "#f59e0b";
const SAVED_MESSAGE_TIMEOUT_MS = 2500;
const cardHeaderButtonClassName =
  "flex w-full items-start justify-between gap-4 rounded-[24px] text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F69629]/35";
const collapsedSummaryClassName =
  "mt-3 text-sm text-slate-500 dark:text-slate-400";
const compactNoteClassName =
  "rounded-2xl border border-slate-200/80 bg-slate-50/90 px-3.5 py-2.5 text-xs text-slate-500 dark:border-[#4b5255] dark:bg-[#2f3437]/90 dark:text-slate-400";

function GeneralSettingsHeaderActions({
  isDirty,
  isSaved,
}: {
  isDirty: boolean;
  isSaved: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <div className="flex flex-wrap items-center gap-3">
      {isDirty ? <span className="text-sm font-medium text-[#b56613] dark:text-[#ffd1a0]">Unsaved changes</span> : null}
      {!isDirty && isSaved ? (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          <Check className="h-4 w-4" aria-hidden="true" />
          <span>Saved</span>
        </span>
      ) : null}
      <Link href={SETTINGS_HUB_HREF}><Button type="button" variant="ghost">Back to settings</Button></Link>
      <Button
        className={isDirty ? "ring-2 ring-[rgba(246,150,41,0.22)]" : undefined}
        disabled={!isDirty || pending}
        type="submit"
      >
        {pending ? "Saving..." : "Save general settings"}
      </Button>
    </div>
  );
}

function GeneralSettingsSectionCard({
  title,
  description,
  summary,
  isOpen,
  onToggle,
  children,
  className,
}: {
  title: string;
  description: string;
  summary: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <PanelCard className={cn("flex h-full flex-col p-4", className)}>
      <button className={cardHeaderButtonClassName} onClick={onToggle} type="button">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-950 dark:text-slate-100">{title}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{description}</p>
          {!isOpen ? <p className={collapsedSummaryClassName}>{summary}</p> : null}
        </div>
        <span
          className={cn(
            "mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200/80 bg-slate-50/90 text-slate-500 transition duration-200 dark:border-[#4b5255] dark:bg-[#2f3437]/90 dark:text-slate-300",
            isOpen ? "rotate-180" : "rotate-0",
          )}
        >
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </span>
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity,margin] duration-200 ease-out",
          isOpen ? "mt-4 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </PanelCard>
  );
}

export function GeneralSettingsPanels({
  generalSettings,
  assetStatuses,
  initialSaved,
  saveGeneralSettingsAction,
}: {
  generalSettings: GeneralSettingsData;
  assetStatuses: AssetStatus[];
  initialSaved: boolean;
  saveGeneralSettingsAction: (formData: FormData) => void | Promise<void>;
}) {
  const initialStartingAssetTagNumber = String(generalSettings.startingAssetTagNumber);
  const initialStatuses = useMemo(
    () => assetStatuses.map((status) => ({
      id: status.id,
      key: status.key,
      name: status.name,
      color: status.color ?? "#94a3b8",
      assetCount: status._count.assets,
    })),
    [assetStatuses],
  );

  const [startingAssetTagNumber, setStartingAssetTagNumber] = useState(initialStartingAssetTagNumber);
  const [statuses, setStatuses] = useState<EditableStatus[]>(initialStatuses);
  const [newStatusName, setNewStatusName] = useState("");
  const [newStatusColor, setNewStatusColor] = useState(DEFAULT_NEW_STATUS_COLOR);
  const [isSaved, setIsSaved] = useState(initialSaved);
  const [openSections, setOpenSections] = useState<Record<GeneralSettingsSectionKey, boolean>>({
    assetTag: true,
    statuses: true,
    newStatus: false,
  });
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSavedTimeout = () => {
    if (savedTimeoutRef.current) {
      clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    setIsSaved(initialSaved);
    clearSavedTimeout();

    if (initialSaved) {
      savedTimeoutRef.current = setTimeout(() => {
        setIsSaved(false);
        savedTimeoutRef.current = null;
      }, SAVED_MESSAGE_TIMEOUT_MS);
    }

    return () => {
      clearSavedTimeout();
    };
  }, [initialSaved]);

  const clearSavedState = () => {
    if (isSaved) {
      setIsSaved(false);
    }
    clearSavedTimeout();
  };

  const toggleSection = (section: GeneralSettingsSectionKey) => {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  const isDirty = useMemo(() => {
    if (startingAssetTagNumber !== initialStartingAssetTagNumber) {
      return true;
    }

    if (statuses.length !== initialStatuses.length) {
      return true;
    }

    for (let index = 0; index < statuses.length; index += 1) {
      const current = statuses[index];
      const initial = initialStatuses[index];

      if (!initial || current.id !== initial.id || current.name !== initial.name || current.color !== initial.color) {
        return true;
      }
    }

    return newStatusName.trim().length > 0;
  }, [initialStartingAssetTagNumber, initialStatuses, newStatusName, startingAssetTagNumber, statuses]);

  const assetTagSummary = `Starts from ${startingAssetTagNumber || initialStartingAssetTagNumber} and auto-increments to the next free numeric tag.`;
  const statusSummary = `${statuses.length} status${statuses.length === 1 ? "" : "es"} configured across ${statuses.reduce((sum, status) => sum + status.assetCount, 0)} asset${statuses.reduce((sum, status) => sum + status.assetCount, 0) === 1 ? "" : "s"}.`;
  const newStatusSummary = newStatusName.trim()
    ? `Draft ready: ${newStatusName.trim()}`
    : "Add another workflow state without expanding the full statuses list.";

  return (
    <form action={saveGeneralSettingsAction} className="space-y-6">
      <PageHero>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Settings</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950 dark:text-slate-100">General Settings</h1>
            <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
              Manage the starting asset tag number and asset status definitions in a compact control surface instead of a long stacked form.
            </p>
          </div>
          <GeneralSettingsHeaderActions isDirty={isDirty} isSaved={isSaved} />
        </div>
      </PageHero>

      <div className="grid gap-4 xl:grid-cols-3">
        <GeneralSettingsSectionCard
          description="Set the first numeric asset tag used when the app assigns the next available number."
          isOpen={openSections.assetTag}
          onToggle={() => toggleSection("assetTag")}
          summary={assetTagSummary}
          title="Asset tag settings"
        >
          <div className="space-y-3">
            <FieldLabel>
              <FieldLabelText>Starting asset tag number</FieldLabelText>
              <TextField
                min={1}
                name="startingAssetTagNumber"
                onChange={(event) => {
                  clearSavedState();
                  setStartingAssetTagNumber(event.target.value);
                }}
                step={1}
                type="number"
                value={startingAssetTagNumber}
              />
            </FieldLabel>
            <div className={compactNoteClassName}>
              Example: if this is `5000` and tags `5000` through `5100` already exist, the next new asset receives `5101`.
            </div>
          </div>
        </GeneralSettingsSectionCard>

        <GeneralSettingsSectionCard
          className="xl:col-span-2"
          description="Rename statuses, adjust their color chips, and keep deployment workflow states tidy."
          isOpen={openSections.statuses}
          onToggle={() => toggleSection("statuses")}
          summary={statusSummary}
          title="Asset statuses"
        >
          <div className="space-y-3">
            <div className={compactNoteClassName}>Status rows stay compact here, while the page-level save action still commits all changes together.</div>
            <div className="space-y-2.5">
              {statuses.map((status, index) => (
                <div key={status.id} className="rounded-[22px] border border-slate-200/80 bg-slate-50/95 px-3.5 py-3 dark:border-[#4b5255] dark:bg-[#2f3437]/90">
                  <input name="statusId" type="hidden" value={status.id} />
                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_94px_150px_88px] xl:items-center">
                    <FieldLabel className="gap-1.5">
                      <FieldLabelText>Name</FieldLabelText>
                      <TextField
                        name="statusName"
                        onChange={(event) => {
                          clearSavedState();
                          const next = [...statuses];
                          next[index] = { ...next[index], name: event.target.value };
                          setStatuses(next);
                        }}
                        type="text"
                        value={status.name}
                      />
                    </FieldLabel>
                    <FieldLabel className="gap-1.5">
                      <FieldLabelText>Color</FieldLabelText>
                      <TextField
                        className="h-11 p-2"
                        name="statusColor"
                        onChange={(event) => {
                          clearSavedState();
                          const next = [...statuses];
                          next[index] = { ...next[index], color: event.target.value };
                          setStatuses(next);
                        }}
                        type="color"
                        value={status.color}
                      />
                    </FieldLabel>
                    <div className="space-y-1.5">
                      <span className="block text-xs font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Preview</span>
                      <div className="flex min-h-11 items-center">
                        <AssetStatusPill color={status.color} label={status.name} />
                      </div>
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <span className="block text-xs font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">In use</span>
                      <span className="text-slate-700 dark:text-slate-200">{status.assetCount} asset{status.assetCount === 1 ? "" : "s"}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GeneralSettingsSectionCard>

        <GeneralSettingsSectionCard
          description="Create another workflow state without expanding the existing status list every time."
          isOpen={openSections.newStatus}
          onToggle={() => toggleSection("newStatus")}
          summary={newStatusSummary}
          title="Add status"
        >
          <div className="space-y-3">
            <div className="grid gap-3">
              <FieldLabel>
                <FieldLabelText>New status name</FieldLabelText>
                <TextField
                  name="newStatusName"
                  onChange={(event) => {
                    clearSavedState();
                    setNewStatusName(event.target.value);
                  }}
                  placeholder="Awaiting disposal"
                  type="text"
                  value={newStatusName}
                />
              </FieldLabel>
              <FieldLabel>
                <FieldLabelText>Color</FieldLabelText>
                <TextField
                  className="h-11 p-2"
                  name="newStatusColor"
                  onChange={(event) => {
                    clearSavedState();
                    setNewStatusColor(event.target.value);
                  }}
                  type="color"
                  value={newStatusColor}
                />
              </FieldLabel>
            </div>
            <div className={compactNoteClassName}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Preview</span>
                <AssetStatusPill color={newStatusColor} label={newStatusName || "New status"} />
              </div>
            </div>
          </div>
        </GeneralSettingsSectionCard>
      </div>
    </form>
  );
}
