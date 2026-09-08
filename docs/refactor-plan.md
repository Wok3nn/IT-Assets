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

## Completed phases and changed files

- **Phase 1:** full Markdown/source/history review and clean baseline recorded before
  code changes (`11527c1`).
- **Phase 2:** removed verified unused asset types/validators, auth stub, role-members
  component, navigation types, duplicate TS bootstrap/seed entry points and unused
  animation/class-variance dependencies. Shared tree-label logic now terminates on
  cycles while preserving the old exports. Prisma wrapper/config share `.env` loading
  and MariaDB selection; deprecated package seed configuration removed only after
  generation, disposable migrations and seed dispatch passed (`dba8524`).
- **Phase 3:** added integrations module, versioned route, settings page/card, hashed
  credentials, explicit user grants, lifecycle/audit, bounded projection and rate
  protection. Added security/UI and database-backed workflow tests (`fb7f194`). No
  source files moved and no mature asset UI rewritten.
- **Phase 4:** rewrote README setup/deployment guidance; updated architecture and added
  the detailed plugin contract. Architecture is now tracked so README links work in
  fresh clones. AGENTS.md and progress.md remain local/ignored. CI now explicitly
  generates Prisma before checks and includes lint/tests plus isolated MariaDB
  migrations, repeated seeding and database tests. Local audit files are excluded from
  Git, lint and Docker build context.

No Prisma schema or migration SQL was changed. Production Docker startup, provider
migration copies, reminder worker entry point, application port and authentication
behavior remain intact. No real email or production external service was called.

## Final validation (2026-09-08)

Host: Windows, Node 24.14.0. Docker/CI baseline is Node 20; the new CI job has not run
here. Explicit shell database variables prevented existing environment files from
selecting configured databases. Production build used MariaDB with an unreachable
loopback port 1 URL; it did not require a database connection.

| Check | Result and limits |
| --- | --- |
| `npm test` | PASS: 11 root tests; tree cycles/paths, make/model depth, calendar DST, passwords, credential/identity/admin/limiter behavior, rendered UI, provider selection, environment priority. |
| `npm run lint` | PASS, including new module and tests. |
| `npm run typecheck` | PASS after explicit MariaDB generation. |
| `npm run db:validate` | PASS for supported MariaDB schema. |
| `npm run db:generate` | PASS for MariaDB and SQLite; workspace restored to MariaDB. |
| `npm run build` | PASS, Next 15.5.12; 21 static pages, dynamic integration page/API included. Shared first-load JS remains 102 kB. |
| Disposable migration replay | PASS: all 11 existing SQLite migrations on a new local `.audit-runtime/migrations.db`; repeat reports no pending migrations. This does not verify MariaDB or establish SQLite schema parity. |
| Seed dispatch/repetition | PASS: `db:seed` via new Prisma config, repeated on disposable migration and current-schema SQLite databases. |
| `npm run test:db` | PASS repeatedly on disposable current-schema SQLite, including scope rejection, setup 503, empty/deleted/inactive users, tenant isolation, cursor projection, rotation/expiry/revocation, audit secrecy, checkout/check-in, loans and guests. |
| Development HTTP smoke | PASS on port 4050: actual password login for disposable SUPER_ADMIN and VIEWER users; admin integrations 200 with DeskMap/Not configured, viewer 307, anonymous page 307, API 401, mutation method 405. Test sessions deleted and own server stopped. |
| Reminder dry-run | PASS: eligible/claimed/attempted/sent/failed/skipped all 0 against disposable DB; no credentials or live mail transport. Does not validate live Graph delivery. |
| `git diff --check` | PASS (Git's normal LF/CRLF conversion notices only). |
| Dependency audit | COMPLETED, nonzero exit for 18 vulnerabilities: 15 high, 1 moderate, 2 low, no critical. Not a passing security audit. |
| MariaDB execution / Docker | BLOCKED on this host: Docker/MariaDB absent; official MariaDB 11.4.9 portable archive hash verified but installer execution denied even with escalation. No MariaDB service was started. CI and a Docker-capable staging host must complete this acceptance check. |

SQLite current-schema workflow fixtures use `db push` solely on a disposable database;
its older migration history does not include every current model. No production reset,
`db push`, migration or seed was attempted. Migration replay/seed passed after creating
an empty SQLite file; initial engine invocations returned a generic schema-engine error.
The full schema workflow suite is independent of that history replay.

Removed warnings: deprecated `package.json#prisma` and duplicate-config override.
Remaining build warning: Browserslist/caniuse-lite data six months old. Prisma's
"config detected, skipping environment variable loading" is expected: the repository
loads `.env` explicitly before selection. Unlike Next.js, script loading does not read
`.env.local`; README now states this difference and requires consistent DB settings.

No full browser printing/accessibility acceptance, concurrent MariaDB loan/checkout
race test, container build/restart, real Entra tenant login or live email delivery was
performed. Existing source behavior was preserved; tests do not imply complete workflow
coverage. These are review/staging checks, not reasons to run against production.

## Dependency security follow-up

The registry audit on 2026-09-08 reports direct affected packages `next`, `xlsx`,
`postcss`, and `prisma`, plus transitive tooling/runtime dependencies. Counts are
package vulnerability entries, not 18 independent exploitable application paths.
Examples: Next server-action denial of service
([GHSA-m99w-x7hq-7vfj](https://github.com/advisories/GHSA-m99w-x7hq-7vfj)), SheetJS
prototype pollution ([GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6))
and ReDoS ([GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9)).
The local raw report is ignored at `.audit-runtime/dependency-audit.json`; recreate with
`npm audit --json` for current details.

Prioritize a dedicated dependency/security update before broader exposure. Audit
suggests fixes for many entries, but suggests a Prisma downgrade across its config
boundary and provides no npm fix for xlsx. Do not use `npm audit fix --force` blindly.
Validate Next server actions/auth/caching, Prisma config/startup/migrations, and real
spreadsheet import fixtures before changing these dependencies. This branch removes
unused dependencies but deliberately does not mix that compatibility work into the
architectural cleanup. Existing permissive role defaults and export visibility remain
the highest application-policy follow-ups.

## Review and remaining acceptance

1. Review `git diff main...HEAD` and the four logical commits.
2. Run the documented source checks and the MariaDB CI job on Node 20.
3. On a separate staging stack, verify fresh migrations, bootstrap/restarts, printing,
   imports, permission matrices, Entra login and reminder dry-run with realistic fixtures.
4. Decide the permission-default/export policy and dependency remediation release.
5. Implement DeskMap's backend token storage, viewer authorization, identity contract,
   timeout handling and click-card UI; jointly test before granting real users.

No branch push or deployment was performed.
