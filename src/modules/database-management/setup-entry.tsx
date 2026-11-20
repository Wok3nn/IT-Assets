"use client";
import { useState } from "react";
import { wizardSteps } from "./setup-steps";
import { SetupWizardShell } from "@/components/layout/setup-wizard-shell";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/forms/text-field";
import { Form } from "./action-form";
import { SettingsHelp } from "./settings-section";
import { EnrollmentHelp } from "./enrollment-help";
import type { enrollmentGuidance } from "./enrollment-guidance";

export function SetupEntry({
  registered,
  message,
  guidance,
  returnStep,
}: {
  registered: boolean;
  message?: string;
  returnStep?: string;
  guidance?: ReturnType<typeof enrollmentGuidance>;
}) {
  const [step, setStep] = useState(1),
    [navigationMessage, setNavigationMessage] = useState(""),
    [siteName, setSiteName] = useState(""),
    [appTitle, setAppTitle] = useState("IT Assets");
  return (
    <SetupWizardShell
      steps={wizardSteps}
      currentStep={registered ? 2 : step}
      onStep={(next) => {
        if (registered) {
          setNavigationMessage("Sign in to review your saved setup steps.");
          return;
        }
        if (next === 1) setStep(1);
        else if (siteName.trim().length >= 2 && appTitle.trim().length >= 2) setStep(2);
      }}
      description="Name your installation, create an administrator and connect a database."
    >
      {message && <p role="status">{message}</p>}
      {navigationMessage && <p role="status">{navigationMessage}</p>}
      <h2 className="text-2xl font-semibold">
        {registered
          ? "Local administrator sign-in"
          : step === 1
            ? "Welcome & Organization"
            : "Installation Administrator"}
      </h2>
      <Form op={registered ? "login" : "enroll"}>
        {registered && /^[1-5]$/.test(returnStep ?? "") && <input type="hidden" name="returnStep" value={returnStep} />}
        {!registered && (
          <>
            <div hidden={step !== 1} className="space-y-4">
              <label className="block">
                Organization / site name
                <TextField
                  name="siteName"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={120}
                />
              </label>
              <label className="block">
                Initial application name
                <TextField
                  name="appTitle"
                  value={appTitle}
                  onChange={(e) => setAppTitle(e.target.value)}
                  required
                  minLength={2}
                  maxLength={80}
                />
              </label>
              <SettingsHelp label="About your installation name">
                <p>Names are saved when you create the administrator in the next step. No database is needed.</p>
                <p>Default logos are included. Change appearance later in Database Connection or Settings.</p>
              </SettingsHelp>
            </div>
          </>
        )}
        <div hidden={!registered && step !== 2} className="space-y-4">
          <p className="text-sm">
            This account manages IT Assets installation and database connections.
          </p>
          {!registered && (
            <label className="block">
              One-time enrollment token
              <TextField
                name="bootstrap"
                type="password"
                autoComplete="off"
                required
              />
            </label>
          )}
          {!registered && guidance && <EnrollmentHelp guidance={guidance} />}
          <label className="block">
            Administrator email
            <TextField
              name="email"
              type="email"
              autoComplete="username"
              required
              maxLength={191}
            />
          </label>
          <label className="block">
            {registered ? "Password" : "New password (14–128 characters)"}
            <TextField
              name="password"
              type="password"
              autoComplete={registered ? "current-password" : "new-password"}
              minLength={registered ? undefined : 14}
              maxLength={128}
              required
            />
          </label>
          {!registered && (
            <label className="block">
              Confirm password
              <TextField
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={14}
                maxLength={128}
                required
              />
            </label>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="submit">
              {registered ? "Sign in" : "Register administrator"}
            </Button>
          </div>
        </div>
      </Form>
      {!registered && <nav aria-label="Wizard navigation" className="mt-6 flex justify-between gap-3 border-t border-[#d8c6b2] pt-5 dark:border-[#596166]">
        {step === 2 ? <Button type="button" variant="secondary" onClick={() => setStep(1)}>Back</Button> : <span />}
        <Button type="button" disabled={step === 2 || siteName.trim().length < 2 || appTitle.trim().length < 2} onClick={() => setStep(2)}>Next</Button>
      </nav>}
    </SetupWizardShell>
  );
}
