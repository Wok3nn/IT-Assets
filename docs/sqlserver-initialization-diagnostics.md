# SQL Server initialization diagnostics

## Established failure and fix (2026-11-09)

Prisma 6.19.2 rejected the managed SQL Server migration history with **P3019**:
the migration engine identifies this connector as `mssql`, but the managed
`migration_lock.toml` incorrectly contained `sqlserver`. This happens before
migration SQL executes. The lock now uses `mssql`; the Prisma schema correctly
continues to use `provider = "sqlserver"`. No migration SQL or checksums changed.
See [Prisma's explanation of the distinct provider names](https://github.com/prisma/prisma/issues/12087).

The initialization request flows from `panel.tsx` to `actions.ts`. The action
authenticates the local operator, checks profile version/selection revision and
database-name confirmation, then loads the saved profile, including its decrypted
credentials. `schema-service.ts` inspects the schema, requires an empty database
and ownership, runs `prisma migrate deploy --config prisma.managed.config.ts`,
then bootstraps the workspace in a transaction. The CLI receives the saved
profile's provider and URL through explicit environment overrides. It does not
use the legacy MariaDB URL for this request.

`profile-client.ts` builds the SQL Server JDBC-style URL with braced database,
username and password values, encryption enabled, `schema=dbo` and the saved
certificate-trust setting. The same saved profile successfully connected using
the generated client and reached the migration engine. No URL change was needed.
The initial SQL Server migration was reviewed; its transaction, foreign keys and
filtered unique indexes were not the cause of P3019. Executing that DDL remains
an outstanding validation step.

Previously, rejected CLI execution propagated directly to the generic catch in
`actions.ts`, hiding its captured stderr. Service catches now emit structured
server-only `[database-management]` records: stage, reference, public target,
Prisma codes, SQL error numbers, known migration/provider names, process status
and static diagnostic hints. Arbitrary messages, stack traces, CLI arguments,
stdout/stderr, usernames, passwords and connection URLs are never logged.
Browser errors remain generic. Repeated catches of the same error log once.

## Verification

Read-only checks against the saved development profile confirmed:

- Endpoint `CWCAS-AZ-DB01:1433`, actual database `IT-Assets_DEV`.
- EngineEdition 3; db_owner, VIEW DEFINITION and CREATE TABLE checks all returned 1.
- No user objects were present.
- Before the fix, `prisma migrate status` reproduced P3019.
- After the fix, it reported pending migrations, expected for the empty database.

No initialization, seed, reset, migration recovery or MariaDB connection was
performed during this investigation. Successful live migration execution and
asset workflows are **not yet verified**.

## Safe local retry

1. From the project directory, stop the existing development server with Ctrl+C
   and restart with `npm run dev`. Preserve `.managed-data` and any existing
   `IT_ASSETS_CONTROL_DIR` setting. Open http://localhost:4050 and log in as the
   local administrator.
2. Optionally run this read-only diagnostic in another terminal:

   ```powershell
   Set-Location C:\Projects\MyApps\It-Assets-Tracker
   node --import tsx scripts/diagnose-sqlserver.ts IT-Assets_DEV
   ```

   It requires exactly one saved SQL Server profile matching the database name,
   opens the local control store read-only, queries permissions/catalogs and runs
   only `prisma migrate status`. It never deploys or prints credentials. Confirm
   the target, `owner: 1`, `user objects []` and pending migrations. If the target
   or results differ, investigate before proceeding.
3. In Settings → Database Management, choose that saved development profile,
   test its connection and **inspect the schema again immediately before
   initialization**. Proceed only if it is still empty and the target is
   `IT-Assets_DEV` on the intended development server.
4. Enter the workspace administrator details and exact database-name
   confirmation, then click **Initialize Database once**.
5. If it fails, do not retry automatically. Capture the sanitized
   `[database-management]` record from the server terminal and inspect the schema
   again. A partially applied migration or failed bootstrap requires separate
   investigation; do not reset the database or use `migrate resolve` blindly.
6. On success, inspect for a compatible schema, activate the profile, log in to
   the workspace and test asset creation/editing, assignments and loans with
   disposable development records. Validate persistence after restarting the app.

The diagnostic script is read-only, but step 4 intentionally writes the initial
schema and workspace records. These instructions do not authorize any production
target or changes to the existing MariaDB development database.
