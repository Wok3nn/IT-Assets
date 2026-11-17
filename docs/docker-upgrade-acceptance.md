# Phase 5D — isolated Docker upgrade acceptance kit

Status: **prepared locally; Docker/live acceptance NOT executed**. This kit follows
`8f0a255`. It changes no application features. Docker is unavailable on the implementation
host. Do not interpret local script tests as approval to upgrade production.

Do not run these commands automatically. An operator must explicitly authorize this new
acceptance project on `docker-vm-dev`. Nothing here targets the existing Astra containers,
`it-assets-v060-staging`, `it-assets-v060-legacy-restore`, staging control volume or
IT-Assets_DEV. Inventory export/import remains a separate user-controlled operation.

## Artifacts and boundaries

- `docker/compose.acceptance.yml`: project `it-assets-v060-upgrade-acceptance`; new
  project-scoped inventory, rollback-inventory and managed-control volumes. No external
  volumes, fixed container names, host Docker socket or exposed database port.
- Only one application at a time binds `127.0.0.1:4053`, forwarding to container 4050.
  Public URL is `http://localhost:4053`. Host/Origin/redirect safeguards remain intact.
- Its internal network blocks server-side external Graph/Entra traffic. Browser-originated
  Entra redirects are a separate boundary: do not initiate live SSO without approval. No worker exists.
  Preload/build images before starting. Verify network isolation on the actual Docker host.
- `scripts/acceptance/backup.py`: offline SHA-256 verification and private working-copy
  preparation. It never contacts Docker or prints paths/records/secrets on failure.
- `scripts/acceptance/restore.py`: operator-only streaming restore into an EMPTY database
  in the exact project/service. Rejects wrong confirmation, labels, running applications,
  nonempty tables and changed dump bytes. No automatic reset or cleanup on failure.
- `runtime.mjs`: fixed commands/targets; original key and Entra alias stay in private files.
  The legacy command starts the backed-up standalone `server.js` directly, bypassing the
  original migrate/bootstrap entrypoint. No historical migration is rewritten or run.
- `snapshot.mjs`: read-only database/installation verification. Private HMAC fingerprints
  compare every row, settings and embedded branding without emitting their contents.
- `docker/compose.acceptance-sql.yml`: gated overlay for a separately approved disposable
  SQL database and egress-restricted network. It creates no SQL database or network.

## 0. Authorization and operator prerequisites

[ ] Explicit approval to create/run ONLY this new project and its disposable copies.
[ ] No existing project named `it-assets-v060-upgrade-acceptance`; choose another reviewed
    kit/project name if it already exists. Never attach to its volumes by assumption.
[ ] Verified backup directory is the immutable source:
    `/home/sysadmin/it-assets-upgrade-rehearsal/astra-backup-20261116-170116`.
[ ] Exact legacy app image ID/digest and MariaDB version/digest recorded from backup,
    available locally. Do not inspect live Astra to discover them during this procedure.
[ ] Enough disk for SQL dump, two database copies, extracted data, image and evidence.
[ ] Python 3.9+ and Docker Compose v2 on the operator host; compatible pinned images.
[ ] The checked-out acceptance-kit source and managed image correspond to the recorded
    local commit. Transfer source/image by an approved method; this task does not push.
[ ] No shell tracing, session recording or public logs. Protect backup and run paths.
    Never print inspect JSON, URLs, keys, passwords, dump rows or resolved Compose config.
[ ] Source backup was consistent and has independently trusted provenance. Checksums
    detect damage, not malicious replacement of both files and manifest.

Commands below use Bash **on the explicitly authorized host**, from the checked-out repo:

```bash
set -eu
umask 077
BACKUP=/home/sysadmin/it-assets-upgrade-rehearsal/astra-backup-20261116-170116
RUN=/home/sysadmin/it-assets-upgrade-rehearsal/acceptance-NEW-UNIQUE-RUN
# Replace NEW-UNIQUE-RUN; RUN must not already exist or be inside BACKUP.
# Keep this mapping outside the repository; it contains file paths, not credential values.
cp scripts/acceptance/inputs.example.json /home/sysadmin/acceptance-inputs.private.json
```

Privately edit that mapping using the backup's actual file names; do not guess them.
`database_dump` supports SQL or gzip SQL. App data and branding must be tar archives
whose files are under the chosen prefixes (`data`, `uploads`, or empty for `tar -C ... .`).
Only regular files/directories are accepted; links, special files, traversal, duplicate
members, unrelated archive roots and oversized archives fail. Every selected source
file must be listed in the SHA-256 manifest. The script verifies the entire manifest.
If the backup format differs, stop and adapt/review the mapping/tool on disposable
fixtures; do not bypass verification or rename the original backup.

`application_inspect` is the saved single-container inspect JSON. Only APP_TIME_ZONE,
TZ and SESSION_SECRET are copied; original DATABASE_URL and arbitrary startup variables
are deliberately excluded. If Entra uses an environment reference, set
`entra_reference_env` to that original secret-variable name; its value is read privately
from the verified inspect backup. `entra_secret` can instead reference a verified secret
file (required for a DB-literal secret). When both exist they must match. Leave both null
only if Entra is unconfigured. Unsupported aliases require explicit tool review. The
original mail settings key is required; never invent one to replace a lost key.

```bash
python3 scripts/acceptance/backup.py verify --backup "$BACKUP" --manifest SHA256SUMS
python3 scripts/acceptance/backup.py prepare --backup "$BACKUP" --manifest SHA256SUMS \
  --inputs /home/sysadmin/acceptance-inputs.private.json --destination "$RUN"
cp scripts/acceptance/compose.env.example "$RUN/compose.env"
chmod 600 "$RUN/compose.env"
```

Use the actual relative checksum manifest name if different. Private preparation creates
new random disposable DB credentials, retargeted URLs for `inventory` and `rollback-db`,
separate mutable app/branding copies, immutable adoption-branding input, original keys,
and an HMAC evidence key. No original connection string is used for connectivity.
A failed preparation may leave a partial NEW directory; never reuse it as a successful
run. Inspect privately and choose a fresh path after correcting the cause.

Fill `compose.env` with absolute RUN path and pinned image IDs/digests. No passwords or
original connection strings belong in it. Build the managed image locally from the exact
reviewed commit before application startup:

```bash
docker build -f docker/managed.Dockerfile -t it-assets-acceptance:LOCAL-COMMIT .
# Privately record its immutable ID and source commit; set ACCEPTANCE_MANAGED_IMAGE.
```

The run directory must be outside this build context and Git checkout. Managed image
runs UID/GID 1000; grant it access only to the prepared app inputs, evidence and branding.
Check `realpath "$RUN"` is the intended fresh acceptance directory, never BACKUP, `/`,
a production path or a symlink, before any ownership change. On a host with a different
operator UID, explicitly change ownership of `$RUN/private/app`, `$RUN/evidence` and
`$RUN/branding` (and traversal rights on their prepared parents) to 1000. Do not recursively
change the original backup. DB root files are not mounted into application containers.

```bash
dc() { docker compose --env-file "$RUN/compose.env" -p it-assets-v060-upgrade-acceptance \
  -f docker/compose.acceptance.yml "$@"; }
dc config --quiet
# Inspect only service names, NOT resolved environment/secret contents.
dc config --services
```

[ ] Confirm only expected services; 4053 is free; no database port is published.
[ ] Confirm no acceptance container is attached to Astra/staging networks.
[ ] Record image digests/source commit, Docker/Compose versions and operator/date privately.

## 1. Restore and verify the legacy baseline

```bash
dc up -d inventory
# Wait until inventory is healthy; do not start any app yet.
python3 scripts/acceptance/restore.py --run "$RUN" --service inventory \
  --confirm it-assets-v060-upgrade-acceptance:inventory:it_assets --expected-tables 23
dc run --rm maintenance snapshot inventory record restore-baseline
```

The expected 23 tables comes from the supplied backup history. If count differs, stop;
do not change the expected count until the backup/schema difference is understood.
All per-table counts and HMAC row digests are in private evidence. Compare them with any
independently captured backup counts. Without original count evidence, report only
checksum-verified restore plus 23-table verification, not independent proof of source
row completeness. The logical dump remains the source for both disposable restores.

```bash
dc --profile legacy up -d legacy-check
```

Use `ssh -N -L 4053:127.0.0.1:4053 sysadmin@docker-vm-dev` from the operator workstation
if required, then visit `http://localhost:4053` in a dedicated private browser context.
No command in this kit opens that connection automatically.

[ ] Legacy login works with an authorized existing workspace test account.
[ ] Representative asset, assignment, category/location and loan records agree privately.
[ ] Existing user roles/scopes and a restricted user's denied operations agree privately.
[ ] Record original title, organization/site labels, timeout, branding appearance and
    effective timezone in a protected checklist, without pasting user data here.
[ ] Entra tenant/client/reference and mail tenant/client/sender show expected configuration;
    never reveal credentials. Do not click test email or perform external login.
[ ] Original branding images load; app data paths use only the prepared copies.
[ ] No schema initialization/migration ran. If the exact old image cannot run via its
    standalone server, stop and review its original entrypoint; never substitute latest.

```bash
dc stop legacy-check
dc run --rm maintenance snapshot inventory record pre-adoption
```

Legacy login can legitimately alter Session/User lastLoginAt; the new pre-adoption
baseline isolates those from adoption. Keep every source writer stopped through capture
and approval. No reminder worker should be running in this project.

## 2. Enroll, adopt, capture, review and enable

```bash
dc up -d app
# Copy the bootstrap token to a protected local file; do not print it in test output.
dc cp app:/data/control/bootstrap-token "$RUN/private/bootstrap-token"
chmod 600 "$RUN/private/bootstrap-token"
```

[ ] Use the token privately to enroll a NEW Installation Administrator. Use the exact
    legacy application title recorded above to avoid silently replacing organization title.
    Record organization/site identity separately; it is not a workspace account.
[ ] Confirm no workspace inventory access is granted by installation enrollment.

```bash
dc stop app
dc run --rm maintenance check
dc run --rm maintenance adopt it_assets
dc run --rm maintenance stage-configuration it_assets
dc run --rm maintenance capture
dc run --rm maintenance snapshot inventory compare post-adoption pre-adoption exact
dc up -d app
```

Adoption selects only the fixed disposable URL and saves an inactive connection. It must
not call Initialize. Exact row fingerprints must match before any workspace login.
The stage command's historical message about remaining runtime integration is stale;
activation is now available through the explicit panels below, not automatically.

[ ] Sign in separately as Installation Administrator, open the captured review.
[ ] Verify source is the disposable MariaDB profile and inspect every difference privately.
[ ] If organization/title conflicts, stop and explicitly correct the intended installation
    title while writers remain stopped, then stage/capture again. Never reset the store.
[ ] For unexpected differences choose Keep current; investigate and use `refresh` offline
    only when deliberate recapture is authorized. A stale review must not overwrite edits.
[ ] Type APPLY SNAPSHOT only after reviewing the captured values. No database activation.
[ ] Type ENABLE separately for appearance/session, configured Entra, mail and timezone.
    Mark Entra N/A only if the legacy installation had no Entra configuration.
[ ] Verify title, organization, branding, timeout, Entra tenant/client/status, Graph
    tenant/client/sender/status and timezone match the legacy baseline. Secrets stay hidden.
[ ] Inspect the adopted MariaDB profile as compatible, choose reuse and explicitly activate.
    NEVER initialize the nonempty adopted inventory. Wait for readiness for that exact
    profile/revision. Use normal workspace login with its own credentials.

```bash
dc stop app
dc run --rm maintenance snapshot adoption record adopted-globals
dc run --rm maintenance snapshot inventory compare activated-inventory pre-adoption workspace
dc up -d app
```

`adoption` rechecks the restored source, decrypts original mail/Entra credentials in
memory, canonicalizes enabled categories and compares the full installation snapshot
(including embedded branding). It writes only protected fingerprints. This proves
credential equivalence without displaying plaintext. It also verifies required runtime
markers and synchronized organization title. Run it before intentional configuration edits.
`workspace` comparison allows only Session changes and User lastLoginAt/updatedAt;
all remaining rows, credentials, roles and policy values must match. Investigate every
other difference privately instead of expanding the exception list casually.

## 3. Restart, recreation and offline persistence

```bash
dc restart app
# Verify browser readiness and settings, then stop before reading SQLite offline.
dc stop app
dc run --rm maintenance snapshot configuration compare after-restart adopted-globals exact
dc up -d --force-recreate --no-deps app
# Verify settings again, then capture:
dc stop app
dc run --rm maintenance snapshot configuration compare after-recreate adopted-globals exact
dc up -d app
dc stop inventory
```

[ ] Inventory access fails safely; no default or other database is substituted.
[ ] Separate installation login still works at `/settings/database-management`.
[ ] Global values and configured-secret status are visible; no secret is in HTML/responses.
[ ] Offline forms retain settings. Test a deliberate timezone edit and stale-form rejection
    only after recording a protected baseline; restore the intended value explicitly and
    establish a new baseline for subsequent comparisons.

```bash
dc stop app
dc run --rm maintenance snapshot configuration compare inventory-offline adopted-globals exact
dc start inventory
# Wait for healthy inventory.
dc up -d app
```

The offline comparison above assumes no intentional edits. Do not classify a legitimate
admin edit as data loss; preserve both before/after evidence and explain it.

## 4. SQL Server gate and exact switch sequence

STOP here until explicit approval identifies a separate disposable database and owner.
No script creates or connects to an Azure SQL database automatically. Never use
IT-Assets_DEV or a staging/production database as the test target.

Required approval record: exact endpoint/port, unique database name such as
`it_assets_acceptance_YYYYMMDD_RANDOM`, owner, expiration/cleanup owner, cost approval,
credentials supplied privately, TLS certificate policy, and permission to initialize
ONLY that database. A DBA must provision an empty database and a dedicated login/user
restricted to it with the documented schema-initialization rights. Confirm no user
objects, inventory or prior migration history. Use encrypt=true and valid certificate
verification; do not disable TLS merely to make acceptance pass.

Network approval is separate: provide a new egress-restricted network allowing ONLY the
approved SQL endpoint/port, blocking Graph/Entra/other outbound traffic, and unattached
to Astra/staging. `internal: true` alone cannot reach remote Azure SQL. An ordinary
unrestricted Docker bridge is not an acceptable substitute. SQL endpoint routing/DNS
and any Azure redirect-policy ports must be reviewed by the DBA/network owner.
Set ACCEPTANCE_APPROVED_SQL_NETWORK privately, then define:

```bash
dcs() { docker compose --env-file "$RUN/compose.env" -p it-assets-v060-upgrade-acceptance \
  -f docker/compose.acceptance.yml -f docker/compose.acceptance-sql.yml "$@"; }
dc stop app
dcs config --quiet
dcs up -d --force-recreate --no-deps app
```

1. Confirm adopted MariaDB is active; privately verify inventory and workspace accounts.
2. Sign in as Installation Administrator. Add ONLY the approved SQL connection and test it.
3. Inspect it. Require empty status. If nonempty/unknown/incompatible, STOP; do not reset.
4. Explicitly confirm initialization using its exact name, creating a new, uniquely named
   workspace administrator. This is a deliberate SQL bootstrap, not transferred Maria users.
5. Re-inspect for compatibility, activate, and wait for the exact revision's readiness.
6. Verify all installation values remain; separately authenticate to the new SQL workspace.
7. Check inventory/loans/assignments are empty, while expected bootstrap roles/defaults and
   the explicitly created SQL administrator exist. Role names alone are not proof of transfer.
8. Confirm Maria-only identities cannot sign in and their group mappings, scopes, policies,
   recipients, notification history, sessions and integration grants are absent. Do not
   import inventory or use export/import during this test.
9. Stop app; run `dcs run --rm maintenance snapshot configuration compare sql-globals adopted-globals globals`.
   This compares global values while deliberately permitting the selected profile to differ.
10. Start app, sign in as installation admin and reactivate adopted MariaDB without initialization.
11. Verify original inventory and authorization. SQL workspace sessions must not authorize MariaDB.
12. Stop app; compare configuration with `exact` and inventory with `workspace` against the
    pre-adoption baselines, using new evidence labels. Restart, then force-recreate app and
    repeat. Exact configuration includes selected profile, so MariaDB selection must persist.

A fresh SQL workspace may keep Entra and mail dispatch disabled until its own administrator
explicitly configures workspace policy. Provider credentials remaining configured does not
mean granting users access or enabling notifications. No inventory migration is automatic.

## 5. Security acceptance checklist

[ ] Workspace credentials/session alone cannot activate, initialize or edit global settings.
[ ] Installation credentials alone do not grant workspace inventory roles.
[ ] Two open admin forms: first save succeeds; stale second save does not overwrite it.
[ ] Logout and an expired installation visit reject all mutation actions; re-login restores
    the appropriate setup step without bypassing readiness or requiring reinitialization.
[ ] For controlled expiry, leave the isolated visit idle beyond one hour; do not edit its
    SQLite expiry or change the host clock. Workspace timeout test uses its configured policy.
[ ] Maria cookie cannot authorize SQL after switch; SQL cookie cannot authorize Maria after
    switching back. Fresh login is required for the active revision.
[ ] Unavailable workspace cannot authorize an Entra identity or create an inventory session.
[ ] Entra-start state from before a provider edit/switch is rejected on callback.
[ ] Valid mapped-port server actions return reachable RSC redirects. No `failed to get
    redirect response` or loopback ECONNREFUSED on public port 4053 occurs.
[ ] Missing/foreign Origin, including matching forged Host/X-Forwarded-Host, rejects mutation.
    Use the existing isolated `test-action-redirect.mjs` regression locally (4052→4050),
    plus browser/devtools replay against 4053 in this disposable project. Capture no tokens
    or cookies in shared evidence. UI success alone is not a CSRF test.
[ ] Live Entra login is NOT covered by blocked-network automated checks. It requires separate
    approval of a test identity, app registration and localhost:4053 callback, a narrowly
    approved identity-network policy, and explicit identity provisioning in each workspace.
    A Maria-only identity must be denied in SQL. Record that live test separately.

## 6. Email and worker gates

[ ] No test-email button, loan-creation/return mutation or worker command runs automatically.
[ ] Graph configuration and sender remain identical across snapshots, restart and switches.
[ ] New SQL notification policies/recipients remain local and dispatch defaults off.
[ ] Managed worker is absent and stays disabled. See `docs/managed-reminder-worker-plan.md`:
    required work includes supervisor pinning/drain, leases/fencing, durable outbox, ambiguous
    delivery handling, retry/dual-worker/provider tests, pagination and timezone versioning.

A live Graph send needs explicit administrator approval of the test app/mailbox, a SINGLE
controlled recipient, message content, delivery window and outbound network policy. Prefer
a separate run with test credentials, record the credential change intentionally, and use
only the authenticated test-email action once. Verify Sent Items and the active workspace's
history privately. Do not use production recipients or enable scheduled reminders. Restore
baseline configuration through an approved review or protected backup, then recheck it.
This kit does not perform or claim that live test.

## 7. Rollback using separate disposable copies

Before any intentional administrator edit, preserve a stopped control-store backup with
its original key using a protected operator backup procedure. Keep SQLite WAL files when
present; do not copy a live SQLite file alone. Never open an upgraded control store with
an older binary. For legacy rollback use the original matching DB, app data, branding,
settings key, Entra alias/credential and legacy image, not the managed control directory.

```bash
dc stop app legacy-check
# If the SQL overlay is in use, stop that app via dcs as well; same project/service.
dc --profile rollback up -d rollback-db
# Wait for healthy status.
python3 scripts/acceptance/restore.py --run "$RUN" --service rollback-db \
  --confirm it-assets-v060-upgrade-acceptance:rollback-db:it_assets --expected-tables 23
dc run --rm maintenance snapshot rollback-db compare rollback-restored restore-baseline exact
dc --profile rollback up -d rollback
```

[ ] Exact original legacy image logs in and renders representative inventory and branding.
[ ] Original configured mail/Entra credentials remain available with original keys; no send/login
    to external services is attempted without the separate approvals above.
[ ] No schema migration, fake migration baseline, database reset or inventory rewrite required.
[ ] Stop rollback before restarting managed app; they share only the host port, not data volumes.
[ ] To test rejected activation: save an unreachable disposable profile, run test/inspection,
    confirm activation cannot succeed and previous selection/readiness is preserved/recoverable.
[ ] To test failure after approved SQL activation: have the network owner temporarily deny only
    the test SQL route, verify offline installation management, reactivate MariaDB, and restore
    the approved route. Do not stop shared SQL servers or change production firewall rules.
[ ] Repeat Maria fingerprints after recovery; failed operations must not initialize/reset it.

Do not run `down -v` as routine recovery. Failed partial restore/activation is evidence;
retain it and request a fresh isolated run. Cleanup is a separate approved action scoped
to this project's exact volume names after backup/evidence retention is settled.

## Evidence and production blockers

Maintain a private pass/fail/blocked checklist with timestamp, source commit/image IDs,
operator and evidence label for each step. HMAC evidence files contain per-table counts
and opaque digests, never rows; keep the HMAC key separately protected with run inputs.
Do not paste logs, inspect JSON, browser storage or screenshots with private records.

Production remains blocked until real Docker restore/legacy use/adoption/recreation,
approved SQL switching, offline recovery and matching-image rollback pass. Live Entra
and controlled Graph delivery require their own approvals/results. Container UID/bind
permissions, archived layout, actual image startup compatibility, checksum provenance,
real schema compatibility and SQL egress policy must be verified by the operator.
Managed reminder production enablement remains a separate unimplemented feature gate.

## Local validation

The kit's six offline Python tests exercise checksum tampering, archive traversal/links,
immutable source preservation, safe URL retargeting, existing-destination refusal, and
restore refusal for wrong project, running writers and nonempty databases. Docker calls
are mocked in these tests. JavaScript syntax and Compose YAML are checked locally.
Existing application tests/typecheck/lint results are recorded in the final handoff.
No Docker daemon, Ubuntu backup, Astra/staging environment or SQL database was accessed.

Validated locally on 2026-11-17: 75 application tests and six offline acceptance-tool
unit tests passed; typecheck, lint, JavaScript syntax and Compose YAML/isolation assertions
passed. The Python fixture tests required scoped filesystem access after Windows denied
temporary-directory access. Docker Compose schema evaluation, image build/start, real
backup restoration, SQL switching and rollback execution were NOT performed. Application
runtime code is unchanged; the managed build/HTTP success at `8f0a255` is prior validation,
not a new Docker acceptance result.
