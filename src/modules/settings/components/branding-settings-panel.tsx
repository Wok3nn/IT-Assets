"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { AppLogo } from "@/components/branding/app-logo";
import { PageHero } from "@/components/layout/page-hero";
import { PanelCard } from "@/components/layout/panel-card";
import { Button } from "@/components/ui/button";

type BrandingSettings = {
  lightLogoUrl: string;
  darkLogoUrl: string;
  lightIconUrl: string;
  darkIconUrl: string;
  defaults: {
    lightLogoUrl: string;
    darkLogoUrl: string;
    lightIconUrl: string;
    darkIconUrl: string;
  };
};

type BrandingSettingsPanelProps = {
  branding: BrandingSettings;
  initialSaved: boolean;
  saveBrandingSettingsAction: (formData: FormData) => void | Promise<void>;
};

const SAVED_MESSAGE_TIMEOUT_MS = 2500;
const noteClassName =
  "rounded-2xl border border-slate-200/80 bg-slate-50/90 px-3.5 py-2.5 text-xs text-slate-500 dark:border-[#4b5255] dark:bg-[#2f3437]/90 dark:text-slate-400";
const fileInputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition file:mr-3 file:rounded-lg file:border-0 file:bg-[#F69629] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:border-[#F69629]/45 dark:border-[#4b5255] dark:bg-[#2f3437] dark:text-slate-200 dark:file:text-[#2F3437]";

function BrandingHeaderActions({ isDirty, isSaved }: { isDirty: boolean; isSaved: boolean }) {
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
      <Link href="/settings"><Button type="button" variant="ghost">Back to settings</Button></Link>
      <Button className={isDirty ? "ring-2 ring-[rgba(246,150,41,0.22)]" : undefined} disabled={!isDirty || pending} type="submit">
        {pending ? "Saving..." : "Save branding"}
      </Button>
    </div>
  );
}

export function BrandingSettingsPanel({
  branding,
  initialSaved,
  saveBrandingSettingsAction,
}: BrandingSettingsPanelProps) {
  const [lightLogoUrl, setLightLogoUrl] = useState(branding.lightLogoUrl);
  const [darkLogoUrl, setDarkLogoUrl] = useState(branding.darkLogoUrl);
  const [lightIconUrl, setLightIconUrl] = useState(branding.lightIconUrl);
  const [darkIconUrl, setDarkIconUrl] = useState(branding.darkIconUrl);
  const [draftMessage, setDraftMessage] = useState("");
  const [isSaved, setIsSaved] = useState(initialSaved);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lightLogoInputRef = useRef<HTMLInputElement | null>(null);
  const darkLogoInputRef = useRef<HTMLInputElement | null>(null);
  const lightIconInputRef = useRef<HTMLInputElement | null>(null);
  const darkIconInputRef = useRef<HTMLInputElement | null>(null);

  const isDirty =
    lightLogoUrl !== branding.lightLogoUrl ||
    darkLogoUrl !== branding.darkLogoUrl ||
    lightIconUrl !== branding.lightIconUrl ||
    darkIconUrl !== branding.darkIconUrl ||
    draftMessage.length > 0;

  const usesDefaultBranding =
    lightLogoUrl === branding.defaults.lightLogoUrl &&
    darkLogoUrl === branding.defaults.darkLogoUrl &&
    lightIconUrl === branding.defaults.lightIconUrl &&
    darkIconUrl === branding.defaults.darkIconUrl;

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

  const markUploadSelected = (fileName?: string) => {
    clearSavedState();
    setDraftMessage(fileName ? "Upload selected. Save branding to apply it." : "");
  };

  const resetFileInputs = () => {
    if (lightLogoInputRef.current) lightLogoInputRef.current.value = "";
    if (darkLogoInputRef.current) darkLogoInputRef.current.value = "";
    if (lightIconInputRef.current) lightIconInputRef.current.value = "";
    if (darkIconInputRef.current) darkIconInputRef.current.value = "";
  };

  return (
    <form action={saveBrandingSettingsAction} className="space-y-6">
      <PageHero>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Settings</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950 dark:text-slate-100">Branding</h1>
            <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
              Configure the app logo and browser icon used on the login screen, sidebar, and browser tab while keeping the shipped transparent assets as the default fallback.
            </p>
          </div>
          <BrandingHeaderActions isDirty={isDirty} isSaved={isSaved} />
        </div>
      </PageHero>

      <PanelCard className="p-4">
        <input name="brandingLightLogoUrl" type="hidden" value={lightLogoUrl} />
        <input name="brandingDarkLogoUrl" type="hidden" value={darkLogoUrl} />
        <input name="brandingLightIconUrl" type="hidden" value={lightIconUrl} />
        <input name="brandingDarkIconUrl" type="hidden" value={darkIconUrl} />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:items-start">
          <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/95 p-4 dark:border-[#4b5255] dark:bg-[#2f3437]/90">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-950 dark:text-slate-100">Current branding</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {usesDefaultBranding ? "Using the default transparent logo and icon assets." : "Custom branding overrides are active."}
                </p>
              </div>
              <AppLogo className="h-16 w-16 shrink-0 drop-shadow-[0_12px_18px_rgba(246,150,41,0.16)] dark:drop-shadow-[0_14px_22px_rgba(0,0,0,0.24)]" darkSrc={darkLogoUrl} lightSrc={lightLogoUrl} />
            </div>
            <div className="mt-4 grid gap-2 text-xs text-slate-500 dark:text-slate-400">
              <div className="truncate">Light logo: {lightLogoUrl}</div>
              <div className="truncate">Dark logo: {darkLogoUrl}</div>
              <div className="truncate">Light icon: {lightIconUrl}</div>
              <div className="truncate">Dark icon: {darkIconUrl}</div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Light logo PNG</span>
                <input
                  accept="image/png"
                  className={fileInputClassName}
                  name="brandingLightLogoUpload"
                  onChange={(event) => markUploadSelected(event.target.files?.[0]?.name)}
                  ref={lightLogoInputRef}
                  type="file"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Dark logo PNG</span>
                <input
                  accept="image/png"
                  className={fileInputClassName}
                  name="brandingDarkLogoUpload"
                  onChange={(event) => markUploadSelected(event.target.files?.[0]?.name)}
                  ref={darkLogoInputRef}
                  type="file"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Light icon ICO/PNG</span>
                <input
                  accept="image/x-icon,image/vnd.microsoft.icon,image/png,.ico"
                  className={fileInputClassName}
                  name="brandingLightIconUpload"
                  onChange={(event) => markUploadSelected(event.target.files?.[0]?.name)}
                  ref={lightIconInputRef}
                  type="file"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Dark icon ICO/PNG</span>
                <input
                  accept="image/x-icon,image/vnd.microsoft.icon,image/png,.ico"
                  className={fileInputClassName}
                  name="brandingDarkIconUpload"
                  onChange={(event) => markUploadSelected(event.target.files?.[0]?.name)}
                  ref={darkIconInputRef}
                  type="file"
                />
              </label>
            </div>

            {draftMessage ? <div className={noteClassName}>{draftMessage}</div> : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  clearSavedState();
                  setLightLogoUrl(branding.defaults.lightLogoUrl);
                  setDarkLogoUrl(branding.defaults.darkLogoUrl);
                  setLightIconUrl(branding.defaults.lightIconUrl);
                  setDarkIconUrl(branding.defaults.darkIconUrl);
                  resetFileInputs();
                  setDraftMessage("Default branding selected. Save branding to apply it.");
                }}
              >
                Use default branding
              </Button>
              <span className="text-xs text-slate-500 dark:text-slate-400">Uploads replace only the selected asset. Defaults remain available as fallback.</span>
            </div>
          </div>
        </div>
      </PanelCard>
    </form>
  );
}
