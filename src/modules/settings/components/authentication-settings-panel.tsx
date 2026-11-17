"use client";

import { Check, Info, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { FieldLabel, FieldLabelText } from "@/components/forms/field-label";
import { TextField } from "@/components/forms/text-field";
import { PageHero } from "@/components/layout/page-hero";
import { PanelCard } from "@/components/layout/panel-card";
import { Button } from "@/components/ui/button";
import type { AuthenticationSettings } from "@/modules/settings/authentication-settings.service";

type RoleOption = {
  key: string;
  name: string;
};

type AuthenticationSettingsPanelProps = {
  initialError?: string | null;
  installationEntra?: boolean;
  initialSaved: boolean;
  roles: RoleOption[];
  settings: AuthenticationSettings;
  saveAuthenticationSettingsAction: (formData: FormData) => void | Promise<void>;
};

type DraftGroupMapping = {
  roleKey: string;
  roleName: string;
  groupId: string;
  groupName: string;
};

const SAVED_MESSAGE_TIMEOUT_MS = 2500;
const noteClassName =
  "rounded-2xl border border-slate-200/80 bg-slate-50/90 px-3.5 py-2.5 text-xs text-slate-500 dark:border-[#4b5255] dark:bg-[#2f3437]/90 dark:text-slate-400";
const warningClassName =
  "rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800 dark:border-amber-400/35 dark:bg-amber-500/10 dark:text-amber-200";
const toggleClassName =
  "h-4 w-4 rounded border-slate-300 text-[#F69629] focus:ring-[#F69629] dark:border-[#596166] dark:bg-[#2f3437]";
const helpPopoverId = "entra-provider-setup-help";
const ENTRA_REDIRECT_URI_EXAMPLE = "https://it-assets.example.com/api/auth/entra/callback";
const ENTRA_GROUP_OBJECT_ID_PATTERN = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

function buildInitialMappings(settings: AuthenticationSettings, roles: RoleOption[]) {
  return roles.map((role) => {
    const savedMapping = settings.groupMappings.find((mapping) => mapping.roleKey === role.key);

    return {
      roleKey: role.key,
      roleName: role.name,
      groupId: savedMapping?.groupId ?? "",
      groupName: savedMapping?.groupName ?? "",
    } satisfies DraftGroupMapping;
  });
}

function serializeDraft(input: unknown) {
  return JSON.stringify(input);
}

function AuthenticationHeaderActions({
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
      <Link href="/settings"><Button type="button" variant="ghost">Back to settings</Button></Link>
      <Button className={isDirty ? "ring-2 ring-[rgba(246,150,41,0.22)]" : undefined} disabled={!isDirty || pending} type="submit">
        {pending ? "Saving..." : "Save authentication"}
      </Button>
    </div>
  );
}

export function AuthenticationSettingsPanel({
  initialError,
  installationEntra = false,
  initialSaved,
  roles,
  settings,
  saveAuthenticationSettingsAction,
}: AuthenticationSettingsPanelProps) {
  const initialMappings = useMemo(() => buildInitialMappings(settings, roles), [roles, settings]);
  const [entraEnabled, setEntraEnabled] = useState(settings.entraEnabled);
  const [entraSsoEnabled, setEntraSsoEnabled] = useState(settings.entraSsoEnabled);
  const [entraTenantId, setEntraTenantId] = useState(settings.entraTenantId);
  const [entraClientId, setEntraClientId] = useState(settings.entraClientId);
  const [entraSecretReference, setEntraSecretReference] = useState(settings.entraSecretReference);
  const [entraRedirectUri, setEntraRedirectUri] = useState(settings.entraRedirectUri);
  const [groupMappings, setGroupMappings] = useState<DraftGroupMapping[]>(initialMappings);
  const [isSaved, setIsSaved] = useState(initialSaved);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const redirectUriToCopy = entraRedirectUri.trim() || ENTRA_REDIRECT_URI_EXAMPLE;

  const isDirty =
    entraEnabled !== settings.entraEnabled ||
    entraSsoEnabled !== settings.entraSsoEnabled ||
    entraTenantId !== settings.entraTenantId ||
    entraClientId !== settings.entraClientId ||
    entraSecretReference !== settings.entraSecretReference ||
    entraRedirectUri !== settings.entraRedirectUri ||
    serializeDraft(groupMappings) !== serializeDraft(initialMappings);

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

  const updateMapping = (roleKey: string, field: "groupId" | "groupName", value: string) => {
    clearSavedState();
    setGroupMappings((current) => (
      current.map((mapping) => (mapping.roleKey === roleKey ? { ...mapping, [field]: value } : mapping))
    ));
  };

  return (
    <form action={saveAuthenticationSettingsAction} className="space-y-6">
      <PageHero>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Settings</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950 dark:text-slate-100">Authentication Settings</h1>
            <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
              Configure local sign-in safety and prepare Microsoft Entra sign-in details without removing the local admin recovery path.
            </p>
          </div>
          <AuthenticationHeaderActions isDirty={isDirty} isSaved={isSaved} />
        </div>
      </PageHero>

      {initialError ? <div className={warningClassName}>{initialError}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
        <PanelCard className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Local authentication</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-100">Local sign-in</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                The local admin path remains available while external provider sign-in is being prepared.
              </p>
            </div>
            <LockKeyhole className="h-5 w-5 text-[#b56613] dark:text-[#ffd1a0]" aria-hidden="true" />
          </div>

          <div className="mt-5 space-y-3">
            <input name="localAuthEnabled" type="hidden" value="true" />
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/95 px-3.5 py-3 dark:border-[#4b5255] dark:bg-[#2f3437]/90">
              <input checked className={toggleClassName} disabled type="checkbox" />
              <span>
                <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">Local sign-in enabled</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                  This cannot be disabled yet because Entra sign-in is not active as an admin recovery path in this phase.
                </span>
              </span>
            </label>
            <div className={noteClassName}>
              Initial setup and local admin login continue to use the existing hashed-password flow. Local password requirements still apply only to local sign-in users, which keeps the admin recovery path intact while Entra access is configured.
            </div>
          </div>
        </PanelCard>

        <PanelCard className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Microsoft Entra</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-100">Provider configuration</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Configure Microsoft Entra sign-in while keeping local login available as the recovery path.
              </p>
            </div>
            <div className="group relative shrink-0">
              <button
                aria-describedby={helpPopoverId}
                aria-label="Microsoft Entra setup help"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-slate-50/90 text-[#b56613] transition hover:border-[#F69629]/45 hover:bg-[#fff5ea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F69629]/35 dark:border-[#4b5255] dark:bg-[#34393c] dark:text-[#ffd1a0] dark:hover:border-[#F69629]/55 dark:hover:bg-[#464d50]"
                type="button"
              >
                <Info className="h-5 w-5" aria-hidden="true" />
              </button>
              <div
                className="pointer-events-none absolute right-0 top-11 z-20 w-80 rounded-[22px] border border-slate-200 bg-white p-4 text-left opacity-0 shadow-[0_18px_44px_rgba(15,23,42,0.16)] transition duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 dark:border-[#4b5255] dark:bg-[#34393c] dark:shadow-[0_20px_48px_rgba(0,0,0,0.28)]"
                id={helpPopoverId}
                role="tooltip"
              >
                <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-100">Microsoft Entra setup</h3>
                <ul className="mt-3 space-y-1.5 text-xs leading-5 text-slate-600 dark:text-slate-300">
                  <li>Sign in to Microsoft Entra admin center.</li>
                  <li>Go to App registrations.</li>
                  <li>Create or open the app registration for this app.</li>
                  <li>Copy the Tenant ID and Client ID.</li>
                  <li>Create a client secret.</li>
                  <li>Add the redirect URI/callback shown in this app.</li>
                  <li>Paste the values into this form and save.</li>
                  <li>Optional: configure SSO and group mapping later.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/95 px-3.5 py-3 text-sm font-medium text-slate-700 dark:border-[#4b5255] dark:bg-[#2f3437]/90 dark:text-slate-200">
                <input
                  checked={entraEnabled}
                  className={toggleClassName}
                  name="entraEnabled"
                  onChange={(event) => {
                    clearSavedState();
                    setEntraEnabled(event.target.checked);
                  }}
                  type="checkbox"
                />
                Enable Entra sign-in
              </label>
              <label className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/95 px-3.5 py-3 text-sm font-medium text-slate-700 dark:border-[#4b5255] dark:bg-[#2f3437]/90 dark:text-slate-200">
                <input
                  checked={entraSsoEnabled}
                  className={toggleClassName}
                  name="entraSsoEnabled"
                  onChange={(event) => {
                    clearSavedState();
                    setEntraSsoEnabled(event.target.checked);
                  }}
                  type="checkbox"
                />
                Enable SSO
              </label>
            </div>

            <div className={noteClassName}>
              Users with login enabled can sign in through Entra without a local password when SSO is enabled. Local email/password sign-in still requires a real local password.
            </div>

            {installationEntra && <p>Provider credentials belong to the installation. <Link href="/settings/database-management">Sign in as installation administrator to edit them.</Link> Sign-in policy and group mappings below belong to this workspace.</p>}
            <div className="grid gap-3 md:grid-cols-2">
              <FieldLabel>
                <FieldLabelText>Tenant ID</FieldLabelText>
                <TextField readOnly={installationEntra} name="entraTenantId" onChange={(event) => { clearSavedState(); setEntraTenantId(event.target.value); }} placeholder="00000000-0000-0000-0000-000000000000" value={entraTenantId} />
              </FieldLabel>
              <FieldLabel>
                <FieldLabelText>Client ID</FieldLabelText>
                <TextField readOnly={installationEntra} name="entraClientId" onChange={(event) => { clearSavedState(); setEntraClientId(event.target.value); }} placeholder="Application client ID" value={entraClientId} />
              </FieldLabel>
              <FieldLabel>
                <FieldLabelText>{installationEntra ? "Client secret (configured, hidden)" : "Client secret reference"}</FieldLabelText>
                <TextField readOnly={installationEntra} name="entraSecretReference" onChange={(event) => { clearSavedState(); setEntraSecretReference(event.target.value); }} placeholder="Environment variable or vault reference" type="password" value={entraSecretReference} />
              </FieldLabel>
              <FieldLabel>
                <FieldLabelText>Redirect URI / callback</FieldLabelText>
                <TextField readOnly={installationEntra} name="entraRedirectUri" onChange={(event) => { clearSavedState(); setEntraRedirectUri(event.target.value); }} placeholder={ENTRA_REDIRECT_URI_EXAMPLE} value={entraRedirectUri} />
              </FieldLabel>
            </div>

            <div className="rounded-2xl border border-[#f2c28c]/70 bg-[rgba(246,150,41,0.08)] px-3.5 py-3 text-xs text-slate-700 dark:border-[#7f5a2d]/80 dark:bg-[rgba(246,150,41,0.12)] dark:text-slate-200">
              <p className="font-semibold uppercase tracking-[0.18em] text-[#b56613] dark:text-[#ffd1a0]">Redirect URI to add in Entra</p>
              <p className="mt-2 break-all font-mono text-[0.78rem]">{redirectUriToCopy}</p>
              <p className="mt-2 text-slate-600 dark:text-slate-300">
                When configuring your Entra App Registration, the redirect URI must match the application callback endpoint exactly. Use the DNS name where this application is hosted.
              </p>
            </div>
          </div>
        </PanelCard>
      </div>

      <PanelCard className="p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Group mapping</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-100">Entra groups to app roles</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Prepare one optional Entra group mapping per app role. Use the group Object ID GUID from Entra. On Entra sign-in, a matching mapped group becomes the user&apos;s effective app role for that session. If nothing matches, the stored local role remains the fallback.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-[#34393c] dark:text-slate-300">{roles.length} roles</span>
        </div>

        <div className="mt-5 overflow-hidden rounded-[22px] border border-slate-200/80 bg-slate-50/95 dark:border-[#4b5255] dark:bg-[#2f3437]/90">
          <div className="grid gap-2 border-b border-slate-200/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:border-[#4b5255] dark:text-slate-400 md:grid-cols-[0.7fr_1fr_1fr]">
            <span>Role</span>
            <span>Entra group ID</span>
            <span>Group display name optional</span>
          </div>
          <div className="divide-y divide-slate-200/80 dark:divide-[#4b5255]">
            {groupMappings.map((mapping) => (
              <div key={mapping.roleKey} className="grid gap-2 px-3 py-3 md:grid-cols-[0.7fr_1fr_1fr] md:items-center">
                <input name="groupMappingRoleKey" type="hidden" value={mapping.roleKey} />
                <input name="groupMappingRoleName" type="hidden" value={mapping.roleName} />
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{mapping.roleName}</div>
                <TextField
                  className="h-10 rounded-xl px-3 py-2 text-sm"
                  maxLength={36}
                  name="groupMappingGroupId"
                  onChange={(event) => updateMapping(mapping.roleKey, "groupId", event.target.value)}
                  pattern={ENTRA_GROUP_OBJECT_ID_PATTERN}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  title="Enter a valid Entra group Object ID in GUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx."
                  value={mapping.groupId}
                />
                <TextField
                  className="h-10 rounded-xl px-3 py-2 text-sm"
                  name="groupMappingGroupName"
                  onChange={(event) => updateMapping(mapping.roleKey, "groupName", event.target.value)}
                  placeholder="Example: Entra group name"
                  value={mapping.groupName}
                />
              </div>
            ))}
          </div>
        </div>
      </PanelCard>
    </form>
  );
}
