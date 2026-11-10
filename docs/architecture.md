# Architecture

Last updated: 2026-11-10

## Unified managed installation

`/setup` serves enrollment/sign-in independently of inventory. `/setup/workspace`
orchestrates authenticated wizard steps; `/setup/status` checks readiness under the
control operation lock. `/installation` and managed `/setup/db` are aliases.
The original legacy wizard retains its API and uses the extracted
`components/layout/setup-wizard-shell.tsx` presentation.

`modules/database-management` owns local organization, progress, forms, connection
inspection and completion. `setup_record` is an additive, transactional, versioned
SQLite upgrade. Organization/enrollment commit atomically; existing identities,
encrypted profiles and selections remain intact. No asset migrations are introduced.
Local organization settings are copied only during explicit empty-database bootstrap.

`AppShellClient` owns shared inventory/control sidebar styling and responsive behavior.
`AppShellRoot` remains the inventory data adapter; `ControlShell` supplies local values
and control navigation without querying asset tables. No separate installation sidebar.
Connection components are shared between the wizard and Settings management.

`ManagementShell` chooses the existing `AppShellRoot` for an authenticated workspace
session before and after separate installation sign-in, falling back to `ControlShell`
when inventory is unavailable. Management routes stay outside the dashboard layout.
Wizard cards own step navigation; server orchestration gates preparation/verification.
Step 4 shows only the selected candidate, and Step 5 performs bounded backend readiness
checks. See [Phase 3 UX and validation](setup-ux-refinement.md).

Phase 4 keeps activation in the same server action and supervisor. A feature-local
native dialog supplies confirmation; the shared bounded readiness hook consumes
the authenticated status endpoint. Management success matches the verified profile
and revision, so another activation cannot satisfy an older request. Token help
formats the configured path without reading its secret. See [0.6.0 release notes](release-0.6.0.md).

Phase 5 adds an explicitly invoked offline MariaDB adoption command under the existing
supervisor ownership lock. Compatibility, original settings-key decryption, Entra
reference conversion and branding files are checked before an inactive profile and
adoption marker commit atomically. No inventory rows/migrations are written. Activation
still uses the existing administrator action; startup checks the verified deployment
secrets. Legacy branding URLs translate on read so rollback retains original values.
The adopted profile cannot be retargeted to another database. See the
[Docker upgrade runbook and production blockers](docker-upgrade.md).

The supervisor records a unique child generation, pinned selection/revision and live
heartbeat. Readiness requires that exact process, compatible schema/workspace and a
live connection probe. Profile/schema changes invalidate evidence; connectivity is
probed on each status request and schema inspection repeats at least every minute.
Historical inspections are labeled as such. Neither a saved selection nor a started
process alone means ready. See [implementation and validation](unified-first-run-setup.md).

## Structure Overview

### `src/app`
Route files live here. These files should act as orchestration layers:
- parse search params and route context
- run guards and redirects
- load data from services/modules
- define server actions when needed
- compose page sections and major layout structure

Recent refactors moved large route-level UI into feature components, but the route files still own page composition and flow control.

### `src/components`
Shared UI and layout primitives live here.

Current groups:
- `layout`: shared shell primitives such as `PageHero`, `PanelCard`, `InsetCard`
- `forms`: shared field primitives such as `TextField`, `SelectField`, `TextareaField`, `FieldLabel`
- `admin`: shared helpers for the parallel admin pages such as section headers, empty states, color style blocks, and admin field wrappers
- `navigation`: app shell/navigation components
- `ui`: low-level reusable UI such as `Button`
- `dashboard`: generic dashboard display pieces such as stat cards

### `src/modules`
Feature-oriented implementation lives here.

Current active modules:
- `assets`: asset form, asset services, status pill, transfer panel, routing helpers
- `users`: user service plus extracted user-page subcomponents
- `settings`: settings service, import/export logic, and extracted import/export UI subcomponents
- `categories`, `locations`, `scopes`: service modules used by the cleaned admin pages

Additional active modules:
- `labels`: label templates, barcode/QR rendering, editor and printing
- `borrowed-items`: loans, returns, calendar eligibility and reminder processing
- `permissions`: configurable role capabilities and asset scope enforcement
- `integrations`: controlled registry, administrator configuration, machine authentication and assigned-assets API

Incomplete module boundaries:
- `audit`: no complete module surface yet
- `auth`: behavior is implemented elsewhere, not as a dedicated module boundary yet

### `src/services`
App-level infrastructure and persistence helpers live here.

Examples:
- database access and config
- password hashing
- session store
- setup state
- user store

These are not page-specific and should remain implementation-level helpers.

### `src/lib`
Cross-cutting utilities and lightweight app logic live here.

Examples:
- session helpers
- permissions helper
- generic utility helpers

`src/lib` should stay small and broadly reusable. Feature-specific logic should prefer `src/modules`.

## Shared Vs Feature Ownership

### Shared components own
Shared components should be used when the pattern is repeated across multiple features or pages.

Current shared primitives:
- layout shells:
  - `src/components/layout/page-hero.tsx`
  - `src/components/layout/panel-card.tsx`
  - `src/components/layout/inset-card.tsx`
- form primitives:
  - `src/components/forms/text-field.tsx`
  - `src/components/forms/select-field.tsx`
  - `src/components/forms/textarea-field.tsx`
  - `src/components/forms/field-label.tsx`
- admin helpers:
  - `src/components/admin/admin-page-columns.tsx`
  - `src/components/admin/admin-section-header.tsx`
  - `src/components/admin/admin-empty-state.tsx`
  - `src/components/admin/admin-fields.tsx`
  - `src/components/admin/color-style-fields.tsx`
  - `src/components/admin/card-style.ts`

Use shared components when the styling/pattern is general-purpose and not tied to one feature.

### Feature modules own
Feature modules should own feature-specific structure, wording, local styling tokens, and internal component arrangements.

Examples:
- `src/modules/assets/asset-form.tsx` owns asset form internal layout
- `src/modules/users/components/users.styles.ts` owns user-module-specific field/surface patterns
- `src/modules/settings/components/*` own import/export panel internals

A feature module should not push generic shells back into the route or duplicate shared primitives.

### What belongs in shared vs modules
Use `src/components` when:
- the pattern is repeated in multiple features
- the visual shell is generic
- the component has no domain-specific wording or behavior

Use `src/modules/<feature>` when:
- the component is tightly coupled to one domain
- the component contains feature-specific arrangement or display rules
- the styling pattern is only meaningful inside that feature

## Layout Ownership Rules

Follow these rules unless there is a strong reason not to.

### Pages own
- overall page composition
- section ordering
- route-specific grid and column layout
- route/search-param/view-mode orchestration

### Layout primitives own
- hero shell styling
- panel/card shell styling
- inset/surface shell styling
- shared outer spacing conventions built into those shells

### Feature components own
- internal spacing
- internal field arrangement
- internal card/table/list structure
- feature-specific section layout inside their shell

### Practical examples
- assets create/edit pages own the page layout and hero sections, but `AssetForm` owns the form internals
- users page owns view parsing, filtering, and orchestration, but user UI sections now live in `src/modules/users/components`
- settings import/export page owns page-level composition, but the import/export panel and its subcomponents own the import UI internals

## Styling Ownership Rules

### Core rules
- avoid duplicating long Tailwind wrapper strings across pages
- avoid passing styling down just so a child can render its basic structure
- prefer shared primitives for common shells and common fields
- prefer module-local style files for feature-specific repeated patterns

### Use shared primitives when
- the style is generic across features
- changing the style should intentionally affect multiple areas
- the component is a shell or basic form primitive

### Use module-local styles when
- the repeated pattern is specific to one feature
- the pattern is too specific for `src/components`
- a local style constant improves clarity without turning into a global design token

Current examples:
- shared field ownership: `src/components/forms/*`
- shared shell ownership: `src/components/layout/*`
- user-module local styling: `src/modules/users/components/users.styles.ts`
- settings import/export local styling: `src/modules/settings/components/import-export.styles.ts`

### Avoid
- route files passing `fieldClass` or `subpanelClass` into feature components unless absolutely necessary
- children depending on parent styling to define their internal arrangement
- multiple layers each partially owning the same visual shell

## Current Architecture State

The current refactor status is:
- shared layout primitives: complete
- shared form primitives: complete
- admin page cleanup: complete for categories, locations, scopes
- settings import/export split into subcomponents: complete
- users page split into subcomponents: complete
- unused stub/placeholder cleanup: complete
- styling ownership cleanup: complete in the safest high-value areas

Notable current structure:
- route pages are much closer to orchestration-only than before
- assets form now owns its own internal field/surface styling
- users feature has extracted components and module-local style ownership
- settings import/export has extracted presentational subcomponents and local style ownership

## Known Gaps And Future Work

These are still incomplete or intentionally staged:
- there is no full audit module/UI surface yet
- auth is implemented through routes, `lib`, and `services`, not a dedicated `modules/auth` boundary
- permissions are enforced across features, but existing role defaults are permissive and need an explicit policy migration
- export scope, notification timeouts, calendar consistency, and large feature extractions remain documented in [the review plan](refactor-plan.md)

## Installation control and inventory databases

Managed startup is the default development and new installation workflow. The control
route is outside the dashboard layout so recovery can render without asset branding,
sessions or permissions. When a workspace session is available, Settings management
explicitly reuses its normal shell adapter. A local SQLite store under the supervisor's private directory
authenticates an installation administrator, encrypts profiles, stores profile-scoped
SSO configuration and audits management operations. Inventory users, roles, sessions,
assignments and business audit remain in their selected backend. Control credentials
grant no asset role. Existing environment-based MariaDB deployments remain supported.

The request-serving process is pinned to an activation revision. The central database
proxy verifies that revision and constructs the matching generated SQL Server or
MariaDB client. The supervisor drains/restarts on switch; no runtime client generation
or in-flight datasource mutation occurs. Managed mode does not run a reminder worker.
Managed SQL Server uses a separate empty-database migration history. Existing MariaDB
migration SQL is unchanged. See [the architecture decision and operations guide](database-management.md)
for catalog checks, isolation, SSMS setup, backups, validation and rollout limits.

Managed setup uses the database-independent `SetupWizardShell`; `/installation` aliases
the canonical `/setup` entry. Management entry always requires fresh local authentication; its authenticated
workspace is a separate route. The managed HTTP boundary revokes control visits on
entry/exit, prevents caching, and blocks unconfigured inventory requests before Next's
concurrent layout/page rendering. Server actions still enforce authorization and origin
checks. Workspace sessions and database activation logic remain separate. See
[managed setup UX and testing](managed-setup-ux.md) for lifecycle details and safe
fresh-control-store testing; never reset an existing inventory for a setup test.

## Integration boundary

`src/app/api/integrations/v1/assigned-assets/route.ts` delegates to the integrations
module. Machine credentials do not create interactive sessions or inherit role defaults.
The settings route owns guards, server actions and composition; feature components own
form internals and use existing shared shells and fields. Only active super-admins with
settings and permissions capabilities may administer integrations.

The initial DeskMap registry entry is disabled by default. Random bearer tokens are
stored only as hashes. Explicit tenant/object-ID or local-user mappings grant access to
that user's current direct assignments. There is no automatic email matching, remote
code loader, outbound DeskMap call or synchronization service. Scalar settings and
existing audit rows avoid a database migration. See [the API contract](plugin-architecture.md)
for lifecycle, limits, failure behavior and future extension rules.

The dashboard layout owns `AppShellRoot`; the route-level `AppShell` remains a
compatibility component. Do not add a second navigation shell during extraction.
MariaDB is the supported production provider. Script and Prisma configuration share
provider selection and environment loading; SQLite is a development/test compatibility
option, and other provider migration histories are not production parity guarantees.

## Development Guidelines

### Route files
Keep route files orchestration-focused.

They should:
- parse params
- fetch data
- define redirects/guards
- define server actions when appropriate
- compose feature sections

They should not grow into large UI files again unless there is a strong reason.

### Components
Prefer small reusable components over large monoliths.

Good pattern:
- shared shell in `src/components`
- feature-specific internals in `src/modules/<feature>/components`
- route composes them together

### Refactors
Do refactors in phases.

Preferred order:
1. extract shared primitives
2. extract feature subcomponents
3. clean styling ownership
4. only then consider deeper boundary changes

Avoid large one-step rewrites.

### Reuse
Before adding new UI patterns:
- check `src/components/layout`
- check `src/components/forms`
- check `src/components/admin`
- check the relevant feature module for an existing pattern

Do not reintroduce duplicated wrapper styles or repeated field blocks when a shared primitive already exists.

### Abstraction level
Avoid over-abstraction.

Do not build a generic framework when a few small components are enough. The current architecture intentionally prefers:
- small shared primitives
- clear feature modules
- explicit route orchestration

That is the baseline to preserve.
