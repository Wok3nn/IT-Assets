# Database management: architecture decision and rollout (2026-11-05)

For the current unified wizard, fresh management authentication, isolated installation
tests and restoration instructions, see [unified first-run setup](unified-first-run-setup.md).
Management entry now always prompts for sign-in; authenticated work uses its workspace
subroute. `/setup` is the canonical offline entry; `/installation` and managed `/setup/db`
redirect there. Test and schema inspection are now one primary action. The original
deployment/SQL preparation details below still apply.

Base: 378cc8d. The existing process constructs Prisma lazily; starting a listener is
not equivalent to being able to sign in. Home, setup, local login, session refresh,
branding, Entra config, role grants, and the dashboard shell query the selected asset
database. Docker waits for its socket, deploys migrations, and bootstraps before serving.
The previous experimental external wizard stored plaintext, trusted the server
certificate, ran client generation at request time and exposed unauthenticated setup.
It must not be reachable in managed installations.

Keep existing MariaDB deployments and migration history intact. No record transfer.
Implement in phases:

1. Add a separate SQL Server client/build and provider-specific empty-database history.
   Prisma and client are pinned to 6.19.2. SQL Server uses JDBC-style braced URL values,
   not MySQL percent-escaping. Review nullable uniqueness, index lengths, cascades,
   Unicode long text and existing relations. Core feature queries use Prisma delegates.
   [Prisma 6 SQL Server reference](https://www.prisma.io/docs/orm/v6/overview/databases/sql-server).
2. Introduce an isolated SQLite control store. Separate local operator identity, hashed
   sessions, one-time enrollment secret, encrypted database profiles, activation revision
   and operator audit. Asset users, roles, sessions, integrations and initial Entra settings stay
   in their own security domain: changing a profile must never confer a local asset role.
3. Put control login and management outside the asset dashboard layout. Check metadata
   visibility and schema before activation, permit initialization only on an explicitly
   confirmed empty database. Never reset or auto-upgrade a populated database.
4. Pin each managed web process to one activation revision, fence old processes and
   restart under a supervisor when switching. Do not hot-swap the database beneath a
   request. Disable unmanaged reminder workers for this mode until a supervised worker
   can drain alongside the web process. Keep control login accessible during outages.
5. Test with isolated control data and disposable endpoints. Do not read credentials
   from the developer's MariaDB environment or use that database for validation.


## Start the installation on Windows

Use Node 24 LTS (native SQLite is required by managed mode). From the repository:

```powershell
npm ci
npm run dev
```

Open http://localhost:4050. The launcher explicitly sets an unreachable asset URL and
uses only the selected control profile for asset access. It does not import a connection
from your existing MariaDB environment, migrate it, or require a DB listener. Next may
report that it read environment files for other application settings; that does not
select an asset database. The launcher generates both Prisma clients offline.

Read `.managed-data/bootstrap-token` locally, register a unique administrator email
and password (14+ characters), then sign in. The token is consumed and registration is
closed, including after restart. Restrict NTFS access to this directory to the operator
and service identity. The default web bind is loopback. Set `IT_ASSETS_CONTROL_DIR` in
the launch environment for a different durable **private local** directory, not a shared
network volume. Do not put it inside public, a synced folder or a repository commit.
The login page is always available at `/settings/database-management`.

## Prepare your disposable SQL Server database in SSMS

1. Connect in SSMS with your database administrator account. Under **Databases → New
   Database**, create a *new*, empty database, e.g. `ITAssets_Dev_Empty`. Do not select
   an existing inventory, production database, or a system database. Do not create
   tables or a database diagram; the initializer checks the catalog for existing objects.
2. Enable SQL Server Authentication on the dedicated test instance as appropriate.
   Under **Security → Logins → New Login**, create a dedicated SQL-authentication login
   with a strong password, no server roles, and map it to the new database. Use the
   default schema `dbo`. Grant **db_owner in this database only** for initialization.
   IT Assets does not need server-level database creation or sysadmin. See
   [Microsoft: Create a login](https://learn.microsoft.com/en-us/sql/relational-databases/security/authentication-access/create-a-login?view=sql-server-ver16).
3. Enable TCP/IP on the instance and configure a known TCP port (commonly 1433).
   Permit that port from the application host/container only. Enter the actual TCP
   host and port; named-instance discovery, integrated Windows/AD auth and IPv6
   literals are not implemented. A Docker container's localhost is the container,
   not the Windows SQL host. Use a routable DNS name reachable from the container.
4. Configure a SQL Server TLS certificate whose DNS name matches that host. Install
   its issuing CA in the OS/container trust store (for the Debian managed image, add
   your CA certificate and run update-ca-certificates when building the image).
   Encryption and certificate verification are the defaults. The self-signed trust
   override is for an isolated test instance only. See [Microsoft: encrypted
   connections](https://learn.microsoft.com/en-us/sql/database-engine/configure-windows/enable-encrypted-connections-to-the-database-engine?view=sql-server-ver16).
5. In Database Management **Add a connection → Microsoft SQL Server**, enter the
   connection name, host, port, database, SQL username and password. Values containing
   braces/control characters are rejected; SQL values are braced instead of URL encoded.
   Save, then **Test connectivity** (only SELECT 1), then **Inspect schema**. Expect
   **empty**. Failure leaves the current inventory untouched.
6. Open **Initialize an empty database**, enter a *workspace* administrator email and
   a new password, and type the exact database name. This explicitly creates tables,
   reference roles/statuses, a workspace administrator and completed workspace setup.
   It does not copy the installation operator or any inventory records.
7. Inspect again: expect **compatible**. For routine access create a second login/user
   mapped to this database only with db_datareader, db_datawriter and database-level
   VIEW DEFINITION. Give it no schema-change or server roles. Save a second profile
   using those credentials and verify it before activation. Remove the no-longer-needed
   inactive initialization profile, and have the DBA disable its elevated login.
8. **Activate** the compatible runtime profile by typing its database name. Allow the
   web process to restart, reopen the inventory sign-in link, then sign in with the
   *workspace* administrator account. Create an asset, edit, check out/in, loan/return,
   test two locations with no code, and delete a disposable asset. Save/activate
   another disposable profile and switch back; the original inventory must still be
   there. Live SQL Server acceptance is required; no claim of a live MSSQL pass is made.

## Initialization and compatibility rules

Managed SQL Server has its own generated client and migration history under
`prisma/managed-migrations/sqlserver`. The April experimental history is neither
rewritten nor considered compatible with this new baseline. It is **not** an automatic
upgrade path. The model uses Unicode text (MAX for unbounded payloads/settings), CUID
string keys, DATETIME2 and explicit referential actions. Filtered unique indexes on
Location.code and BorrowedItem.activeAssetId allow multiple NULLs without allowing
duplicate non-null values. Multiple cascade paths are explicitly restricted; a delete
with historical references can be refused. No MariaDB SQL runs against SQL Server.

Managed MariaDB uses the original committed migrations, unchanged. Prisma model
annotations now match the already-deployed loan FK delete restrictions and reminder
timestamp default. The legacy web/app/worker compose remains a separate deployment.
To keep using the local legacy development environment, use `npm run dev:legacy`.
Nothing here automatically registers, opens or upgrades a pre-existing MariaDB DB.

Both providers check catalog visibility before classifying a target. Inspect validates
applied migration names/checksums, completion, actual Prisma DDL drift and completed
workspace setup. SQL Server additionally verifies the two filtered unique indexes.
A partial/incompatible target cannot be initialized or activated. Existing unrelated
tables are not overwritten. Empty initialization runs only migrate deploy followed
by transactional reference/admin setup. If interrupted after DDL, the database can be
partial; inspect and recover with the DBA or choose a **different empty** database.
The management UI has no reset, force-baseline or auto-upgrade command. Use an
exclusively allocated DB; prevent external schema changes while initializing/switching.

MariaDB initialization requires ALL PRIVILEGES on the named empty schema; a separate
runtime account can have database-wide SELECT/INSERT/UPDATE/DELETE. Metadata visibility
must be database-wide. No Prisma shadow DB is used in either deployment path.
SQL Server connectivity tests are read-only; a successful TCP/login probe alone is
not evidence that the target has compatible tables or write privileges.

## Ownership, credentials and switching

The SQLite control store contains the local operator password hash, hashed one-hour
sessions, login throttling, saved profiles, per-profile authentication configuration,
selection revision and control audit. Profile passwords use AES-256-GCM with random
nonces and authenticated profile metadata. UI pages only receive public profile fields.
Database operations use same-origin server actions and a separate HttpOnly/SameSite
control cookie. Management writes are serialized; stale selections and changed profile
versions must be reviewed again. Other asset users do not acquire management authority.

Workspace users, permissions, Entra role membership decisions, inventory, integration
tokens and business audit remain inventory-specific. In managed mode, saving
Authentication Settings writes a profile-scoped control configuration. Existing
workspace settings are read as a compatibility fallback until saved; for Entra secrets
use a dedicated environment variable named IT_ASSETS_ENTRA_SECRET_<NAME>. Managed mode
does not accept historical plaintext secret references for login. Configure the
variable in the service's startup environment before saving the reference. Retargeting
a profile clears its authentication override. The local control account is independent
of Entra and **does not impersonate** an asset administrator.

One supervisor owns an exclusive local SQLite lock. Each child is pinned to one
revision. Activation tests the candidate before committing selection and audit; the
old process refuses new DB operations on mismatch, drains HTTP requests, closes, and
a new process opens the new connector. Existing transactions stay on their original
client. Cookie names and browser write requests are scoped to the inventory generation;
stale forms receive 409. Reopen tabs and sign in again. If candidate process startup
fails before listening, the supervisor reverts to the previous selection at a fresh
revision. Database outages after startup leave control login available. Changes are
never mirrored to the inactive DB. Single installation/single supervisor only.
Managed reminders are deliberately disabled: do not attach a legacy scheduled worker
to managed profiles. Existing legacy deployments retain their worker. Managed worker
drain/idempotency and live email/SSO are separate acceptance work.

## Production, backups, upgrades and recovery

Use `npm run build:managed` and `npm run start:managed`, or the dedicated Node 24
Docker compose. Managed production and development builds have isolated Next output
directories. The managed Docker image runs unprivileged, includes both generated
clients plus Prisma CLI/migrations, and persists /data/control. No database or worker
sidecar is required. Set IT_ASSETS_MANAGED_URL to the public HTTPS origin behind your
reverse proxy; preserve Host/Origin correctly. The example binds the host port to
loopback. Install CA trust inside the container for private SQL Server certificates.
Integrated auth, clusters/multiple replicas and online schema upgrades are not supported.

Stop the supervisor for a consistent file backup of the **entire control directory**,
including control.sqlite and WAL state, control.key and profile-specific workspaces.
Protect and encrypt backups. Keep a separately protected copy of the key: losing it
makes saved passwords unrecoverable. Do not regenerate it over an existing install.
Back up each asset database independently with its native consistent backup method;
restore to staging first. No asset backup contains the local operator account.
Historical branding uploads from legacy public/branding/uploads require separate
backup; new managed uploads use the profile workspace directory. If accessing older
encrypted email settings, supply their original IT_ASSETS_MANAGED_SETTINGS_KEY in the
managed environment; otherwise managed mode derives an installation-specific key.

Review migration SQL and backup before upgrades. Rebuild the app, inspect each target;
there is intentionally no startup migrate deploy against saved profiles. If a future
version requires schema changes, use a controlled offline migration procedure with the
correct provider history; do not initialize a populated database or force acceptance.
Keep a known-good application build plus matching backups for rollback.

An abandoned management lock after a hard crash is fail-closed. Stop the supervisor
and all child/Prisma processes; confirm no DB initialization is still running, inspect
the target with the DBA, then run `npm run control:recover -- unlock --offline-confirmed`
in the correct control directory environment. For a forgotten operator password, set
IT_ASSETS_NEW_OPERATOR_PASSWORD securely in the process environment, run
`npm run control:recover -- password --offline-confirmed`, then unset the variable.
This revokes control sessions; it does not reopen registration or change asset users.
Both offline actions require local file access and exclusive ownership and are audited.

## Validation commands

```powershell
npm test
npm run typecheck
npm run lint
npm run build:managed
npm run test:managed-http
```

The HTTP test owns 4050 briefly and creates a temporary control store. No configured
asset DB is used. The live workflow fixture suite expects explicitly provisioned blank
loopback databases it_assets_managed_a_test (MariaDB) and it_assets_managed_b_test
(SQL Server with IT_ASSETS_TEST_SQL=1, otherwise MariaDB). Use the dedicated fixture
username it_assets_test, set IT_ASSETS_TEST_PASSWORD, optionally override fixture ports,
then run `npm run test:managed-db`. This suite writes disposable records and proves
partial/unrelated schema rejection, CRUD, transactions, assignments, loans, nullable
uniqueness and isolation. Do not point it at an existing installation. The mixed-provider
GitHub workflow provisions both service databases from scratch; it has not run locally.

### Results on this Windows host (2026-11-05)

- Both provider schemas validated and both clients generated with Prisma 6.19.2.
- 12 unit tests passed. ESLint, TypeScript, managed production build, and the legacy
  production build passed; the managed build completed 23 static pages.
- Private MariaDB 11.4.9 on loopback port 43327, using a new data directory: verified
  fresh migrations, schema/permission checks, preservation of an unrelated sentinel,
  refusal of partial schema, workspace bootstrap, asset CRUD, checkout/check-in, two
  completed loans, nullable uniqueness, transaction rollback, A/B/A selection and
  the existing database-backed integrations regression suite. No existing dev database
  was used. The private MariaDB process was shut down after the checks.
- Production HTTP smoke passed on 4050: one-time enrollment with no asset database,
  local login, denied unauthenticated action, redacted profile data, unreachable SQL
  Server diagnostics, profile removal, compatible inventory selection, process restart,
  workspace login, stale write rejection and persistent operator session.
- SQL Server DDL generation and offline filtered-index diff were verified. **No live
  SQL Server, Docker container, Microsoft Entra or Graph service was used.** The CI
  mixed-provider job is provided but not represented as a pass. Use the SSMS procedure
  above before treating SQL Server as production-validated.
- Observed non-blocking warnings: outdated Browserslist data and a tsx module-register
  deprecation under the installed Node 26.13.0. Managed Docker and CI specify Node 24.
- Final developer handoff: the default managed development launcher served the first-run registration page at localhost:4050 with no operator enrolled and no active asset profile.
