# First-run setup UI simplification — 2026-11-20

This is a presentation refactor of v0.6.0, not a database-management migration.
The original five-step wizard, dark theme and installation/workspace identity boundary
remain. No new route or wizard was added.

## Workflow

1. Name the organization and application.
2. Create or sign in as the Installation Administrator.
3. Add/test a SQL Server or MariaDB connection. Open **Existing database settings**
   to review imported configuration or edit shared settings while inventory is offline.
   **Manage an existing database** opens this section within the same wizard.
4. Prepare the selected empty database or reuse compatible inventory.
5. Activate, verify readiness and sign in to the workspace.

Settings actions return to Step 3 with the settings section open. Existing management
deep links still work, including independent offline administrator sign-in after setup.
Import preparation remains the existing explicit offline operator workflow; the UI does
not silently capture database settings or add a new database-reading action.

## Wording and interaction

| Before | After |
| --- | --- |
| Defer setup and manage this installation | Manage an existing database |
| Installation appearance and session policy | Appearance & session |
| Microsoft Entra installation credentials | Microsoft Entra sign-in |
| Installation Exchange email transport | Email settings |
| Installation timezone | Timezone |
| Captured configuration reviews | Import existing settings |
| Keep current installation configuration | Keep current settings |
| Use captured profile configuration | Use existing database settings |
| Type ENABLE / APPLY SNAPSHOT / RESTORE | Explicit unchecked approval and a named action |

Panels show a title and enabled/review status; forms and longer explanations are
collapsible. Native details/summary controls support click, keyboard and touch without
hover. Reviews identify the current setup, captured database/provider/server, imported
application name and capture time. The optional comparison explicitly labels values at
capture time. Its scrollable region is keyboard-focusable and stays inside the panel on
mobile. Database activation and empty initialization retain database-name confirmation.

## Reused components

`SetupWizardShell`, `PanelCard`, `DatabasePanel`, `ConnectionFields`, `Form`, `Field`,
`Button`, `ActivationDialog`, readiness panels and the existing configuration panels are
reused. `InstallationSettings` composes those panels for both routes. Feature-local
`SettingsSection`, `SettingsHelp` and `SettingsApproval` provide consistent disclosures
and approvals. Shell width/padding fixes belong to `SetupWizardShell`, not route props.
The permanent concise-interface guideline is recorded in `architecture.md`.

## Security and compatibility

- Same origin checks, administrator session checks and action authorization.
- Checkboxes submit the existing confirmation values only when selected. Server checks
  remain mandatory; previous clients using typed values remain compatible.
- Same review IDs, encryption, baseline/version checks, rollback rules and storage schema.
  Public review data adds only nonsecret source/title labels; rendering does not write or
  invalidate reviews. No existing acceptance review was opened or modified.
- Workspace users, roles, session isolation, redirects, database selection, Entra/Graph
  credential persistence and initialization guards are unchanged.

## Validation

- Application suite: 80 passed, one existing POSIX image-permission fixture skipped on Windows.
- Typecheck, lint and managed build passed.
- Isolated managed HTTP tests passed: enrollment, session boundaries, offline SQL failure,
  integrated controls, missing approval rejection, stale save rejection, pending review
  preservation across refresh/navigation/deep links, synthetic review import and rollback.
- Existing unit tests cover stale reviews, encrypted rollback, authorization and activation
  revision/readiness checks. No real database activation was performed for this UI change.
- Disposable browser fixture: dark-theme desktop (1280×900) and mobile (390×844), Step 3
  navigation, Enter-operated help, Space-operated approval and native required-checkbox
  validation. Mobile comparison overflow found and corrected; no page overflow remained.
- Both isolated test servers stopped. No existing database, Docker volume, acceptance
  baseline, Astra/staging/production deployment or saved development control store changed.

Remaining acceptance: compare against `Changes needed.pdf` pages 1–3 (not present in the
provided attachments), screen-reader/physical touch-device checks, and the full Docker
upgrade rehearsal with real provider connections and approved Entra/Graph workflows.
No push or deployment is part of this change.
