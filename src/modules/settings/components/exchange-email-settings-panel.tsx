"use client";

import { Check, KeyRound, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { FieldLabel, FieldLabelText } from "@/components/forms/field-label";
import { TextField } from "@/components/forms/text-field";
import { PageHero } from "@/components/layout/page-hero";
import { PanelCard } from "@/components/layout/panel-card";
import { Button } from "@/components/ui/button";
import type { ExchangeEmailSettings } from "@/modules/settings/exchange-email-settings.service";

export type ExchangeTestEmailState = {
  ok: boolean;
  message: string;
};

type ExchangeEmailSettingsPanelProps = {
  clearClientSecretAction: () => void | Promise<void>;
  initialError?: string | null;
  initialSaved: boolean;
  saveExchangeEmailSettingsAction: (formData: FormData) => void | Promise<void>;
  sendTestEmailAction: (state: ExchangeTestEmailState, formData: FormData) => Promise<ExchangeTestEmailState>;
  settings: ExchangeEmailSettings;
};

const SAVED_MESSAGE_TIMEOUT_MS = 2500;
const toggleClassName =
  "h-4 w-4 rounded border-slate-300 text-[#F69629] focus:ring-[#F69629] dark:border-[#596166] dark:bg-[#2f3437]";
const noteClassName =
  "rounded-2xl border border-slate-200/80 bg-slate-50/90 px-3.5 py-2.5 text-xs text-slate-500 dark:border-[#4b5255] dark:bg-[#2f3437]/90 dark:text-slate-400";
const warningClassName =
  "rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800 dark:border-amber-400/35 dark:bg-amber-500/10 dark:text-amber-200";

function ExchangeHeaderActions({ isDirty, isSaved }: { isDirty: boolean; isSaved: boolean }) {
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
        {pending ? "Saving..." : "Save email settings"}
      </Button>
    </div>
  );
}

function CredentialStatus({ label, configured }: { label: string; configured: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/95 px-3.5 py-3 dark:border-[#4b5255] dark:bg-[#2f3437]/90">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className={configured ? "mt-1 text-sm font-medium text-emerald-700 dark:text-emerald-300" : "mt-1 text-sm font-medium text-amber-700 dark:text-amber-300"}>
        {configured ? "Configured" : "Not configured"}
      </p>
    </div>
  );
}

function ClearClientSecretButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button className="bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-500 dark:text-white dark:hover:bg-rose-400" disabled={disabled || pending} type="submit">
      {pending ? "Clearing..." : "Clear Client Secret"}
    </Button>
  );
}

function ClearClientSecretDialog({
  action,
  onClose,
}: {
  action: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center px-4 py-6">
      <button
        aria-label="Close client secret confirmation dialog"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px] dark:bg-black/55"
        onClick={onClose}
        type="button"
      />
      <div className="relative z-10 w-full max-w-lg rounded-[28px] border border-[#ece7df] bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.24)] dark:border-[#4b5255] dark:bg-[#2f3437]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-600 dark:text-rose-300">Sensitive setting</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-950 dark:text-slate-100">Clear Client Secret</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          This removes the encrypted Microsoft 365 Client Secret from application settings. Tenant ID, Client ID, sender mailbox, recipients, and notification toggles will stay unchanged.
        </p>
        <label className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/95 px-3.5 py-3 text-sm text-slate-700 dark:border-[#4b5255] dark:bg-[#34393c] dark:text-slate-200">
          <input
            checked={acknowledged}
            className={toggleClassName}
            onChange={(event) => setAcknowledged(event.target.checked)}
            type="checkbox"
          />
          <span>I understand email sending will be incomplete until a new Client Secret is saved.</span>
        </label>
        <form action={action} className="mt-6 flex flex-wrap justify-end gap-3">
          <Button onClick={onClose} type="button" variant="ghost">Cancel</Button>
          <ClearClientSecretButton disabled={!acknowledged} />
        </form>
      </div>
    </div>
  );
}

function ToggleField({
  checked,
  description,
  label,
  name,
  onChange,
}: {
  checked: boolean;
  description?: string;
  label: string;
  name: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/95 px-3.5 py-3 dark:border-[#4b5255] dark:bg-[#2f3437]/90">
      <input checked={checked} className={toggleClassName} name={name} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      <span>
        <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</span>
        {description ? <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</span> : null}
      </span>
    </label>
  );
}

export function ExchangeEmailSettingsPanel({
  clearClientSecretAction,
  initialError,
  initialSaved,
  saveExchangeEmailSettingsAction,
  sendTestEmailAction,
  settings,
}: ExchangeEmailSettingsPanelProps) {
  const [mailEnabled, setMailEnabled] = useState(settings.mailEnabled);
  const [tenantId, setTenantId] = useState(settings.tenantId);
  const [clientId, setClientId] = useState(settings.clientId);
  const [clientSecret, setClientSecret] = useState("");
  const [senderMailbox, setSenderMailbox] = useState(settings.senderMailbox);
  const [adminRecipient, setAdminRecipient] = useState(settings.adminRecipient);
  const [notifyBorrowerOnBorrow, setNotifyBorrowerOnBorrow] = useState(settings.notifyBorrowerOnBorrow);
  const [notifyBorrowerOnReturn, setNotifyBorrowerOnReturn] = useState(settings.notifyBorrowerOnReturn);
  const [notifyAdminOnBorrow, setNotifyAdminOnBorrow] = useState(settings.notifyAdminOnBorrow);
  const [notifyAdminOnReturn, setNotifyAdminOnReturn] = useState(settings.notifyAdminOnReturn);
  const [isSaved, setIsSaved] = useState(initialSaved);
  const [isClearSecretOpen, setIsClearSecretOpen] = useState(false);
  const [testState, testAction, testPending] = useActionState(sendTestEmailAction, { ok: false, message: "" });
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDirty =
    mailEnabled !== settings.mailEnabled ||
    tenantId !== settings.tenantId ||
    clientId !== settings.clientId ||
    clientSecret.trim() !== "" ||
    senderMailbox !== settings.senderMailbox ||
    adminRecipient !== settings.adminRecipient ||
    notifyBorrowerOnBorrow !== settings.notifyBorrowerOnBorrow ||
    notifyBorrowerOnReturn !== settings.notifyBorrowerOnReturn ||
    notifyAdminOnBorrow !== settings.notifyAdminOnBorrow ||
    notifyAdminOnReturn !== settings.notifyAdminOnReturn;

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

    return () => clearSavedTimeout();
  }, [initialSaved]);

  const clearSavedState = () => {
    if (isSaved) setIsSaved(false);
    clearSavedTimeout();
  };

  return (
    <div className="space-y-6">
      <form action={saveExchangeEmailSettingsAction} className="space-y-6">
        <PageHero>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Settings</p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-950 dark:text-slate-100">Exchange Email Service</h1>
              <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
                Configure Microsoft Graph application mail for immediate borrowed-item and returned-item notifications.
              </p>
            </div>
            <ExchangeHeaderActions isDirty={isDirty} isSaved={isSaved} />
          </div>
        </PageHero>

        {initialError ? <div className={warningClassName}>{initialError}</div> : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <PanelCard className="p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">General</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-100">Service configuration</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Store Microsoft 365 app mail settings here. The Client Secret is encrypted before database storage.</p>
            </div>

            <div className="mt-5 space-y-4">
              <ToggleField
                checked={mailEnabled}
                description="When off, borrowing and return workflows do not attempt email notifications."
                label="Enable Email Notifications"
                name="mailEnabled"
                onChange={(checked) => {
                  clearSavedState();
                  setMailEnabled(checked);
                }}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <FieldLabel>
                  <FieldLabelText>Tenant ID</FieldLabelText>
                  <TextField
                    name="tenantId"
                    onChange={(event) => {
                      clearSavedState();
                      setTenantId(event.target.value);
                    }}
                    placeholder="00000000-0000-0000-0000-000000000000"
                    value={tenantId}
                  />
                </FieldLabel>
                <FieldLabel>
                  <FieldLabelText>Client ID</FieldLabelText>
                  <TextField
                    name="clientId"
                    onChange={(event) => {
                      clearSavedState();
                      setClientId(event.target.value);
                    }}
                    placeholder="00000000-0000-0000-0000-000000000000"
                    value={clientId}
                  />
                </FieldLabel>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/95 px-3.5 py-3 dark:border-[#4b5255] dark:bg-[#2f3437]/90">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <FieldLabel className="w-full">
                    <FieldLabelText>Client Secret</FieldLabelText>
                    <TextField
                      autoComplete="new-password"
                      name="clientSecret"
                      onChange={(event) => {
                        clearSavedState();
                        setClientSecret(event.target.value);
                      }}
                      placeholder={settings.credentialStatus.clientSecretConfigured ? "Leave blank to keep the existing secret" : "Enter Client Secret"}
                      type="password"
                      value={clientSecret}
                    />
                  </FieldLabel>
                  <Button
                    disabled={!settings.credentialStatus.clientSecretConfigured}
                    onClick={() => setIsClearSecretOpen(true)}
                    type="button"
                    variant="secondary"
                  >
                    Clear Client Secret
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  <span>{settings.credentialStatus.clientSecretConfigured ? "Client Secret is configured. Enter a new value only when replacing it." : "Client Secret is not configured."}</span>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <FieldLabel>
                  <FieldLabelText>Sender Mailbox</FieldLabelText>
                  <TextField
                    name="senderMailbox"
                    onChange={(event) => {
                      clearSavedState();
                      setSenderMailbox(event.target.value);
                    }}
                    placeholder="it-assets@example.org"
                    type="email"
                    value={senderMailbox}
                  />
                </FieldLabel>
                <FieldLabel>
                  <FieldLabelText>Administrative Notification Recipient</FieldLabelText>
                  <TextField
                    name="adminRecipient"
                    onChange={(event) => {
                      clearSavedState();
                      setAdminRecipient(event.target.value);
                    }}
                    placeholder="it-notifications@example.org"
                    type="email"
                    value={adminRecipient}
                  />
                </FieldLabel>
              </div>
              <div className={noteClassName}>
                The administrative recipient can be any deliverable email address. The app does not inspect whether it is a distribution list, group, shared mailbox, or user mailbox.
              </div>
            </div>
          </PanelCard>

          <PanelCard className="p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Credential status</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-100">Configuration readiness</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Secret and encryption-key values are never displayed here.</p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <CredentialStatus configured={settings.credentialStatus.tenantIdConfigured} label="Tenant ID" />
              <CredentialStatus configured={settings.credentialStatus.clientIdConfigured} label="Client ID" />
              <CredentialStatus configured={settings.credentialStatus.clientSecretConfigured} label="Client Secret" />
              <CredentialStatus configured={settings.credentialStatus.encryptionKeyConfigured} label="Encryption Key" />
            </div>
            <div className="mt-4 rounded-2xl border border-[#f2c28c]/70 bg-[rgba(246,150,41,0.08)] px-3.5 py-3 text-xs text-slate-700 dark:border-[#7f5a2d]/80 dark:bg-[rgba(246,150,41,0.12)] dark:text-slate-200">
              Required server variable: `APP_SETTINGS_ENCRYPTION_KEY`. Tenant ID, Client ID, Client Secret, and sender mailbox are managed in this page.
            </div>
          </PanelCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <PanelCard className="p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Borrower Notifications</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-100">User messages</h2>
            <div className="mt-5 space-y-3">
              <ToggleField checked={notifyBorrowerOnBorrow} label="Send email when an item is borrowed" name="notifyBorrowerOnBorrow" onChange={(checked) => { clearSavedState(); setNotifyBorrowerOnBorrow(checked); }} />
              <ToggleField checked={notifyBorrowerOnReturn} label="Send email when an item is returned" name="notifyBorrowerOnReturn" onChange={(checked) => { clearSavedState(); setNotifyBorrowerOnReturn(checked); }} />
            </div>
          </PanelCard>

          <PanelCard className="p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Administrative Notifications</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-100">Admin recipient messages</h2>
            <div className="mt-5 space-y-3">
              <ToggleField checked={notifyAdminOnBorrow} label="Notify administrative recipient when an item is borrowed" name="notifyAdminOnBorrow" onChange={(checked) => { clearSavedState(); setNotifyAdminOnBorrow(checked); }} />
              <ToggleField checked={notifyAdminOnReturn} label="Notify administrative recipient when an item is returned" name="notifyAdminOnReturn" onChange={(checked) => { clearSavedState(); setNotifyAdminOnReturn(checked); }} />
            </div>
          </PanelCard>
        </div>
      </form>

      <PanelCard className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Send Test Email</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-100">Validate Microsoft Graph mail</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Send a simple test message from the configured sender mailbox.</p>
          </div>
          <Send className="h-5 w-5 text-[#b56613] dark:text-[#ffd1a0]" aria-hidden="true" />
        </div>
        <form action={testAction} className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <FieldLabel>
            <FieldLabelText>Test recipient</FieldLabelText>
            <TextField name="testRecipient" placeholder="recipient@example.org" required type="email" />
          </FieldLabel>
          <div className="flex items-end">
            <Button disabled={testPending} type="submit">{testPending ? "Sending..." : "Send test email"}</Button>
          </div>
        </form>
        {testState.message ? (
          <div className={testState.ok ? "mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200" : "mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"}>
            {testState.message}
          </div>
        ) : null}
      </PanelCard>
      {isClearSecretOpen ? (
        <ClearClientSecretDialog action={clearClientSecretAction} onClose={() => setIsClearSecretOpen(false)} />
      ) : null}
    </div>
  );
}
