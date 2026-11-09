# Unified first-run setup — Phase 1 architecture review

Date: 2026-11-09. Reviewed baseline: 334e15a, `feature/managed-setup-ux`.
Status: proposed implementation plan; no application behavior changed in this phase.

Phase 2 implementation is now on `feature/unified-first-run-setup`. See
[delivery, validation and safe testing](unified-first-run-setup.md). This document
retains the approved design baseline. Implementation keeps the setup domain in the
existing database-management module instead of creating a parallel module; it reuses
`AppShellClient` directly rather than extracting another sidebar. Organization and
enrollment are atomic, with draft organization values kept in the form until enrollment.
The owner's successful SQL Server acceptance is preserved. No development database,
saved credentials, control database or running server was accessed for this review.

## Findings from the implementation

1. The original UI is `src/app/(setup)/setup/setup-wizard-page.tsx`, rendered by
   `/setup`. It already provides the desired gradient background, rounded outer card,
   two-column introduction/form layout, orange accents, dark theme, illustrated step
   cards, AppLogo, ThemeToggle, FieldLabel, TextField and Button. Reuse this presentation.
   It is currently one form with three descriptive cards, not a persisted step engine.
2. It collects site name, admin email, password and confirmation. Despite its branding
   card's wording, it has no logo upload or persisted initial theme configuration.
   ThemeToggle is a browser preference. Do not advertise unsupported branding features.
3. Its submission calls `/api/setup/initialize`, which creates an inventory SUPER_ADMIN
   through `user-store.ts` and writes inventory `SetupState` through `setup-state.ts`.
   Both require the external database and existing tables. This endpoint does not
   deploy provider migrations. Its password minimum is eight characters; managed
   enrollment/initialization uses fourteen. Its admin creation and setup-state write
   are separate operations, unlike managed workspace bootstrap's transaction.
4. Managed mode intentionally refuses that endpoint with 403. Additionally,
   `management-boundary.mjs` treats `/setup` as inventory-dependent and redirects it
   to `/installation` without an active profile. `requireBootstrapPage` makes the same
   redirect. Merely changing the root redirect will not make the old wizard functional.
5. Current first launch is supervisor → unconfigured request boundary → `/installation`
   → management entry/enrollment → authenticated management workspace. The separate
   `InstallationShell`, `SetupOverview` and management navigation produce the second
   visual experience. They solved database independence but should not remain a parallel
   installation product.
6. `ControlStore` stores one local operator, password hash, hashed one-hour sessions,
   AES-GCM encrypted connection profiles, revision/active selection, operation lock,
   audit and profile-scoped authentication configuration. It currently has no organization
   settings or structured wizard progress. Bootstrap enrollment consumes a private file.
7. Inventory authentication uses database users, roles and sessions (`session.server.ts`,
   `session-store.ts`). It is independent of the installation operator. Managed cookies
   are revision-scoped for inventory switching. Sharing wizard appearance must not merge
   these identities or copy an operator password hash into a workspace.
8. `AppShellRoot` queries inventory branding, user roles and permissions. Its client
   shell has the desired sidebar appearance, collapse controls, logo, version and theme,
   but hardcodes inventory links and workspace logout. It cannot be mounted unchanged
   before activation. Its sidebar is hidden below the large breakpoint; reuse must
   include usable small-screen navigation rather than inherit that limitation.
9. The existing Settings hub already links authorized workspace administrators to
   Database Management. Preserve that link and its fresh local authentication. Recovery
   must also remain directly reachable when the inventory/Settings hub is unavailable.
10. Managed services already implement safe profile validation, provider clients,
    schema classification, explicit empty-only initialization and compatible-only
    activation. Current initialization sets workspace `SetupState.siteName` to the
    connection name. Workspace header branding separately reads `Setting` keys such as
    app title; saving SetupState alone does not reliably configure all branding surfaces.
11. Activation rechecks compatibility, commits active profile/revision, then the
    supervisor polls every 750 ms, drains and starts a child pinned to that revision.
    A failed start before `ready` rolls back at another revision. The child's current
    `ready` message means HTTP listening, not a successful post-restart inventory probe.
    No durable wizard completion or readiness acknowledgement exists today.

## Recommended presentation and routes

Use the original wizard as the canonical **new-install** experience. Extract its
existing visual frame and step cards into shared setup presentation components;
keep legacy submission separate from the managed controller. Do not copy its full
markup into a new wizard or reuse its database-writing endpoint for managed enrollment.

| Route | Managed behavior | Legacy behavior |
| --- | --- | --- |
| `/` | No active DB: `/setup`; existing active installs retain normal workspace routing | Unchanged |
| `/setup` | Public welcome and protected bootstrap/enrollment, or fresh operator sign-in to resume | Original workspace wizard/guard |
| `/setup/workspace?step=…` | Authenticated, server-validated steps and completion; step URL is only navigation | Unavailable |
| `/installation` | Compatibility redirect to `/setup`; retire overview implementation | Unavailable |
| `/settings/database-management` | Keep fresh operator sign-in; same visual language | Keep managed-only restriction |
| `/settings/database-management/workspace` | Ongoing connection management using shared forms and shell presentation | Unavailable |
| `/setup/db` | Compatibility redirect to `/setup` | Preserve current legacy behavior |
| `/api/setup/initialize` | Remains disabled for managed mode | Preserve contract; do not silently repurpose |

Extract reusable sidebar/frame presentation from `app-shell.client.tsx`, retaining
AppShellRoot as the inventory data adapter. A local-control adapter supplies local
organization/default logo, setup/settings links and management exit actions. Use the
same sidebar implementation, not a third sidebar. First-run wizard uses its original
two-column step-card frame; ongoing settings use the shared application shell.
Retire `installation-shell.tsx`, `setup-overview.tsx` and duplicated management
navigation markup only after their functionality and tests have moved.

Before activation, local navigation offers Setup progress, Installation settings and
Database configuration; it does not render Assets, users or inventory Settings as
working destinations. After activation, Back to IT Assets exits control authentication
and routes through `/` to workspace or login. Keep the inventory Settings hub intact.

## Five-step behavior

1. **Welcome & Organization.** Reuse original site-name field and theme preview with
   the existing default logos. Explain database-independent startup. Persist organization
   in SQLite before any database connection. To avoid unauthenticated configuration
   writes, collect Step 1 values in component memory, then atomically persist them with
   protected enrollment in Step 2. Clearly label them unsaved until enrollment; do not
   store secrets in browser storage. Enrolled operators may save this step immediately
   after sign-in. Custom logo uploads are deferred until a separate authenticated local
   file adapter is implemented; existing workspace upload handlers require inventory
   authorization and must not be opened to anonymous setup.
2. **Installation Administrator.** Explain private token retrieval; never send the token
   from server to browser. Validate password and confirmation on both client and server,
   with the existing managed 14–128 character policy. Consume bootstrap once, hash the
   password, save organization atomically, and require sign-in to continue. No workspace
   permissions. A completed enrollment cannot reopen because a wizard step is revisited.
3. **Database Connection.** Extract existing provider/profile fields from `panel.tsx`.
   Save credentials through the encrypted profile store, then offer one explicit
   “Test connection & inspect schema” operation composing the existing read-only
   connectivity and inspection services. Return structured results: failed, empty,
   compatible, partial or incompatible. Keep safe diagnostics and exact target display.
   A successful TCP/login test alone never enables completion. SQL Server retains TLS
   encryption and explicit development certificate trust. MariaDB's current URL has
   no configurable TLS implementation: do not present a nonfunctional TLS checkbox;
   any added MariaDB TLS support needs separate connector testing.
4. **Workspace Preparation.** Empty: require new workspace credentials, password
   confirmation, exact database name and an explicit Initialize action. Reinspect
   emptiness at execution, reuse provider migrations and transactional bootstrap,
   then explicitly inspect compatibility after success. Compatible: identify an
   existing workspace and skip initialization; never reset its users or change branding.
   Partial/incompatible: block activation and show safe next actions, no reset/upgrade.
   After uncertain interruption, inspect before further action; never auto-retry DDL.
5. **Review & Complete.** Show organization, enrolled operator, verified profile/version,
   compatible schema, new/existing workspace, active selection and runtime readiness.
   Activation is explicit and rechecks compatibility. During restart show “Activating”;
   after confirmed readiness display “Congratulations! IT Assets is ready.” and a
   prominent “Go to IT Assets” that revokes management authentication and opens `/`.
   Existing workspaces still require their own credentials; a separate login is not
   proof that the installation operator owns a workspace administrator account.

## Persistence and security boundaries

Add versioned, additive **local SQLite** records, not asset schema migrations:

- `installation_settings`: organization/site name, supported local branding preferences,
  version and timestamps. No credentials. Browser theme preference is not automatically
  the organization's default theme.
- `setup_progress`: flow version, optimistic revision, selected candidate ID, profile
  version, initialization intent/outcome (new or existing), last inspection classification,
  checked timestamp and expected schema fingerprint, activation target/revision, and
  historical completion timestamp. No plaintext passwords, tokens or raw SQL errors.
- Runtime acknowledgement: active profile/revision plus supervisor generation/heartbeat
  and ready/failed state, written by the supervisor for its own current child. Ignore
  stale acknowledgements after restart or rollback; do not trust browser assertions.

Compute checklist states server-side from evidence. Editing a profile invalidates its
inspection/workspace evidence; switching selection or schema release invalidates readiness.
Keep local settings revision separate from inventory activation revision to avoid
unnecessary web restarts. Persist transient UI step only as a hint, not authorization.
Require fresh inspection at initialization/activation even if stored evidence is recent.

Completion predicate: valid local organization AND enrolled operator AND selected profile
matches verified version AND schema compatible for current release AND completed workspace
setup detected AND active selection equals candidate AND current supervisor generation has
acknowledged that revision AND a post-restart read-only workspace probe succeeds. Historical
completion remains recorded during later outages, but current readiness becomes unavailable;
never show green readiness from stale evidence. Recovery/local settings remain accessible.

Retain current origin checks, HttpOnly/SameSite/Secure-on-HTTPS cookie, hashed session
storage, expiry, serialized operations, safe errors and version/revision checks. Generalize
the management boundary and visit guard to the exact setup/control route allowlist.
Entering from inventory requires fresh authentication; moving between authenticated wizard
steps stays within the same visit. Leaving either control route family revokes that visit,
not inventory cookies. Disable prefetch for entry; keep cache/history defenses. Route
aliases must not accidentally revoke every step or create login redirect loops.

For a newly initialized workspace only, pass explicit organization metadata to bootstrap
instead of `profile.name`, writing supported SetupState/app-title settings in its existing
transaction. This is part of the explicit initialize action, not a write before selection.
Never apply local organization/branding to a compatible existing workspace automatically.
Later changes to local settings do not propagate to inventory settings without a separate
workspace-authorized action. Installation and workspace names may legitimately differ.

## Compatibility, migration and rollback

- Existing managed operators, keys, profiles, session digests and selections are retained.
  Add local tables/version upgrades transactionally and idempotently, with a stopped-server
  backup of the whole control directory before rollout. Do not regenerate keys/tokens.
- Existing enrolled installations with active databases must not be redirected into
  mandatory re-enrollment or initialization because new progress rows are absent. Preserve
  their normal root routing; show optional local metadata completion on authenticated setup.
  Start new evidence as unknown, not invented “verified” history. Refresh it only through
  explicit authorized checks. No silent reads/imports of development database metadata.
- Existing managed installations with no active DB resume setup using their operator.
  Missing/unreachable profiles leave recovery accessible and never reopen enrollment.
- Legacy deployments retain original route/API contracts and environment-based startup.
  Shared presentation extraction must not introduce control-store requirements there.
- Keep SQL Server/MariaDB migration histories, checksums, provider lock fix, client selection
  and revision fencing unchanged. No external data migration is needed for this design.
- Roll back UI/controller changes with local records left additive. If reverting after
  a real activation, inventory cookies remain revision-scoped; a code rollback must not
  rewind database selection by copying stale SQLite state over a running installation.
- Partial DDL/bootstrap remains an explicit recovery case. The wizard must not “fix” it
  with destructive commands. No reset button and no automatic initializer retry.

## Reviewable implementation phases and affected files

| Phase | Changes | Exit criteria |
| --- | --- | --- |
| A: Presentation extraction | `setup-wizard-page.tsx`; proposed `components/layout/setup-wizard-shell.tsx` and setup step-card component; AppLogo/ThemeToggle/forms reused | Legacy wizard visually unchanged; no new persistence behavior |
| B: Local setup domain | `control-store.ts`; proposed `modules/setup/{progress,actions,validation}.ts`; unit fixtures | Versioned local upgrade, enrollment/organization atomicity, resumable progress and authorization pass with zero external connections |
| C: Canonical routing/navigation | setup/installation/control route pages, `bootstrap.server.ts`, `management-boundary.mjs`, `managed-web.mjs`, `visit-guard.tsx`; extract `app-shell.client.tsx` presentation, keep `app-shell.tsx` data adapter | One wizard, no duplicated sidebar, offline paths work, fresh entry and normal inventory cookies preserved |
| D: Guided database/workspace steps | Extract forms from `panel.tsx`; reuse `actions.ts`, `profile-client.ts`, `schema-service.ts`, `diagnostics.ts`; new structured operation/progress adapter | Empty/compatible/partial/incompatible branches work; no implicit initialization; existing compatible records unchanged |
| E: Activation/completion | `managed-start.mjs`, `managed-web.mjs`, local readiness state and setup completion component | Resume after restart; rollback/old-generation acknowledgements cannot mark setup complete |
| F: Retire and document | Remove replaced InstallationShell/SetupOverview/navigation; update Settings link as needed; architecture, setup docs, README and tests | Aliases supported; full acceptance matrix passes; no production/dev data touched |

Pages remain orchestration only; modules own step internals; shared components own layout.
Do not change the original API and control authentication in the same presentation commit.
Use a new implementation branch from the verified baseline and review each phase independently.

## Required automated and manual validation

1. Offline first launch and all supported direct routes: no external client query before
   configuration; `/setup` works while asset pages/API writes are blocked, including Next
   concurrent page/layout rendering. Unknown routes and static assets still behave normally.
2. Local schema upgrades on fresh and existing control fixtures; restart persistence,
   missing progress records, failed upgrade rollback, preserved encrypted profiles/key.
3. Bootstrap token secrecy, single-use/concurrent enrollment, password confirmation/policy,
   organization validation and atomic save. Authenticated local settings persist without DB.
4. Fresh management entry, in-wizard navigation, aliases, exit/logout, expiry, CSRF,
   prefetch, Back/reload, multi-tab/stale actions and preservation of inventory cookies.
5. Combined read-only check: unreachable/TLS/login/permission failures; empty, compatible,
   partial and unrelated schema. Results bound to exact profile/version and invalidated on edit.
6. Disposable SQL Server **and** MariaDB: explicit initialization, new workspace credentials,
   organization setting application, post-init inspection and repeat-init refusal. Compatible
   existing fixtures reconnect/activate without DDL, record/user/branding changes or granting
   the operator workspace access. Do not run these against IT-Assets_DEV or existing MariaDB.
7. Fault injection: interrupted DDL/bootstrap, stale checks, simultaneous tabs, activation
   process failure, rollback, lost response, stale readiness, expired login while restarting,
   completed installation later disconnected. No automatic retry, false green completion or loop.
8. Completion predicate negative cases for every missing condition; real new-child readiness
   and read-only inventory check required. Go to IT Assets routes correctly with/without a
   workspace session. Exiting control alone does not invalidate inventory authentication.
9. Legacy initial setup/login and existing inventory navigation regression; shared logo,
   dark/light styles, desktop/mobile layouts, keyboard focus, form labels and error/status
   announcements. Compare original wizard screenshots before/after extraction.
10. Run unit tests, lint, typecheck, managed build and isolated HTTP/browser tests. Use a
    new private control directory on localhost:4050; stop the other supervisor first and
    restore its original environment afterward. Do not delete original configuration.

Main risks are scope/permission leakage during shell reuse, incorrectly treating profile
selection as readiness, stale progress after editing/switching, and partial initialization
across DDL and workspace bootstrap. The explicit phase gates and negative tests above
address these; UI consolidation alone is insufficient.

Phase 1 validation: source/documentation review and documentation diff checks only.
No build, browser session, network database check, schema change or implementation test
was executed or claimed for this planning-only phase.
