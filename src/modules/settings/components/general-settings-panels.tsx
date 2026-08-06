"use client";

import { Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { FieldLabel, FieldLabelText } from "@/components/forms/field-label";
import { SelectField } from "@/components/forms/select-field";
import { TextField } from "@/components/forms/text-field";
import { PageHero } from "@/components/layout/page-hero";
import { PanelCard } from "@/components/layout/panel-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AssetStatusPill } from "@/modules/assets/asset-status-pill";
import { MAKE_MODEL_SOURCE_OPTIONS, type MakeModelSourceLevel } from "@/modules/assets/make-model-source";

type GeneralSettingsData = {
  appTitle: string;
  sessionTimeoutMinutes: number;
  startingAssetTagNumber: number;
  makeModel: {
    autoEnabled: boolean;
    makeSourceLevel: MakeModelSourceLevel;
    modelSourceLevel: MakeModelSourceLevel;
  };
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

type GeneralSettingsSectionKey = "appTitle" | "sessionTimeout" | "assetTag" | "makeModel" | "statuses" | "newStatus";

const SETTINGS_HUB_HREF = "/settings";
const DEFAULT_NEW_STATUS_COLOR = "#f59e0b";
const SAVED_MESSAGE_TIMEOUT_MS = 2500;
const cardHeaderButtonClassName =
  "flex w-full items-start justify-between gap-4 rounded-[24px] text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F69629]/35";
const collapsedSummaryClassName =
  "mt-3 text-sm text-slate-500 dark:text-slate-400";
const compactNoteClassName =
  "rounded-2xl border border-slate-200/80 bg-slate-50/90 px-3.5 py-2.5 text-xs text-slate-500 dark:border-[#4b5255] dark:bg-[#2f3437]/90 dark:text-slate-400";
const compactInputClassName = "h-9 rounded-xl px-3 py-1.5 text-sm";
const compactColorInputClassName = "h-9 rounded-xl p-1.5";
const statusRowClassName =
  "grid gap-2 px-2.5 py-2 sm:grid-cols-[minmax(0,1fr)_44px] sm:items-center";

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
    <PanelCard className={cn("flex flex-col p-4", className)}>
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
  const initialAppTitle = generalSettings.appTitle;
  const initialSessionTimeoutMinutes = String(generalSettings.sessionTimeoutMinutes);
  const initialStartingAssetTagNumber = String(generalSettings.startingAssetTagNumber);
  const initialMakeModelAutoEnabled = generalSettings.makeModel.autoEnabled;
  const initialMakeModelMakeSourceLevel = generalSettings.makeModel.makeSourceLevel;
  const initialMakeModelModelSourceLevel = generalSettings.makeModel.modelSourceLevel;
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

  const [appTitle, setAppTitle] = useState(initialAppTitle);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(initialSessionTimeoutMinutes);
  const [startingAssetTagNumber, setStartingAssetTagNumber] = useState(initialStartingAssetTagNumber);
  const [makeModelAutoEnabled, setMakeModelAutoEnabled] = useState(initialMakeModelAutoEnabled);
  const [makeModelMakeSourceLevel, setMakeModelMakeSourceLevel] = useState(initialMakeModelMakeSourceLevel);
  const [makeModelModelSourceLevel, setMakeModelModelSourceLevel] = useState(initialMakeModelModelSourceLevel);
  const [statuses, setStatuses] = useState<EditableStatus[]>(initialStatuses);
  const [newStatusName, setNewStatusName] = useState("");
  const [newStatusColor, setNewStatusColor] = useState(DEFAULT_NEW_STATUS_COLOR);
  const [isSaved, setIsSaved] = useState(initialSaved);
  const [openSections, setOpenSections] = useState<Record<GeneralSettingsSectionKey, boolean>>({
    appTitle: false,
    sessionTimeout: false,
    assetTag: false,
    makeModel: false,
    statuses: false,
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
    if (appTitle !== initialAppTitle) {
      return true;
    }

    if (sessionTimeoutMinutes !== initialSessionTimeoutMinutes) {
      return true;
    }

    if (startingAssetTagNumber !== initialStartingAssetTagNumber) {
      return true;
    }

    if (makeModelAutoEnabled !== initialMakeModelAutoEnabled) {
      return true;
    }

    if (makeModelMakeSourceLevel !== initialMakeModelMakeSourceLevel) {
      return true;
    }

    if (makeModelModelSourceLevel !== initialMakeModelModelSourceLevel) {
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
  }, [
    appTitle,
    initialAppTitle,
    initialMakeModelAutoEnabled,
    initialMakeModelMakeSourceLevel,
    initialMakeModelModelSourceLevel,
    initialSessionTimeoutMinutes,
    initialStartingAssetTagNumber,
    initialStatuses,
    makeModelAutoEnabled,
    makeModelMakeSourceLevel,
    makeModelModelSourceLevel,
    newStatusName,
    sessionTimeoutMinutes,
    startingAssetTagNumber,
    statuses,
  ]);

  const appTitleSummary = appTitle.trim()
    ? `Sidebar label: ${appTitle.trim()}`
    : `Sidebar label will use ${initialAppTitle}.`;
  const sessionTimeoutSummary = `Users are signed out after ${sessionTimeoutMinutes || initialSessionTimeoutMinutes} minutes without an active session refresh.`;
  const assetTagSummary = `Starts from ${startingAssetTagNumber || initialStartingAssetTagNumber} and auto-increments to the next free numeric tag.`;
  const makeModelMakeSourceLabel = MAKE_MODEL_SOURCE_OPTIONS.find((option) => option.value === makeModelMakeSourceLevel)?.label ?? "Sub-category 1";
  const makeModelModelSourceLabel = MAKE_MODEL_SOURCE_OPTIONS.find((option) => option.value === makeModelModelSourceLevel)?.label ?? "Sub-category 2";
  const makeModelSummary = makeModelAutoEnabled
    ? `New assets start in Automatic mode. Make: ${makeModelMakeSourceLabel}; Model: ${makeModelModelSourceLabel}.`
    : `New assets start in Manual mode. Saved sources are retained but not enforced.`;
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

      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        <GeneralSettingsSectionCard
          description="Set the subtle application title shown in the expanded sidebar footer."
          isOpen={openSections.appTitle}
          onToggle={() => toggleSection("appTitle")}
          summary={appTitleSummary}
          title="App title"
        >
          <div className="space-y-3">
            <FieldLabel>
              <FieldLabelText>Application title</FieldLabelText>
              <TextField
                maxLength={80}
                name="appTitle"
                onChange={(event) => {
                  clearSavedState();
                  setAppTitle(event.target.value);
                }}
                placeholder="IT-Asset-Tracker"
                type="text"
                value={appTitle}
              />
            </FieldLabel>
            <div className={compactNoteClassName}>
              This controls the subtle application label near the bottom of the expanded sidebar. The collapsed sidebar keeps the logo-only treatment.
            </div>
          </div>
        </GeneralSettingsSectionCard>

        <GeneralSettingsSectionCard
          description="Control how long local sign-in sessions stay active before requiring sign-in again."
          isOpen={openSections.sessionTimeout}
          onToggle={() => toggleSection("sessionTimeout")}
          summary={sessionTimeoutSummary}
          title="Session timeout"
        >
          <div className="space-y-3">
            <FieldLabel>
              <FieldLabelText>Timeout minutes</FieldLabelText>
              <TextField
                max={60}
                min={5}
                name="sessionTimeoutMinutes"
                onChange={(event) => {
                  clearSavedState();
                  setSessionTimeoutMinutes(event.target.value);
                }}
                step={1}
                type="number"
                value={sessionTimeoutMinutes}
              />
            </FieldLabel>
            <div className={compactNoteClassName}>
              Allowed range is 5 to 60 minutes. The default is 15 minutes, and active session checks refresh the server-side expiry.
            </div>
          </div>
        </GeneralSettingsSectionCard>

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
          description="Choose whether new assets automatically use the saved category-path sources for Make and Model."
          isOpen={openSections.makeModel}
          onToggle={() => toggleSection("makeModel")}
          summary={makeModelSummary}
          title="Automatic make and model"
        >
          <div className="space-y-3">
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700 dark:border-[#4b5255] dark:bg-[#2f3437] dark:text-slate-200">
              <input
                checked={makeModelAutoEnabled}
                className="ui-switch mt-0.5"
                name="makeModelAutoEnabled"
                onChange={(event) => {
                  clearSavedState();
                  setMakeModelAutoEnabled(event.target.checked);
                }}
                type="checkbox"
                value="true"
              />
              <span>
                <span className="block font-medium text-slate-800 dark:text-slate-100">Automatically derive make and model from category path for new assets</span>
                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">When enabled, new asset forms start in Automatic mode and use these saved source levels. Existing asset edits still open in Manual mode.</span>
              </span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldLabel>
                <FieldLabelText>Make source</FieldLabelText>
                <SelectField
                  name="makeModelMakeSourceLevel"
                  onChange={(event) => {
                    clearSavedState();
                    setMakeModelMakeSourceLevel(event.target.value as MakeModelSourceLevel);
                  }}
                  value={makeModelMakeSourceLevel}
                >
                  {MAKE_MODEL_SOURCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </SelectField>
              </FieldLabel>
              <FieldLabel>
                <FieldLabelText>Model source</FieldLabelText>
                <SelectField
                  name="makeModelModelSourceLevel"
                  onChange={(event) => {
                    clearSavedState();
                    setMakeModelModelSourceLevel(event.target.value as MakeModelSourceLevel);
                  }}
                  value={makeModelModelSourceLevel}
                >
                  {MAKE_MODEL_SOURCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </SelectField>
              </FieldLabel>
            </div>
            <div className={compactNoteClassName}>
              When automatic derivation is off, these saved source levels are retained for later but asset forms do not enforce them; choosing Automatic in a form shows per-form source selectors instead.
            </div>
          </div>
        </GeneralSettingsSectionCard>

        <GeneralSettingsSectionCard
          description="Rename statuses, adjust their color chips, and keep deployment workflow states tidy."
          isOpen={openSections.statuses}
          onToggle={() => toggleSection("statuses")}
          summary={statusSummary}
          title="Asset statuses"
        >
          <div className="space-y-2.5">
            <div className="overflow-hidden rounded-[20px] border border-slate-200/80 bg-slate-50/95 dark:border-[#4b5255] dark:bg-[#2f3437]/90">
              <div className="divide-y divide-slate-200/80 dark:divide-[#4b5255]">
                {statuses.map((status, index) => (
                  <div key={status.id} className={statusRowClassName}>
                    <input name="statusId" type="hidden" value={status.id} />
                    <label className="min-w-0">
                      <span className="sr-only">Status name</span>
                      <TextField
                        className={compactInputClassName}
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
                    </label>
                    <label>
                      <span className="sr-only">Status color</span>
                      <TextField
                        className={cn(compactColorInputClassName, "w-full")}
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
                    </label>
                    <div className="flex min-w-0 items-center justify-between gap-2 sm:col-span-2">
                      <AssetStatusPill color={status.color} label={status.name} />
                      <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{status.assetCount} asset{status.assetCount === 1 ? "" : "s"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">All status changes save together from the page header.</div>
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
                  className="h-10 p-1.5"
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
