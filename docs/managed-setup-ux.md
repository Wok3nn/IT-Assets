# Managed setup and management visits

Historical implementation review. The separate installation shell described below
has been retired by [unified first-run setup](unified-first-run-setup.md). `/setup`
now owns first-run entry and the existing application sidebar presentation is shared
with Database Management. The authentication and offline-boundary safeguards remain.

## Review before implementation

The verified starting point is commit 65f5177. The owner reports successful SQL
Server initialization, activation, asset creation and restart persistence. This
task will not connect to, initialize or modify that database or the existing MariaDB.

- `/settings/database-management` lives outside the dashboard route group. This
  avoids `AppShellRoot`, which queries asset branding, roles and navigation grants.
  Its route-owned `max-w-4xl` wrapper causes the narrow standalone presentation.
- ControlStore authenticates a local installation operator; random tokens are
  stored as SHA-256 digests with a fixed one-hour lifetime in SQLite. The cookie is
  HttpOnly, SameSite Strict, Secure on HTTPS, scoped to the management path.
  Leaving currently does not revoke it; returning silently restores the panel.
- Workspace authentication uses the selected inventory's users, roles and sessions.
  Its cookie realm/revision changes on activation. Control authentication grants
  no inventory role. Merely opening management must not change inventory cookies.
- Home, login, dashboard routes (assets, users, settings, loans, labels, locations,
  categories, scopes and patch notes) require the asset backend. Their bootstrap
  guard currently redirects an unconfigured installation to management. Inventory
  APIs have bootstrap guards and the central database proxy fails closed without
  an active profile at the process revision; no empty inventory is fabricated.
- First launch creates a private control directory and one-time bootstrap-token.
  Enrollment consumes that token, but currently lacks a welcoming setup overview.
- Managed startup pins explicit offline environment defaults, generates clients,
  reads only the selected profile and supervises activation restarts. Legacy
  startup/setup still uses environment-based MariaDB and its original setup flow.
- Safe tests require a new control directory, the same port 4050 with no competing
  server, and no saved live profile. A compatible existing database is connected
  through Save → Test → Inspect → Activate, never Initialize. Full schema tests
  require a separately provisioned disposable database.

## Implementation stages

1. Separate entry/login from authenticated management, rotate credentials on login,
   revoke visits on entry/exit, preserve server action authorization and CSRF checks.
   Add no-store responses and browser history revalidation as defense in depth.
2. Add a database-independent responsive shell and installation overview, using
   shared PageHero/PanelCard/Button primitives. Only show usable offline links.
3. Extend isolated unit/HTTP tests, run lint/types/build, then document safe local
   first-run testing and restoration. No live database operations or destructive reset.

## Authentication and navigation

The entry URL remains `/settings/database-management`; it always shows enrollment
or fresh sign-in, never restores the panel from an old cookie. Authenticated work
lives at `/settings/database-management/workspace`. Login revokes the previous
token before issuing a new one. The new HttpOnly, SameSite Strict cookie is scoped
to `/` so the managed HTTP boundary can revoke it on navigation away. It is Secure
when APP_URL uses HTTPS; local loopback HTTP remains supported. Tokens still have
a fixed one-hour server-side expiry. Old path-scoped cookie names are not accepted.

Explicit Back/Settings/Sign Out forms revoke the management session on the server.
The managed request boundary also revokes it on entry and on document/RSC navigation
outside management, before rendering the destination. Prefetches do not revoke a
visit or load management data. Management requests use no-store responses. Every
management action retains origin checks and control-store authorization. Existing
activation revision/profile-version checks and empty-only initialization are unchanged.

The client additionally hides a departing document, sends a same-origin revocation
beacon, validates on focus/periodically and forces fresh entry on bfcache restoration.
A full browser reload can end the visit; normal hydrated form interactions retain
it. Browser termination/offline departure cannot guarantee beacon delivery; the
server expiry and fresh-entry rule remain the security boundary. Browser tabs share
the management cookie, so entry/exit in one tab can require reauthentication in another.
No browser mechanism can erase content already viewed or copied. Replayed actions
with revoked/expired sessions are denied regardless of what a cached page displays.

The setup overview `/installation` and its responsive shell depend only on local
control state. It discloses no saved profile details or credentials. Before activation
it offers setup guidance and management entry, not inventory pages. Authenticated
management shows the selected database/provider and provides explicit exits to
inventory/Settings when selected. These links do not grant a workspace role; normal
workspace authorization still applies. Availability here means a profile is selected,
not an automatic connectivity probe. Existing database outages do not prevent setup.

## Safe fresh-install test on Windows

Use a private local control directory, never delete or rename the original one.
Stop the current supervisor with Ctrl+C first: both runs use port 4050. In the same
PowerShell terminal, save the original environment override and create a new one:

```powershell
Set-Location C:\Projects\MyApps\It-Assets-Tracker
$previousControlDirectory = $env:IT_ASSETS_CONTROL_DIR
$freshControlDirectory = Join-Path $env:LOCALAPPDATA ("ITAssets\SetupTests\" + [guid]::NewGuid())
$env:IT_ASSETS_CONTROL_DIR = $freshControlDirectory
npm run dev
```

The launcher creates a fresh control store and prints only the token file location.
Open http://localhost:4050: expect Welcome to IT Assets and no connected database.
Enroll through Database Management using the token read privately from that new
directory (never paste it into chat or logs). Use a unique test administrator.
Enrollment consumes the token. Sign in and verify the setup shell, no connected
inventory, connection forms and visible exit/sign-out actions. Exit, return and
verify a fresh password is required; Back must not permit authorized operations.
Direct `/assets/new` access should route to setup. Sign out and confirm management
actions are denied. Restart with the **same test control directory** and confirm
enrollment remains closed and the operator/profile configuration persists.

An optional copy-to-clipboard command, run in another local terminal with the exact
test directory, avoids echoing the bootstrap token. Clear the clipboard afterward:

```powershell
# Substitute only the private directory path printed by your test launcher.
Get-Content -Raw -LiteralPath '<test-control-directory>\bootstrap-token' | Set-Clipboard
# After pasting into the local enrollment form:
Set-Clipboard -Value ''
```

For a manual existing-database reconnection check, save a SQL Server profile for the
intended compatible development database, Test connectivity, Inspect and expect
compatible, then Activate. **Never initialize IT-Assets_DEV again.** Activation
changes the isolated control configuration; workspace login/usage may write normal
workspace session/activity records. Do this separately from the zero-live-write
setup test, when that access is intended. The existing workspace credentials are
required; the new installation operator does not become an inventory administrator.

A full empty-database test requires a separately provisioned disposable database
with its own explicitly authorized credentials. No reset button or data migration
is provided. Resetting local configuration means choosing a new private control
directory; it does not reset SQL Server records, users or migration history.

## Restore the original development configuration

Stop the test supervisor with Ctrl+C. In the original test terminal:

```powershell
if ($null -eq $previousControlDirectory) {
  Remove-Item Env:IT_ASSETS_CONTROL_DIR -ErrorAction SilentlyContinue
} else {
  $env:IT_ASSETS_CONTROL_DIR = $previousControlDirectory
}
npm run dev
```

With no override, the original `.managed-data` is selected again. If the test terminal
was closed, use the original override from your normal launch configuration, or
remove it to use `.managed-data`. Do not point the normal launch at the test directory.
No original files or database records need restoring because the test never changed
them. Keep the test directory private; it contains test operator credentials and any
profiles saved during the test. Nothing in this procedure deletes data.

## Validation and limitations (2026-11-09)

- All 20 unit tests passed. They cover control-store enrollment/persistence, one-hour expiration,
  entry/exit/replayed cookies, CSRF rejection, late-beacon protection, inventory cookie
  isolation, offline route classification, setup rendering and provider diagnostics.
- The production HTTP suite uses a fresh temporary control directory and only an
  unreachable loopback SQL fixture. It exercises startup, enrollment closure, login,
  cookie flags, repeated entry, server-side exit, unauthorized operations, profile
  save/removal, connectivity failure and credential redaction. Unconfigured asset
  pages redirect to setup; inventory writes return 409 before reaching Next.
- The full `npm run build:managed` passed, including both Prisma client generations.
  TypeScript and ESLint passed. The initial build attempt was blocked by the running
  development server's DLL lock; it succeeded after the owner stopped that server.
- Browser inspection in an isolated preview confirmed the desktop overview and
  390×844 mobile overview/login/management layout, enrollment screen navigation,
  disposable operator login, explicit exit and Back returning to fresh sign-in.
  Enrollment itself was exercised over HTTP; the browser preview operator was
  enrolled directly in its disposable control store without revealing its token.
  The viewport override was reset and the preview server stopped afterward.
- No existing MariaDB or SQL Server was accessed. Live compatible-SQL reconnection,
  workspace sessions, initialization and CRUD were not rerun for this UX change.
  Their existing dedicated fixture suite remains available for separately authorized
  disposable databases. The owner's earlier successful SQL Server acceptance is
  preserved, not represented as a newly executed test.
- Full reload may end a management visit; multiple tabs share its session. Browser
  termination may prevent the departure beacon, so fixed expiry and fresh-entry
  authentication remain necessary. Browser coverage is a smoke check, not an exhaustive
  cross-browser or accessibility audit. Docker was not executed.
- Existing non-blocking warnings: outdated Browserslist data and Node/tsx
  module-register deprecation. No dependency upgrades were included.

## Changed file groups

- `scripts/management-boundary.mjs` and its declaration: entry, exit, no-store,
  session-status and offline route policy; wired through `managed-web.mjs` and
  the managed supervisor's TypeScript loader.
- `src/modules/database-management/actions.ts`, `control-store.ts`, `visit-guard.tsx`:
  visit cookie, fresh login, authorized exits and browser history defenses.
- `src/components/layout/installation-shell.tsx`; management `navigation.tsx`,
  `setup-overview.tsx`, `panel.tsx`; installation, entry and workspace route pages:
  responsive setup/navigation and existing connection form composition.
- `src/lib/bootstrap.server.ts` and `settings-nav-card.tsx`: offline setup routing
  and disabled management-entry prefetch.
- `tests/management-visit.test.ts`, `tests/managed-setup-ui.test.ts` and
  `scripts/test-managed-http.mjs`: isolated regression coverage.
- This guide, `docs/architecture.md`, `docs/database-management.md` and the ignored
  local `progress.md`: architecture, results, safe testing and restoration notes.
