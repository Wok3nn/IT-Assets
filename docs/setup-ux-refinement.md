# First-run wizard and Database Management UX — Phase 3

Implemented on `feature/setup-ux-refinement`, based on Phase 2 commit `7cb4b31`.
This phase changes presentation, navigation and validation feedback. Provider clients,
migration histories, encryption, enrollment, initialization safeguards and activation
revision fencing retain their Phase 2 behavior.

## Wizard behavior

`/setup` remains the canonical database-independent entry. No overview precedes it.
Fresh enrollment retains the one-time bootstrap token and password confirmation.
Organization drafts are saved atomically with enrollment; an authenticated operator
can review and save local organization settings independently afterward. Existing
workspace branding is never changed by saving these local settings.

`/setup/workspace?step=1` through `step=5` use the original shared wizard frame.
The five left cards are the only step selector: keyboard-accessible controls, orange
current state, green completed checks and neutral pending states. Server-side step
gates require saved organization, local authentication, current profile/schema evidence
and activation. Direct URLs cannot bypass these gates. Before enrollment/sign-in,
cards stay within the prerequisite organization/administrator flow.

| Step | Content and progression |
| --- | --- |
| 1 — Organization | Review/save installation names; success feedback and Next. Existing workspace branding is preserved. |
| 2 — Administrator | Authenticated confirmation and administrator email, without credentials or repeated registration. Workspace identities remain separate. |
| 3 — Connection | Compact active summary, saved connections, collapsible Add a connection, field errors, combined read-only test/inspection. The most recently inspected/saved candidate is selected for preparation; inspect the desired saved connection to select it. Next requires empty or compatible evidence for that profile version/schema. |
| 4 — Preparation | Only the selected connection. Empty-only initialization with separate workspace credentials and exact database-name confirmation; compatible workspace preservation and activation; green active confirmation. No repeated connection list or editing forms. |
| 5 — Complete | Eight-item backend readiness checklist. At most six checks, five seconds between checks, with an eight-second request deadline. A failed batch offers Retry verification. Congratulations and Go to IT Assets appear only after current readiness is verified. |

Steps 1–4 have Back/Next navigation (Back omitted at the start). Enrollment retains
its explicit Register administrator action and Next remains unavailable until enrolled
and authenticated. Step 5 has Back for review and the verified workspace handoff.
Sign out of setup remains beside the theme control, outside primary step content.
Readiness uses the existing `/setup/status` service; a successful check refreshes the
server-rendered completion indicator. It never initializes or repairs a database.

## Settings and authentication

`/settings/database-management` shows an independent installation administrator login.
`/settings/database-management/workspace` requires a valid management visit and renders
connections, initialization/activation and activity, without wizard/review content.

`ManagementShell` reuses **AppShellRoot and AppShellClient**, including workspace
branding, role-filtered navigation, sidebar collapse preference and theme controls.
A valid workspace session sees the actual normal sidebar both before and after local
administrator authentication. No workspace role grants database-management authority.

When the database/session cannot supply the normal shell, the same AppShellClient
uses the existing local ControlShell adapter. With no active database, it exposes
only database-independent destinations, omits Settings and avoids workspace logout.
Routes remain outside the dashboard layout so recovery can still render during an outage.

Back to Settings and management logout revoke only the management visit. Ordinary
sidebar departures use a document navigation through the existing server revocation
boundary, including destinations that Next previously cached. The existing fingerprint
beacon, no-store responses, server action guards and Back/history protection remain.
Workspace login survives management departure; explicitly switching databases retains
the existing behavior of ending asset sessions for that activation.

## Changed routes and components

- `/setup/workspace`: route orchestration and mandatory step gates.
- `/settings/database-management` and its `/workspace`: independent login/management
  content composed inside `ManagementShell`.
- `components/layout/setup-wizard-shell.tsx`: accessible card navigation, current and
  completed states, managed form width and auxiliary footer; legacy frame preserved.
- `components/navigation/app-shell.client.tsx`: database-independent fallback actions.
- `modules/database-management`: wizard progress/footer, setup entry, readiness panel,
  management shell, shared database forms, field error feedback, selected preparation,
  administrator email display, action return steps and visit departure handling.
- Tests: `tests/managed-setup-ui.test.ts`, `tests/unified-setup.test.ts` and the expanded
  `scripts/test-managed-http.mjs` (including the real workspace sidebar/session checks).

## Validation — 2026-11-10

| Check | Result |
| --- | --- |
| Automated unit/regression suite | 25 passed; includes step gates and accessible single card navigation |
| Typecheck and lint | Passed |
| Managed production build | Passed with explicit offline database URL |
| Legacy production build | Passed with explicit offline MariaDB URL |
| Offline HTTP suite | Passed: routing, enrollment, email confirmation, gated step URLs, form collapse markup, independent auth, server exit, redaction and unreachable SQL recovery |
| Disposable MariaDB lifecycle | Passed: initialization, partial/unrelated rejection, CRUD, independent inventories and switching |
| Compatible-reuse HTTP flow | Passed: inspection, activation, restart readiness, workspace sign-in, sidebar before/after management auth, departure revocation and surviving workspace session |
| Empty-database HTTP flow | Passed: explicit initialization, repeat refusal, activation, restart and the same readiness/session checks |
| Browser | Passed: initial organization/administrator navigation and keyboard activation; live ready checklist and workspace handoff; actual sidebar before/after management sign-in; collapse preference; inline validation and saved-form collapse; Settings departure and Back protection; preserved workspace login; light/dark presentation |
| Responsive browser | Desktop 1440px, tablet 768px, mobile 390px; tested wizard and management layouts without horizontal document overflow |

All live database checks used a new private MariaDB 11.4.9 data directory, random
credentials, loopback port 43329, and `it_assets_managed_ux3{a,b,c}_test`. HTTP tests
created new temporary control stores. Browser testing reused only the just-created
HTTP fixture. All test web/MariaDB servers were stopped. The original `.managed-data`,
its pre-existing backup, saved development configuration, `IT-Assets_DEV`, and development
MariaDB were not opened or modified. No push was performed.

Live SQL Server DDL/CRUD, Docker, broader crash/interrupted-DDL fault injection,
exhaustive concurrent-tab behavior and the Node runtime matrix remain unverified.
SQL Server's unreachable-target handling and provider migration regression tests are
covered; these are not claims of a live SQL Server acceptance test. Existing Node
module.register and old Browserslist warnings remain.

## Safe owner test with an existing compatible development database

These are instructions for an owner-authorized test, not actions performed in this phase.

1. Back up the intended database and stop the current app. Use a dedicated terminal
   with a **new** `IT_ASSETS_CONTROL_DIR`, following the exact isolation and restoration
   commands in [the Phase 2 guide](unified-first-run-setup.md#exact-safe-fresh-install-test-on-windows).
   Keep the original directory/configuration intact.
2. Enroll a test installation administrator. Add the intended existing database's
   connection details manually. Confirm its exact server, port and database name.
3. Choose **Test Connection & Inspect Schema**. This is read-only. Continue only if
   it reports **Compatible**. If empty, partial, incompatible or disconnected, stop
   and investigate the target; do not initialize, reset, migrate, seed or repair it.
4. Next → Workspace Preparation → **Activate Database**, with exact database-name
   confirmation. Initialization is unnecessary and must not be selected. Activation
   preserves existing accounts, assets and branding but switches the selected backend
   and ends asset sessions under the existing activation behavior.
5. Next → Review & Complete. Wait for verified congratulations, then Go to IT Assets.
   Sign in with an **existing workspace account**, not the installation account.
   Normal workspace use may write sessions/audit; this is not a wholly read-only test.
6. Verify existing records/branding. In Settings → Database Management, check fresh
   local login, the original sidebar, Back to Settings, and workspace session survival.
7. Stop the test server and restore the process-local control-directory override using
   the Phase 2 restoration instructions. Keep the isolated directory for later tests;
   no reset or deletion of an existing database is needed.

To rerun automated checks, use `npm test`, `npm run typecheck`, `npm run lint`,
`npm run build:managed`, and `npm run test:managed-http`. Provision only the dedicated
blank fixtures described in [database management](database-management.md) before
`npm run test:managed-db`. The HTTP fixture flags and restoration commands remain
documented in the [Phase 2 guide](unified-first-run-setup.md).
