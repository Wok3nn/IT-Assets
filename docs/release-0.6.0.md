# IT Assets 0.6.0 — pending production acceptance

Phase 4 builds on the unified setup and database management architecture. The supplied
five-page PDF was not available in the attachment directory or repository; implementation
uses the accompanying summarized requirements.

## Changes

- Installation administrator text is concise. Enrollment help shows the configured
  token-file path and an appropriately quoted local shell command. Docker instructions
  read the container's configured `IT_ASSETS_CONTROL_DIR`. The unauthenticated page
  never opens or displays the secret token. Enrollment and the 14-character minimum
  remain unchanged.
- Connection forms pair the custom name and database type, hostname and port, then
  database credentials. Required markers and contextual help explain each field.
  MariaDB defaults to port 3306 when switching from the untouched SQL Server default;
  a customized port is preserved. Encrypted saved credentials are never filled back
  into browser fields. SQL Server certificate validation remains enabled by default.
- Workspace Preparation shows database type, hostname, name, port and selection state.
  Technical detail moves into keyboard/touch-accessible information help. Compatible
  reuse, initialization warnings and errors remain next to the relevant actions.
- Every inspected, compatible, inactive connection has Activate Database. A native
  modal dialog traps focus, supports Cancel/Escape before submission and requires the
  exact target name. It submits the existing action with profile version and activation
  revision; that action rechecks authorization, origin and live compatibility under
  the operation lock. No second activation implementation is introduced.
- Settings activation shows bounded post-restart verification for the exact profile
  and revision. The existing `/setup/status` readiness check supplies live evidence;
  a different selection cannot produce success for an old activation request.
  First-run congratulations and its checklist retain their presentation.
- Package metadata, sidebar and Patch Notes share version 0.6.0. Historical Patch Notes
  remain historical. Production acceptance is explicitly pending.

## Connection fields and credentials

| Field | Meaning |
| --- | --- |
| Connection Name (Custom Name) | Any friendly label; it need not equal the database name. |
| Database hostname / IP | Address reachable from the application process/container. |
| Database name | Exact existing target database; saving never creates or initializes it. |
| TCP port | Usually MariaDB 3306 or SQL Server 1433. Across a host boundary use the published port; on a Compose network use the database listener port. |
| Database username | A MariaDB/SQL Server login authorized for that database. |
| Database password | That database login's password, stored encrypted locally. |

Windows/Linux VM accounts and Docker host accounts provide operating-system access;
they are not database logins. Installation administrators manage local configuration;
workspace accounts sign into inventory. Neither substitutes for MariaDB credentials.

The checked-in legacy `docker/docker-compose.example.yml` names the database service
`mariadb` and the application service `it-assets`. On their shared network the example
target is `mariadb:3306`. The managed `docker/compose.managed.yml` contains only `web`;
it does not create or discover a MariaDB server. Inspect the **deployed** Compose file
or run `docker compose -f <your-compose-file> config --services` to identify its names.
Separate Compose projects need an intentionally configured shared network or reachable
database endpoint; `localhost` inside the app container means that container itself.
No database network scanning is performed.

### A dedicated MariaDB account

These are owner/DBA instructions, not commands run against existing databases in this
phase. Replace the example database and allowed application source IP before execution.
Use an existing database for reuse; do not recreate it. Example for an already compatible
database named `inventorydb`:

```sql
CREATE USER 'itassets_app'@'10.20.30.40'
  IDENTIFIED BY 'replace-with-a-unique-generated-password';
GRANT SELECT, INSERT, UPDATE, DELETE ON `inventorydb`.*
  TO 'itassets_app'@'10.20.30.40';
SHOW GRANTS FOR 'itassets_app'@'10.20.30.40';
```

For explicit initialization of a separately provisioned **empty** inventory, the
provisioning account additionally needs schema DDL privileges such as CREATE, ALTER,
DROP, INDEX and REFERENCES on that database. Review migration requirements with the
DBA; reduce privileges after provisioning as deployment policy requires. Do not grant
global privileges or GRANT OPTION. Restrict the account's host to the app's actual source
address/network; Docker networking can change which address the database sees. Database
grant patterns treat `_` and `%` specially, so escape them when granting access to names
containing those characters. See MariaDB's official
[CREATE USER](https://mariadb.com/docs/server/reference/sql-statements/account-management-sql-statements/create-user)
and [GRANT](https://mariadb.com/docs/server/reference/sql-statements/account-management-sql-statements/grant)
references for account/host matching and privilege scope.

Transport policy is unchanged. SQL Server uses encrypted connections and retains the
explicit development-only trust-certificate option. This release adds no MariaDB TLS
configuration UI; validate the existing MariaDB transport/network policy separately
before production acceptance. Do not assume an encrypted connection merely because
the password is encrypted at rest.

## Environment preconfiguration investigation

The legacy Compose file sets `DATABASE_URL` on its app and `MARIADB_DATABASE`,
`MARIADB_USER`, `MARIADB_PASSWORD` on its database service. Those database-container
variables are not automatically present in the web container. Managed startup
intentionally does not load legacy `.env` files and replaces the child `DATABASE_URL`
with a disabled URL until explicit profile activation. After activation that value
belongs to the selected backend, not a safe import candidate.

Therefore this release does **not** prefill browser credentials, scan networks, import
profiles or activate anything from ambient deployment variables. Safe current workflow:
the owner reviews the deployed configuration privately, copies the non-secret target
fields and dedicated credentials into an authenticated Add Connection form, saves,
inspects and explicitly activates only a compatible target. Never paste environment
dumps or connection URLs into support logs.

A future import should require an explicit deployment source separate from the runtime
URL, authenticated preview of sanitized target metadata, validated provider/TLS options,
and an explicit save into encrypted storage. Passwords must remain server-side; imports
must never test, initialize or activate implicitly. This investigation introduces no
changes to legacy startup or the production Compose stack.

## Validation and rollout

| Check | Result |
| --- | --- |
| Unit/regression suite | 29 passed, including configured token command quoting, exact-target readiness, compact summary and version consistency |
| Typecheck and lint | Passed |
| Managed build | Passed; initial Prisma DLL lock cleared after the owner stopped the existing app |
| Legacy build | Passed with explicit unreachable MariaDB URL, using the unchanged clients generated by the managed build |
| Disposable MariaDB lifecycle | Passed: initialization safeguards, unrelated/partial rejection, CRUD and isolated switching |
| Compatible-reuse HTTP flow | Passed: offline enrollment, token redaction, independent auth/sidebar, exact-name rejection without selection change, management switching and exact-profile/revision readiness after restart |
| Empty-initialization HTTP flow | Passed: explicit initialization, repeat refusal, activation and the same management switching checks |
| Browser | Passed: configured token instructions, 0.6.0 sidebar/Patch Notes, original sidebar before switching, aligned actions, dialog focus/Escape/restore, wrong-name rejection, successful switching and readiness, preparation help, unchanged congratulations/checklist |
| Responsive browser | Desktop 1440px, tablet 768px, mobile 390px; no horizontal overflow in tested forms/dialog/help; light/dark presentation checked |

The live checks used MariaDB 11.4.9 with a **new** private data directory, random
credentials, loopback port 43330, and dedicated `it_assets_managed_ux4{a,b,c}_test`
databases. HTTP and browser tests used new temporary control directories. The existing
development databases, saved control configuration and pre-existing backups were not
modified. The owner stopped the existing server to free port 4050; all servers started
for this phase were stopped afterward. Restart the usual development configuration
with `npm run dev` in the original terminal, preserving any original control-directory
override. No push or production deployment was performed.

Switching retains the established session behavior: the old workspace session ends.
The database-independent recovery sidebar can appear until the operator signs into
the selected workspace. Management sign-in never grants workspace access. A fresh
management sign-in may also be needed after a document reload during restart.

Live SQL Server, production migration, Docker, broader crash recovery and a Node
runtime matrix remain pending; no production rollout is implied. Existing old
Browserslist/module.register warnings remain. MariaDB transport/TLS configuration
was not expanded or certified by this UI release.
Use [isolated setup instructions](unified-first-run-setup.md) and the
[compatible-reuse procedure](setup-ux-refinement.md#safe-owner-test-with-an-existing-compatible-development-database).
Do not initialize/reset an existing inventory to test the UI.
