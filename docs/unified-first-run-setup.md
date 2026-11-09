# Unified first-run setup — Phase 2 delivery

Implemented from approved Phase 1 commit `4a7d54a` on
`feature/unified-first-run-setup`. No push. Existing `IT-Assets_DEV`, existing
development MariaDB and their saved control configuration were not accessed.

## User workflow

Start IT Assets → `/setup` → Organization → Installation Administrator → Database
Connection → Workspace Preparation → Review & Complete → Go to IT Assets.

The original wizard's gradient, rounded frame, cards, typography, logo and theme
toggle are shared through `SetupWizardShell`. Legacy setup uses that same shell
and retains its original API. `/installation` and managed `/setup/db` redirect to
`/setup`; authenticated steps live under `/setup/workspace`. Enrollment consumes
the private one-time token and permanently closes registration. Organization and
initial application name are committed with enrollment, without an asset database.
Before enrollment these values are a form draft; refresh can discard that draft.

Save a SQL Server or MariaDB profile, then use **Test Connection & Inspect Schema**.
The shared Add Connection form collapses after saving. Non-secret form values are
retained after validation errors; passwords are cleared. Saved passwords are never
rendered. Inactive profiles can be edited or removed. Changing a target requires
credentials again and invalidates inspection evidence. Profile inspection labels
describe the last check, not a promise of current availability.

- Empty: explicit Initialize Database, separate workspace credentials with password
  confirmation, and exact typed database name. The server rechecks emptiness before
  DDL and checks compatibility afterward. Organization/title are applied only here.
- Compatible: reuse existing workspace; no initialization, new administrator, data
  migration or branding changes. Existing workspace credentials are required.
- Partial/incompatible: blocked. No force/reset/migration-repair action.

Activation rechecks compatibility and fences the selection revision before the
supervisor drains and restarts the child. Completion requires the matching child
generation/revision/profile, a live connection probe and compatible workspace.
Status checks run every ten seconds while the completion panel is open; schema
inspection repeats at least every minute, and after generation/profile/schema
changes or readiness lease expiry. Checks never retry initialization. A temporary
restart interruption shows pending rather than success. The congratulations panel
includes organization and active profile/provider/database, with Go to IT Assets.
Normal inventory use does not repeatedly visit that panel.

## Navigation, identities and compatibility

Database Management uses the actual `AppShellClient` sidebar presentation, including
collapse, active navigation and mobile links. `ControlShell` supplies local metadata
without the inventory branding/permission queries in `AppShellRoot`. The competing
InstallationShell, SetupOverview and navigation implementation are removed.

Each new management entry requires installation sign-in. Step navigation remains in
the same visit; exit/logout revokes it server-side without deleting workspace cookies.
One-hour hashed sessions, origin validation, HttpOnly/SameSite cookies, version/revision
checks and serialized database operations remain. Page departure sends a revocation
beacon and restored history pages recheck access. Browser termination cannot guarantee
beacon delivery; server expiry and fresh-entry revocation remain authoritative.
Full reload may require sign-in again; durable configuration resumes afterward.
The installation identity never gains workspace permissions.

The local `setup_record` table is an additive transactional format-1 upgrade. Existing
operators, encrypted profiles, key, sessions and selection survive. Missing organization
metadata can be completed from authenticated setup; it does not force a working
inventory back into first-run setup. Before deployment, stop the application and back
up the entire private control directory, including the key and SQLite sidecar files.
Do not replace the selection database with an old backup while a process is serving.
There are no asset schema/migration changes. Legacy environment-based startup stays
available through `npm run dev:legacy` and its established deployment commands.

Branding here supports the initial name and existing light/dark toggle/default logos.
Custom workspace branding remains in workspace settings. MariaDB TLS capabilities
are unchanged; the trust-self-signed checkbox is for SQL Server development only.
No new Windows service installer or managed reminder worker is introduced.

## Exact safe fresh-install test on Windows

Stop the current server with Ctrl+C. In a dedicated PowerShell terminal:

```powershell
Set-Location C:\Projects\MyApps\It-Assets-Tracker
$originalControlDir = $env:IT_ASSETS_CONTROL_DIR
$testControlDir = Join-Path $env:LOCALAPPDATA ('ITAssets-SetupTest-' + [guid]::NewGuid().ToString('N'))
$env:IT_ASSETS_CONTROL_DIR = $testControlDir
npm run dev
```

Use the Node version documented in README. If dependencies are missing, run `npm ci`
before launch. This creates a new control directory; it does not rename, delete or
open the original control store. The launcher uses an explicit offline asset URL
until a profile is selected, so an existing MariaDB `.env` cannot select that database.

1. Open `http://localhost:4050/setup`. Enter a test organization and application name.
2. In a second local terminal, read `bootstrap-token` under the exact test directory
   printed by the launcher. Keep the token private. Enroll and sign in with a separate
   test installation account (password 14–128 characters).
3. Save a profile for a **new, separately provisioned disposable database**. Never use
   `IT-Assets_DEV` or the existing MariaDB database for this test. See the SSMS and TLS
   preparation in [database management](database-management.md).
4. Test Connection & Inspect Schema. Continue only if empty. If partial/unrelated,
   stop and select another empty database; do not reset it through the application.
5. Initialize explicitly with test workspace credentials and the exact database name.
   Wait for compatible inspection. Do not resubmit after a lost response: inspect first.
6. Review & Complete → Activate this inventory → type its exact name → Activate database.
   Wait for the automatic restart and current readiness checks. If asked, sign back into
   setup; configuration and progress are durable.
7. Verify congratulations, then Go to IT Assets and sign in with workspace credentials.
   Create a disposable asset, restart using the same test directory and check persistence.
8. From Settings → Database Management, verify a fresh installation login is required.
   For compatible-reuse testing, save this same disposable database in another fresh
   test control directory. Inspect and activate without initialization. Confirm the
   existing asset, workspace user and branding remain unchanged.

SQL Server initialization should be retried only after read-only inspection establishes
that the chosen disposable target is empty. A compatible result means activate/reuse;
a partial result requires investigation, never automatic retry. For diagnostic codes
and the original Prisma lock-provider correction, see
[SQL Server diagnostics](sqlserver-initialization-diagnostics.md).

### Restore the existing development configuration

Stop the test server with Ctrl+C. In the **same dedicated terminal**:

```powershell
if ($null -eq $originalControlDir) {
  Remove-Item Env:IT_ASSETS_CONTROL_DIR -ErrorAction SilentlyContinue
} else {
  $env:IT_ASSETS_CONTROL_DIR = $originalControlDir
}
npm run dev
```

This returns to the original environment selection (the default is `.managed-data`).
If the terminal was closed, use a new terminal with the original launch configuration;
the temporary override was process-local. Keep the test directory for later isolated
testing. No cleanup, database deletion or original-config reset is needed.

Managed production: `npm run build:managed`, then `npm run start:managed` using the
intended control directory. Compose restart: `docker compose -f docker/compose.managed.yml
restart web` (single line). No VM/OS/Docker-daemon restart is needed. An administrator
who installed a custom Windows service should use that service's own restart procedure.

## Validation executed

Windows host, Node 26.13.0, Prisma/client 6.19.2:

| Check | Result |
| --- | --- |
| `npm test` | 23 passed: enrollment, session boundaries, encrypted profiles, revisions, local upgrade, organization persistence and readiness negative cases, plus existing regression tests |
| `npm run typecheck`, `npm run lint` | Passed |
| Prisma validate for SQL Server and MariaDB | Passed with explicit unreachable local URLs; no database access |
| `npm run build:managed` | Passed; initial sandbox output-directory EPERM resolved by rerunning with filesystem approval |
| Legacy `npm run build` | Passed with explicit offline MariaDB URL |
| Disposable MariaDB lifecycle | Passed: empty initialization, partial/unrelated rejection, independent inventories, asset operations, switching and rollback selection |
| Managed HTTP suite, compatible-reuse fixture | Passed: offline entry, enrollment, session separation, credential redaction, activation/restart, current readiness, workspace sign-in, stale-write rejection |
| Managed HTTP suite, fresh fixture | Passed including explicit initialization, repeat refusal and post-restart readiness |
| Browser, isolated offline control | Passed: welcome-to-admin transition, local sign-in/resume, saved connection collapse, pending checklist, shared sidebar/collapse, 390px mobile navigation without overflow, sign-out and Back protection |

The private MariaDB instance used fresh datadirs, random credentials and loopback port
43328; its three databases were dedicated disposable fixtures. It and all test web
servers were stopped afterward. Existing saved profiles were not used. Build warnings
about old Browserslist data and Node's module.register deprecation remain unrelated.

Unverified in this phase: live SQL Server DDL/CRUD/activation (owner previously reported
success on the earlier integration), Docker runtime, Node 24 runtime matrix, process
crash/OS-level interrupted DDL fault injection, exhaustive concurrent-tab behavior,
legacy browser/database end-to-end, and browser display of the live congratulations
state. The latter's backend predicate and real MariaDB restart are HTTP-tested.
No successful SQL Server or Docker result is inferred from MariaDB tests.

To rerun offline HTTP checks: stop any server on 4050, run `npm run build:managed`,
then `npm run test:managed-http`. The script makes its own temporary control directory.
Disposable database tests are `npm run test:managed-db`; provision the dedicated test
databases and environment described in [database management](database-management.md)
first. `IT_ASSETS_TEST_MARIA_PORT` can select a private loopback instance.
`IT_ASSETS_HTTP_FIXTURE=1` enables compatible fixture HTTP checks;
`IT_ASSETS_HTTP_INITIALIZE=1` selects the separately empty `c_test` fixture. Never point
these tests at an existing development or production database.

## Changed file groups

- Routes: managed setup entry/workspace/status, aliases, Database Management entry/workspace.
- Shared UI: SetupWizardShell and AppShellClient; legacy wizard composes the shared frame.
- Control feature: control-store, setup-state/service, actions, action-form, setup-entry,
  organization-form, setup-steps, panel, readiness-panel, control-shell, visit-guard.
- Runtime: managed-start, managed-web, management-boundary and bootstrap.server guards.
- Bootstrap: schema-service applies organization only to an explicit new workspace.
- Tests: unified-setup, managed-setup-ui and test-managed-http.
- Documentation: README, architecture, database-management, prior UX and approved plan,
  this implementation guide. Retired competing shell/overview/navigation are removed.

Scope adjustments from Phase 1: setup domain stays in the existing database-management
module; the existing AppShellClient is reused directly. Draft organization is saved
atomically at enrollment. These avoid duplicate domains and preserve authorization.
