# Phase 5: existing Docker/MariaDB upgrade — production blocked

Current operator procedure: [Phase 5D isolated acceptance kit](docker-upgrade-acceptance.md).
Persistent presentation, Entra, mail and timezone runtime is now implemented through
Phase 5C.5; the historical implementation notes below describe earlier phases.
Live Docker/cross-provider acceptance and production approval remain outstanding.

Existing managed-profile edits now have an explicit
[capture/review/rollback procedure](managed-configuration-reconciliation.md). This
does not authorize production execution or complete Entra/mail/timezone runtime integration.

Phase 5C adds an explicit `stage-configuration EXACT_DATABASE_NAME` operation to the
offline adoption command. It stores an encrypted, allowlisted snapshot only; it does
**not by itself** preserve runtime settings when switching databases. A separate,
authenticated [presentation runtime transition](installation-presentation-runtime.md)
now enables shared title, session timeout and branding. Entra/mail/timezone runtime
integration remains incomplete. See the
[ownership audit, rollback contract and remaining acceptance work](installation-configuration.md).

This is a candidate upgrade procedure for 0.6.0, not production approval. The audit
covered repository files, not the actual deployment. No production/development
database, control store, Compose configuration or secret was accessed. Compare the
deployed configuration privately against these findings before using the commands.
Docker is unavailable on the implementation host; container/image rollback and live
Entra acceptance must execute in an isolated Docker rehearsal before production.

## Architecture findings

The checked-in `docker/docker-compose.example.yml` defines `mariadb`, `it-assets`
and `it-assets-reminder-worker`. MariaDB 11.4 stores its data in the host bind
`/opt/docker/data/it-assets-tracker/mariadb:/var/lib/mysql`. The application and worker
share `/opt/docker/data/it-assets-tracker/app:/data`. They obtain their connection
from **their own `DATABASE_URL` environment variable**, with `DB_MODE=local` and
`DB_PROVIDER=mariadb`. MariaDB's `MARIADB_*` initialization variables are not an
application connection source and do not change accounts in an already populated
data directory. Actual service names, image digests, database names, mounts and
networks must be inventoried on the deployment; this example is not proof of them.

| Concern | Legacy | Managed upgrade |
| --- | --- | --- |
| Image/startup | `docker/Dockerfile`, Node 20 Alpine, `scripts/docker-start.mjs` | `docker/managed.Dockerfile`, Node 24 Debian, supervisor/managed web |
| Schema changes | Entrypoint runs generate, migrate deploy and bootstrap before serving | No automatic migration/bootstrap; adoption only inspects |
| Connection | `DATABASE_URL`, or separate legacy external-SQL bootstrap (not supported by this adoption path) | Encrypted profile in SQLite, explicit activation and revision-pinned child |
| Local installation | No managed control store assumed | Persistent `/data/control`, `control.sqlite`, `control.key`, `owner.sqlite`, profile workspaces |
| Workspace data | MariaDB records and migration history | Same database; no copy/reinitialization |
| Application settings key | `APP_SETTINGS_ENCRYPTION_KEY` | Preserve exact original key via secret file; do not substitute the derived default |
| Authentication | `Setting` rows; legacy secret is an environment reference or literal | Adoption copies validated non-secret configuration into profile-local auth config, referring to an explicit deployment secret |
| Branding files | Upload code writes `/app/public/branding/uploads`, which the example does **not** mount | Explicit backup/copy of referenced files into persistent profile branding; URLs translated when read |
| Sessions | Workspace `Session` table; legacy cookie names/signing key | New control-derived cookie realm/revision; expect users to sign in again |
| Reminder worker | Separate legacy service, same DB and settings key | Not supervised in managed mode; see worker acceptance restriction below |

The branding discovery is critical: backing up `/data` alone is insufficient. Extract
the current container's `/app/public/branding/uploads` **before removing/recreating it**.
Missing files make adoption fail; do not replace them with defaults silently.

The official MariaDB image grants access using escaped underscores in database names.
The previous inspector did not recognize that spelling. Phase 5 recognizes the exact
escaped target scope while still rejecting table-only or unrelated grants; fixture
validation includes that grant format. See the
[official entrypoint](https://github.com/MariaDB/mariadb-docker/blob/master/docker-entrypoint.sh).

## Configuration ownership

| Data/configuration | Persistence and handling |
| --- | --- |
| Assets, relationships, users/password hashes, roles, scopes/permissions, categories, locations, label templates, loans and audit/history | MariaDB tables, left unchanged. Permissions also use `Setting` values. |
| General Settings, branding URL references, timezone-related settings, email configuration | MariaDB `Setting` rows, left unchanged. Preserve `APP_TIME_ZONE` deployment override too. |
| Entra enablement/SSO, tenant/client IDs, redirect URI and group-to-role mappings | Legacy `authentication.*` settings remain unchanged. Validated settings copied to profile-local `auth_config`; later managed edits remain local and will not appear in legacy rollback. |
| Entra secret | Existing environment reference or legacy literal is resolved privately by preflight and compared to the supplied unchanged `IT_ASSETS_ENTRA_SECRET_UPGRADE_FILE`. Only its reference is copied to local auth config. The original DB value is not rewritten. |
| Exchange client secret | `mail.clientSecretEncrypted`, AES-256-GCM under original `APP_SETTINGS_ENCRYPTION_KEY`; preflight must decrypt it successfully without printing it. |
| Integrations | Registry code plus MariaDB `Setting` configuration, mappings and hashed bearer credentials; no new plugin or token issuance. |
| Branding binaries | Extract legacy container files; copy only referenced supported filenames, at most 2 MB each, refusing symlinks or conflicting destination contents. |
| Installation administrator, encrypted connections, activation/inspection state | Managed control volume, independently backed up with its original `control.key`. |
| Installation secrets | Original settings key and Entra secret remain protected deployment files. Control key is generated once in the control volume. Never bake any of these into an image. |

Legacy `AuthProviderConfig` and `BrandingAsset` tables are preserved even though the
current active settings services use `Setting`. Preserve the entire database, not a
handpicked table export. Legacy `/data/state`/uploads/bootstrap files must also be
backed up for rollback; they are not silently imported as managed connection sources.

## Adoption behavior and supported scope

`node --import tsx scripts/adopt-legacy.mjs check` is an offline preflight.
`... adopt EXACT_DATABASE_NAME` explicitly saves one **inactive** profile. The host
administrator authorizes the import; the enrolled installation administrator must
separately inspect and activate through the existing UI, including exact-name
confirmation and live compatibility checks. The command never invokes migration,
initialization, workspace bootstrap or activation.

Required input is `IT_ASSETS_ADOPT_DATABASE_URL_FILE`, an explicitly exported existing
`mysql://` URL. Ambient `DATABASE_URL`, `.env`, Docker discovery and network scans are
never candidates. The supported URL has a hostname/IPv4 address, port, database and
percent-encoded credentials. URL query options (including TLS), fragments, sockets,
IPv6 and unsupported names/credentials are rejected rather than silently stripped.
Deployments requiring those options remain blocked pending connector compatibility
work. MariaDB TLS support has not been extended by this phase.

The offline command holds the same `owner.sqlite` exclusive lock as the supervisor.
It verifies migration names/checksums, current schema, completed setup, authentication,
mail decryption and branding before creating a profile. Existing profile targets are
never overwritten or duplicated. Profile, auth config and adoption marker commit in
one SQLite transaction. Branding is copied first with exclusive creation; interrupted
copies can be retried only when their bytes match. No workspace rows are written.

Re-running the same adoption is a no-op after revalidation. Different credentials,
configuration, missing/edited profiles or conflicting files require review; a deleted
adopted profile is not silently recreated. An interrupted preflight can leave an empty
owner-lock database/control directory, and an interrupted copy can leave harmless
orphan branding files. Neither is activation. Preserve them for diagnosis; do not reset
the control store as routine recovery.
Retargeting the adopted profile is refused so its workspace files/configuration cannot
be attached to a different inventory; create a separate connection instead.

Activation and supervisor startup verify the adopted settings key and Entra secret.
An absent/wrong original secret fails closed. After deliberate Entra secret rotation,
use a **new** `IT_ASSETS_ENTRA_SECRET_*` reference through managed Authentication
Settings; the original alias is reserved for verified adoption. Settings-key rotation
requires a separate reviewed re-encryption procedure. Keep a local workspace recovery
administrator before cutover; adoption preserves an existing disabled-local-auth policy.

## Backup and pre-upgrade audit (owner commands, Linux shell)

These commands target the **repository example's** services and bind paths. Adjust
them only after verifying the actual deployed Compose configuration. Do not run them
against production until the isolated rehearsal below passes. Run as the deployment
administrator with a protected shell, no tracing (`set -x`), and no public terminal logs.

```sh
set -eu
umask 077
LEGACY=/absolute/path/to/deployed-compose.yml
BACKUP=/absolute/protected/path/it-assets-pre-060
mkdir -p "$BACKUP" "$BACKUP/secrets" "$BACKUP/branding"
docker compose -f "$LEGACY" config --services
docker compose -f "$LEGACY" ps
# config may contain passwords: save privately, never paste its output into support.
docker compose -f "$LEGACY" config > "$BACKUP/compose.resolved.yml"
cp "$LEGACY" "$BACKUP/compose.original.yml"
docker inspect "$(docker compose -f "$LEGACY" ps -q it-assets)" > "$BACKUP/app.inspect.json"
docker inspect "$(docker compose -f "$LEGACY" ps -q mariadb)" > "$BACKUP/db.inspect.json"
docker image inspect "$(docker compose -f "$LEGACY" images -q it-assets)" > "$BACKUP/image.inspect.json"
```

Record exact old image IDs/digests (app, worker and MariaDB), source commit, Node version,
public URL/Entra callback, network name, mounts, database name and applied migrations.
Save image archives with `docker image save` if immutable old images cannot be pulled.
Back up the original environment/secret files privately, including worker overrides.
Check database engines are InnoDB, note grants and ensure no concurrent DDL/writers.
Review every pending MariaDB migration against a restored copy; do not rely on version
number alone. Managed inspection rejects pending/failed/unknown/checksum-mismatched
history and schema drift. Do not use `migrate resolve`, reset or fake baselines to bypass it.

While the old app still runs, export the exact supported source without retyping it:

```sh
docker compose -f "$LEGACY" exec -T it-assets node -e \
  'if(!process.env.DATABASE_URL)process.exit(1);process.stdout.write(process.env.DATABASE_URL)' \
  > "$BACKUP/secrets/database_url"
docker compose -f "$LEGACY" exec -T it-assets node -e \
  'if(!process.env.APP_SETTINGS_ENCRYPTION_KEY)process.exit(1);process.stdout.write(process.env.APP_SETTINGS_ENCRYPTION_KEY)' \
  > "$BACKUP/secrets/settings_key"
```

If no original settings key exists, first establish that no encrypted settings exist.
Do not invent a replacement for a lost key. Only for a verified installation with no
encrypted settings, create one new durable key and retain it for all future backups.
Managed startup retains its existing derived-key default unless a managed settings-key
override or explicit `APP_SETTINGS_ENCRYPTION_KEY_FILE` is provided. An ambient legacy
`APP_SETTINGS_ENCRYPTION_KEY` alone does not silently change an existing managed store.

For Entra, use a private DBA/settings audit to identify whether the stored reference is
an environment name or literal. Export the resolved value to `secrets/entra_upgrade`
without printing it. Example using the old application's own Prisma client/config:

```sh
docker compose -f "$LEGACY" exec -T it-assets node -e '
 const {PrismaClient}=require("@prisma/client"); const db=new PrismaClient();
 (async()=>{const row=await db.setting.findUnique({where:{key:"authentication.entra.secretReference"}});
 const ref=(row?.value||"").trim(); if(!ref)throw Error("No configured Entra secret");
 process.stdout.write(process.env[ref]||ref)})().catch(()=>{process.exitCode=1}).finally(()=>db.$disconnect());
' > "$BACKUP/secrets/entra_upgrade"
```

If the reference is an environment name, supply that **same variable/value only to the
offline adoption service**, via a private temporary `env_file` overlay or Compose secret
environment mapping reviewed for the deployment. This lets preflight compare the
original resolution to the new alias. The checked-in Entra overlay supplies only the
new alias and deliberately cannot guess arbitrary old environment names. For a legacy
literal, the additional variable is unnecessary. Never save an old `.env` in Git.

Stop writers, then back up the database and files:

```sh
docker compose -f "$LEGACY" stop it-assets it-assets-reminder-worker
docker compose -f "$LEGACY" exec -T mariadb sh -ec \
  'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb-dump --user=root --single-transaction --routines --events --triggers --hex-blob --databases "$MARIADB_DATABASE"' \
  > "$BACKUP/inventory.sql"
# Stopped containers can still be copied; do not recreate the old app first.
APP_CONTAINER=$(docker compose -f "$LEGACY" ps -aq it-assets)
docker cp "$APP_CONTAINER:/app/public/branding/uploads/." "$BACKUP/branding/"
tar -C /opt/docker/data/it-assets-tracker -czf "$BACKUP/app-data.tgz" app
sha256sum "$BACKUP/inventory.sql" "$BACKUP/app-data.tgz" > "$BACKUP/SHA256SUMS"
sha256sum -c "$BACKUP/SHA256SUMS"
```

The dump command uses the example's root-password environment and database name; a
deployment using `_FILE` secrets must read its verified secret file instead. Absence
of a branding directory is acceptable only after confirming no custom URL references.
Do not tar live MariaDB data as a substitute for a consistent backup. Protect and
encrypt off-host copies: SQL/config backups may contain plaintext legacy Entra secrets.

**Backup verification requires restore**, not just a successful dump/hash: create a
separate isolated MariaDB of the same version, import the SQL, compare row counts,
relationships, settings, history and branding hashes, and test decryption using the
original key. Use the original app image to validate local login, Entra and inventory on
that restored fixture with email/network side effects disabled. Never point the rehearsal
at the production bind directory or production network. Retain evidence and timestamps.

Example isolated database restore (use unique unused names and the original pinned
MariaDB image; `restore_root_password` is a newly generated **test-only** secret file):

```sh
RESTORE_VOLUME=it_assets_restore_verification_060
RESTORE_CONTAINER=it-assets-restore-verification-060
MARIADB_IMAGE=your-original-mariadb-image-at-verified-digest
if docker volume inspect "$RESTORE_VOLUME" >/dev/null 2>&1; then exit 1; fi
docker volume create "$RESTORE_VOLUME"
docker run -d --name "$RESTORE_CONTAINER" --network none \
  --mount "type=volume,source=$RESTORE_VOLUME,target=/var/lib/mysql" \
  --mount "type=bind,source=$BACKUP/secrets/restore_root_password,target=/run/secrets/root,readonly" \
  -e MARIADB_ROOT_PASSWORD_FILE=/run/secrets/root "$MARIADB_IMAGE"
# Wait for initialization/health and verify the destination is the new isolated server.
docker exec "$RESTORE_CONTAINER" healthcheck.sh --connect --innodb_initialized
docker exec -i "$RESTORE_CONTAINER" sh -ec \
  'MYSQL_PWD="$(cat /run/secrets/root)" exec mariadb --user=root' < "$BACKUP/inventory.sql"
```

Do not proceed if the health check/import fails. Compare migration history and table
counts against the backup inventory, then use a separately isolated application network
for full old/new-image rehearsals. Never attach this restore container to production.

## Candidate Compose deployment and cutover

`docker/compose.upgrade.yml` starts only the managed app and a maintenance adoption
service. It attaches to the explicitly named **existing** MariaDB network, and uses an
external control volume. It never defines/recreates MariaDB or its storage. Keep the
old Compose project/database service running; stop only old app/worker during cutover.
Do not run `down -v`, `volume rm`, delete a bind directory, or run two MariaDB processes
against one data directory. Do not change MariaDB versions during this app upgrade.

1. Build the managed image in CI/rehearsal and record an immutable tag/digest. Keep the
   old app/worker images available. Do not build a production image from a workspace
   containing credentials or backups; `.dockerignore` now excludes known backup roots.
2. Stage private copies of the verified key/URL/optional Entra secret and branding backup
   outside the checkout. Runtime UID/GID is `node` (1000 in the base image); verify it.
   File-backed Compose secrets use bind mounts: make staged files readable to this UID
   via restricted group permissions/ACLs, not world-readable. Keep originals root-only.
3. Create a **new** dedicated named control volume, fail if that name already exists,
   then initialize only its root ownership to the verified runtime UID/GID. Never change
   ownership of MariaDB's existing data directory or reuse a development control volume.

```sh
export IT_ASSETS_MANAGED_IMAGE=your-registry/it-assets:tested-060-immutable-tag
export IT_ASSETS_CONTROL_VOLUME=it_assets_control_060
export IT_ASSETS_EXISTING_NETWORK=verified_existing_compose_network
export IT_ASSETS_SETTINGS_KEY_FILE=/absolute/private/runtime/settings_key
export IT_ASSETS_LEGACY_DATABASE_URL_FILE=/absolute/private/runtime/database_url
export IT_ASSETS_LEGACY_BRANDING_DIR=/absolute/private/runtime/branding
export APP_URL=https://your-unchanged-app.example
export APP_TIME_ZONE=America/Toronto # retain the deployed value, not this example blindly
export IT_ASSETS_BIND_ADDRESS=127.0.0.1 # use the verified proxy/network arrangement
export IT_ASSETS_HOST_PORT=4050
if docker volume inspect "$IT_ASSETS_CONTROL_VOLUME" >/dev/null 2>&1; then
  echo 'Control volume already exists; review it instead of overwriting.' >&2; exit 1
fi
docker volume create "$IT_ASSETS_CONTROL_VOLUME"
docker run --rm --user root --entrypoint sh -v "$IT_ASSETS_CONTROL_VOLUME:/data/control" \
  "$IT_ASSETS_MANAGED_IMAGE" -ec 'chown 1000:1000 /data/control; chmod 700 /data/control'
```

For no Entra secret, use `UPGRADE='docker compose -f docker/compose.upgrade.yml'` in a
shell function/array appropriate to your shell. The examples below use a Bash array:

```sh
UPGRADE=(docker compose -f docker/compose.upgrade.yml)
# If Entra is configured, instead use BOTH files:
# export IT_ASSETS_ENTRA_SECRET_FILE=/absolute/private/runtime/entra_upgrade
# UPGRADE=(docker compose -f docker/compose.upgrade.yml -f docker/compose.upgrade-entra.yml)
"${UPGRADE[@]}" config --quiet
"${UPGRADE[@]}" --profile maintenance run --rm adoption
# Only after reviewing the sanitized target and successful preflight:
"${UPGRADE[@]}" --profile maintenance run --rm adoption \
  node --import tsx scripts/adopt-legacy.mjs adopt it_assets
"${UPGRADE[@]}" up -d it-assets
"${UPGRADE[@]}" ps
```

Use the actual database name instead of `it_assets`. Do not start adoption and the web
supervisor simultaneously. The importer works before enrollment; it does not create a
workspace account. Visit `/setup`, enter local organization details, read the one-time
token through the container's configured control directory, enroll the installation
administrator, and select/reinspect the adopted connection. Do **not** initialize it.
Activate by typing its exact name, wait for verified readiness, then sign into the
existing workspace. Organization enrollment does not overwrite workspace branding.

The Compose healthcheck is control-plane **liveness**, not proof of inventory readiness.
Use authenticated `/setup/status`/the UI to confirm compatible schema, selected profile,
revision and live supervisor process. A wrong/missing original key blocks activation
and startup, not just email later. Restore that exact secret and restart; never generate
a new key as a recovery shortcut. Do not remove the adoption source files until your
Compose maintenance service definitions are updated to stop referencing them.

Verify local authentication, real Entra redirect/SSO/group mapping, role visibility,
General Settings, four branding variants, category/location/label relationships,
existing loans/checkout history, an authorized inventory workflow, integration tokens
and assignments, mail-secret decryption, timezone behavior and restart persistence.
Compare original counts/checksums and record any deliberate test writes. Preserve the
whole stopped control volume and runtime secret files as the post-adoption backup.

**Reminder worker restriction:** managed supervision still does not launch a worker.
The existing legacy worker can only be considered for restart against this same adopted
MariaDB and original key after dry-run/email acceptance. It does not follow managed
database switches. Until an operationally enforced single-workspace policy or a tested
revision-aware worker exists, switching while that worker runs is unsafe. Reminder
continuity is a production blocker; do not silently disable reminders and call the
upgrade complete. No reminder emails were sent during implementation tests.

## Controlled migration and rollback

If compatibility fails, stop before adoption/activation. Restore a backup into an isolated
MariaDB, inspect `_prisma_migrations` against `prisma/migrations/mariadb`, review each
pending SQL file and a schema diff, and explicitly approve a migration plan with expected
data effects and downtime. Apply only on that copy first, repeat preservation/auth tests
and restore tests, then seek separate production approval. This phase adds no migration
and does not authorize production DDL. Existing initialized databases never use the
empty-database initialization workflow.

Before any managed workspace writes and with no schema migration, app rollback is:

1. Stop managed app and any adoption process; preserve the full control volume and
   deployment secrets for diagnosis (including SQLite WAL/SHM if present). Do not delete it.
2. Keep MariaDB and its existing storage unchanged. Verify the database schema/history
   and application-level writes are still compatible with the old image.
3. Restore the original Compose/environment/image pins and original `/data` files if
   changed. Restore extracted branding files to the **old container** if necessary;
   the original stopped container is preferable to recreation because of its uploads.
4. Start only the old app against the unchanged MariaDB. Its original entrypoint runs
   `migrate deploy`/bootstrap: verify exact old image/migration history first, or override
   its command to `node server.js` after confirming startup directories/configuration
   already exist. Do not let an unknown entrypoint mutate the rollback database.
5. Verify login/Entra/settings/inventory, then separately restore the worker after its
   own validation. New managed cookie realms require sign-in; old sessions are not moved.

For the unchanged-schema/original-stopped-container case only, after those checks:

```sh
"${UPGRADE[@]}" stop it-assets
# Original app image/entrypoint and unchanged migration history must be reviewed first.
docker compose -f "$LEGACY" start it-assets
# Only after separate worker/email acceptance:
# docker compose -f "$LEGACY" start it-assets-reminder-worker
```

The legacy database/settings rows were never rewritten by adoption, so their original
Entra reference remains available for rollback. Managed Authentication Settings edits
are local; reconcile deliberate later changes privately before rollback. New branding
uploads/managed URLs and any other post-cutover writes require a reviewed reverse-copy
or point-in-time restore plan. A DB restore discards post-backup writes and is **not** a
routine reversible operation. Obtain explicit downtime/data-loss approval, restore to a
separate volume/database first, validate, and switch deliberately; preserve the failed
volume. Never import a dump over an unknown populated database as a rollback shortcut.

If schema migrations were performed later, old code may be incompatible: use the
verified pre-upgrade database backup together with matching code, settings key, app
files, Entra secrets and control backup. An app image rollback alone cannot undo DDL,
secret rotation, reminder emails or other external effects. No production rollback
command has been executed in this phase.

## Validation evidence and outstanding gates

Executed on 2026-11-10:

| Check | Result and scope |
| --- | --- |
| `npm test` | 37 passed, including Docker-style grant scopes, URL rejection, Entra conversion, encrypted/idempotent profile persistence, conflicting/retargeted profiles, interrupted branding copy and secret-file loading |
| `npm run typecheck`, `npm run lint` | Passed; a concurrent build briefly removed generated Next type files during one typecheck, which passed after the build completed |
| `npm run build:managed` | Passed after the owner stopped the existing app that held a Prisma DLL lock |
| Legacy Next build | Passed with explicit unreachable MariaDB URL and unchanged generated clients; no database startup/migration command used |
| `tests/managed-db/adoption.test.ts` | Passed on a new private MariaDB 11.4.9 data directory, loopback 43331, random fixture password; full-table equality through adoption/reconnect/selection rollback, configuration/credential preservation and rejection cases |
| `scripts/test-adoption-http.mjs` | Passed: adopted readiness, preserved user login/asset/settings pages, branding bytes, Entra redirect parameters, two supervisor starts and wrong-key startup refusal |
| Compose YAML | Three files parsed successfully with `js-yaml`; **not** a Docker Compose semantic/runtime validation |
| Docker/old image/restore/image rollback/live SSO | **Not executed**: Docker command and standard installation executable absent; release blocked |

Tests used new temporary control directories and new disposable databases only. All
test web/database servers were stopped afterward. Existing saved development config,
databases and backup folders were untouched. The owner stopped their app for validation;
restart the usual development configuration with `npm run dev` and original overrides.
No production operation or push occurred. Existing Browserslist/module.register warnings
remain unrelated to this change.

Native reproduction requires a newly provisioned empty
`it_assets_managed_up5a_test` on 127.0.0.1:43331 with the scoped `it_assets_test` account
and its explicitly supplied `IT_ASSETS_TEST_PASSWORD`; never reuse an existing inventory.
Run `node --conditions=react-server --import tsx --test tests/managed-db/adoption.test.ts`.
The optional HTTP check consumes that test's `it-assets-adoption-integration-*` temporary
directory through `IT_ASSETS_ADOPTION_TEST_DIRECTORY`, after `build:managed`, on free port
4050: `node --import tsx scripts/test-adoption-http.mjs`. It performs deliberate fixture
logins (session/last-login writes) after the read-only preservation comparison, and never
follows the external Entra redirect. These native checks do not substitute for Docker.

The representative test uses a fixed disposable database name and refuses to run on a
nonempty database. It snapshots **every** Prisma table and migration history before and
after adoption/reconnect/selection rollback. Its fixtures include a user/role, asset
relationships, category/location/label, loan and checkout audit, General Settings,
branding, Entra configuration, encrypted mail and representative integration/permission
settings. These are preservation fixtures, not live SSO or full integration acceptance.

Container rehearsal harness (not executed here):

```sh
docker compose -f docker/compose.upgrade-test.yml up --build --abort-on-container-exit --exit-code-from test
docker compose -f docker/compose.upgrade-test.yml down
```

This isolated harness uses a tmpfs MariaDB and private Compose network, no host data
mounts and no production secrets. It tests adoption inside the candidate Linux image;
it does **not** prove upgrade from the actual old image, Compose-volume persistence,
Entra/Graph, reverse-proxy behavior or complete image rollback. Perform those additional
checks using representative/restored non-production fixtures, with old/new image pins,
record counts, secret/file hashes, startup/restart logs and rollback evidence.

Production remains blocked on container build/start, old-image-to-managed upgrade,
durable volume/key/branding restart, backup restore, image rollback, live Entra/role
mapping, integration/email workflows, reminder continuity and the actual deployed
schema/configuration audit. SQL Server adoption is outside this MariaDB-only path.

References: [Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/),
[external volumes](https://docs.docker.com/reference/compose-file/volumes/), and
[MariaDB logical backup/restore](https://mariadb.com/docs/server/clients-and-utilities/backup-restore-and-import-clients/mariadb-dump).
