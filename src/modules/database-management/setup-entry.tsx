"use client";
import { useState } from "react";
import { wizardSteps } from "./setup-steps";
import { SetupWizardShell } from "@/components/layout/setup-wizard-shell";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/forms/text-field";
import { Form } from "./action-form";

export function SetupEntry({
  registered,
  message,
}: {
  registered: boolean;
  message?: string;
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
      description="One guided installation. Your local administrator and configuration work before an asset database is connected."
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
              <p className="text-sm">
                Use the theme toggle to preview light or dark mode. Default IT
                Assets logos are included; custom workspace branding can be
                configured after workspace sign-in.
              </p>
              <p className="text-sm">
                These settings are saved locally with administrator enrollment
                in the next step. No asset database is required.
              </p>
            </div>
            <p hidden={step !== 2} className="text-sm">
              Read the private bootstrap-token file in the control directory
              printed by the launcher. Paste it only here. Enrollment consumes
              it permanently.
            </p>
          </>
        )}
        <div hidden={!registered && step !== 2} className="space-y-4">
          <p className="text-sm">
            This account manages the installation and database connections. It
            does not grant access to workspace assets.
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
