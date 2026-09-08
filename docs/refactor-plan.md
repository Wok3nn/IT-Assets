# Application review and refactor

Review base: `d6d346b` (`main` and fetched `origin/main`), 2026-09-08.
Branch: `astra/application-review-refactor`. Initial working tree clean. No existing
Astra branch found. No production database or external notification service used.

## Documentation and evidence

Reviewed all project Markdown found with an ignored/hidden-inclusive search:
`AGENTS.md`, `README.md`, `docs/architecture.md`, and the complete local-only
`progress.md`. Dependency/build/cache documentation is not project documentation.
Compared the historical notes with current source, provider schemas, startup scripts,
CI, and recent history (including the Prisma config Docker fix and Borrowed Items).
Architecture notes dated March predate implemented labels, permission enforcement,
guest profiles, and Borrowed Items. Historical progress entries are retained as history,
not treated as simultaneous requirements. `progress.md` remains ignored.

## Baseline

Before application edits: lint and typecheck passed; MariaDB Prisma validate and
client generation passed; full production build passed (Next 15.5.12, 21 static
pages). Existing warnings: deprecated package.json Prisma config, config overriding
that property, explicit environment-loading notice, and six-month-old Browserslist
data. No test script or automated test files existed. Commands used explicit
`DB_MODE=local`, `DB_PROVIDER=mariadb`, and a non-service loopback database URL
(`127.0.0.1:1`) so build validation could not reach configured databases.
Docker, MariaDB and mysqld were not on PATH at audit time.

## Prioritized findings and implementation plan

| Priority | Finding and evidence | Risk | Recommended change / benefit | Files | Validation |
| --- | --- | --- | --- | --- | --- |
| Critical recommendation | Role settings default every capability to true; malformed/missing settings also fall back to permissive defaults (`permissions.ts`, `permissions.service.ts`). Role names alone do not imply limited access. | Changing this silently could lock out deployments or break established grants. | Defer existing-policy change; design explicit migration and recovery procedure. New integrations require super-admin plus settings/permissions capabilities. | permissions modules | Role configuration migration fixtures and real role acceptance tests before policy change. |
| High value | No persisted Entra Object ID or sync service; callback maps existing users by email. | Automatic email mapping could disclose another person's inventory. | Explicit per-integration approved identity mapping, tenant + object ID preferred; local ID fallback only by deliberate grant. No auth migration. | new integrations module and API | Unknown identity, cross-client isolation, disabled/deleted users, mapping removal. |
| High value | No integration authentication, scopes, lifecycle, or API. | Unbounded external reads or secret exposure. | Disabled-by-default read-only v1 API; hashed random tokens, explicit per-user grants, revocation, bounded reads, audit and throttling. | integrations service, routes, settings page | API and service tests, no secret or extra fields in responses. |
| High value | Prisma config defaults SQLite, script/runtime default MariaDB; wrapper selects before loading .env. Seed configured only in deprecated package property. | Schema/migration mismatch on a fresh clone or alternate provider. | Share script selection with Prisma config; load .env consistently, preserve explicit environment priority; put seed in Prisma config. | prisma.config.ts, scripts, package.json | Generate, validate, seed dispatch, disposable migration/seed testing. |
| Useful cleanup | Stub auth always returns false; obsolete asset validator/types, role-members UI, duplicate seed/bootstrap TS entry points and framer-motion have no callers. | Accidental deletion of a compatibility surface. | Remove only source-reference-verified unused artifacts; retain legacy public asset redirect routes and script aliases. | lib/auth, asset stubs, user component, scripts, package files | Reference search, lint, typecheck, build. |
| Useful cleanup | Category/location tree-label helpers are identical and can loop on corrupt parent cycles. | Label output regression. | One shared pure tree-label helper with cycle guard; preserve exports and separators. | lib/tree-label, category-tree, location-tree | Missing/root/nested/cyclic fixture tests. |
| High value | README lacks local development path and ends with an unclosed code fence. CI lacks tests/lint and generates Prisma only after typecheck. | Fresh-clone setup failures. | Verified quick start, isolated database instructions, command table, explicit CI generation and tests. | README, CI, package scripts | Commands and fresh database checks. |
| Deferred | 1,920-line asset service, 1,570-line import service, 1,472-line import panel, 1,059-line assets grid, 860-line label editor. | Broad extraction without regression fixtures risks mature interactions. | Extract focused pure helpers first; retain table resizing, natural sorting and partial import semantics. Future phase splits import parsing/mapping and asset query/mutation concerns. | assets/settings/labels | Workflow fixtures before larger moves. |
| Deferred | Asset natural sort reads candidates before paging; user directory loads broad user graph; role context reads settings repeatedly. | Changing collation or permission cache freshness changes behavior. | Measure with representative data; future batch settings query and persisted natural-sort key need explicit semantics. | asset/user/permissions services | Query counts and stable pagination fixtures. |
| Deferred | Export assets checks capability but does not apply asset scope. User details and aggregate counts merit a consistent visibility policy review. | Existing administrative export policy may intentionally be broader. | Document and decide administrative export versus viewer scope; do not reuse this endpoint for integrations. | export routes, import-export/user services | Restricted-role export acceptance tests. |
| Deferred | Graph calls have no explicit timeout; Entra direct secret fallback persists unencrypted; session signature has a development-secret fallback. | Authentication/notification compatibility. | Require production secrets, migrate direct Entra secrets deliberately, add bounded Graph requests with retry/idempotency design. | entra-auth, session-store, graph-mail | Mocked failure and tenant tests. |
| Deferred | Borrowed list date filters use local server midnight while dashboard/reminders use configured calendar zone; loan/checkout concurrency spans different records. | Loan eligibility and duplicate assignment changes need DB race tests. | Align calendar contract and inspect cross-workflow transaction isolation in a dedicated phase. | borrowed-items/asset services | DST/calendar fixtures and concurrent MariaDB operations. |
| Deferred | MariaDB receives current migrations; other provider histories lag current schemas. Docker still copies provider migrations despite config path selection; reminder worker can start before web migrations finish. Branding uploads write into public rather than mounted /data. | Migration and deployment regression. | Keep supported MariaDB deployment; verify fresh startup before simplifying copies, add readiness coordination and persistent upload routing separately. | Prisma histories, Docker, branding | Real container restart, migration and upload persistence tests. |
| Deferred | Many link/button nesting patterns and custom grid interactions need browser accessibility review. | Shared primitive changes touch most screens. | Start with accessible semantic controls for new integration UI; defer broad Button/link redesign. | shared UI, assets grid | Keyboard and screen-reader checks. |

## Phases

1. Audit and baseline (complete before edits).
2. Safe cleanup and setup consistency, with focused regression tests.
3. Integration foundation and administrator configuration, with contract tests.
4. Documentation, disposable database checks and final production validation.

## Architectural direction

Before: mature feature modules plus some route-owned UI, central Prisma proxy,
settings-backed configuration, session capabilities, no machine-to-machine API.
After: preserve that structure; add a feature-owned integrations module with a
separate machine credential boundary and minimal assignment projection. Routes own
HTTP/page orchestration, shared primitives own shells, services own persistence and
policy. No arbitrary plugin code execution, changes to DeskMap, or database migration
are required for the initial settings-backed foundation.

Final phase outcomes, exact validation results and remaining limitations are recorded
below as work completes.
