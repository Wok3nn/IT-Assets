# Phase 5C — ownership audit and staging foundation

Status: **partial implementation; acceptance goal not yet met** (2026-11-16).
Current follow-up: [managed-profile reconciliation](managed-configuration-reconciliation.md)
adds explicit capture/review/rollback; Entra/mail/timezone runtime integration is still pending.
Phase 5C.2 now supports explicit runtime enablement for title, session timeout and
branding; see [the current runtime increment](installation-presentation-runtime.md).
The staging implementation/history below describes the original `abe8f3d` increment.
Baseline: `3c39271`. This increment introduces an encrypted, atomic legacy
configuration snapshot in the persistent control store. It deliberately does not
make that snapshot the application's runtime settings source. Switching to SQL
Server can still show defaults until the remaining runtime/UI work below lands.
Do not deploy this as a completed configuration-preservation release.

## Ownership audit

This inventory covers all Setting keys read/written by the current services, plus
dynamic key families. Unknown keys are never imported. A deployed database may
contain historical/custom keys: review them separately without publishing values.
“Installation” below is the intended ownership, not a claim that runtime routing
has already changed. No Setting rows, credentials or migrations are rewritten.

| Category / exact keys | Current storage | Intended ownership and treatment |
| --- | --- | --- |
| `app.title` | Workspace Setting; setup also keeps a local appTitle | Installation. Snapshot imports legacy value; conflicts with an existing local organization title fail. Runtime and setup title reconciliation remains. |
| Organization `siteName`, `appTitle` | SQLite setup_record; bootstrap copies title into Setting | Installation. Already persistent; do not infer siteName from a workspace title or overwrite enrollment data. |
| `session.timeoutMinutes` | Workspace Setting | Installation policy; actual sessions, credentials, renewal and authorization remain workspace-bound. Snapshot includes the policy only. |
| `branding.logo.light`, `branding.logo.dark`, `branding.icon.light`, `branding.icon.dark` | Workspace Setting; legacy public uploads or managed profile workspace files | Installation. Snapshot holds original references and referenced binary bytes together. Stable installation upload/serve routes and runtime reads remain to implement. |
| `assets.startingTagNumber` | Workspace Setting | Workspace numbering policy; copying it could cause collisions. Excluded. |
| `assets.makeModel.autoEnabled`, `assets.makeModel.makeSourceLevel`, `assets.makeModel.modelSourceLevel` | Workspace Setting | Workspace category-dependent interpretation. Excluded. |
| `authentication.entra.tenantId`, `.clientId`, `.redirectUri`, `.secretReference` | Legacy Setting; managed auth_config keyed by profile | Installation identity-provider configuration. Snapshot converts a verified legacy secret to the existing managed environment reference; never stores a literal Entra secret. |
| `authentication.local.enabled`, `authentication.entra.enabled`, `authentication.entra.ssoEnabled` | Setting / profile auth_config | Workspace login policy. A shared IdP must not silently enable SSO or disable local recovery in a new workspace. Excluded. |
| `authentication.entra.groupMappings` | Setting / profile auth_config | Workspace role grants. Role names/keys can coincide across databases; never transfer automatically. Excluded. |
| `mail.tenantId`, `mail.clientId`, `mail.clientSecretEncrypted`, `mail.senderMailbox` | Workspace Setting | Installation Exchange/Graph transport. Original ciphertext is verified with the original key, then preserved inside the control-key-encrypted snapshot. No SMTP implementation was found. |
| `mail.enabled` | Workspace Setting | Workspace dispatch permission. A new workspace must explicitly enable sending. Excluded. |
| `mail.adminRecipient`, `mail.notifyBorrowerOnBorrow`, `mail.notifyBorrowerOnReturn`, `mail.notifyAdminOnBorrow`, `mail.notifyAdminOnReturn` | Workspace Setting | Workspace recipients/event policy. Excluded; borrower recipients still derive from workspace records. |
| `mail.dueReminderEnabled`, `mail.overdueRemindersEnabled`, `mail.overdueReminderIntervalDays` | Workspace Setting | Workspace reminder policy, with loan/reminder execution state in inventory tables. Excluded. Managed worker supervision is still a separate blocker. |
| `permissions.role.<roleKey>` | Workspace Setting | Workspace capabilities and scopes. Excluded. |
| `integrations.<id>.enabled`, `.tokenHash`, `.expiresAt`, `.scope`, `.lastSuccessAt`, `.grant.local.<userId>`, `.grant.entra.<tenantId>.<objectId>` | Workspace Setting; business audit in AuditLog | Workspace authorization, credentials and activity; all excluded. Current DeskMap service has no independent global endpoint/transport setting to import. Registry metadata is code. Future transport settings need an explicit ownership review. |
| `APP_TIME_ZONE` | Deployment environment | Installation preference; snapshot captures only an explicitly supplied override. Runtime still uses deployment configuration. |
| Theme preference | Browser preference | User/browser, not an installation or inventory Setting import. |
| Database profiles, inspection, activation revision | SQLite control store | Profile-specific connection and lifecycle state; already durable, encrypted credentials. Not copied into global configuration. |
| Installation administrator, control sessions and management audit | SQLite control store | Installation security domain. No workspace permissions are gained by staging configuration. |
| Workspace users/passwords, roles/scopes, sessions, identity mappings, integration bearer grants | Selected inventory database | Workspace security domain. Never imported by this increment. |
| Assets, assignments, loans, categories, locations, statuses, label templates, histories/audit and legacy AuthProviderConfig/BrandingAsset tables | Selected inventory database | Workspace records. Preserve whole database for rollback, even tables not used by current settings readers. |

## Confirmed gaps

General and mail services query `db.setting`; the selected database therefore
determines the settings. Managed authentication is profile-local and falls back to
workspace Setting rows when no local config exists. Branding writes and serves from
`APP_DATA_DIR/branding`, and the supervisor changes APP_DATA_DIR with the profile.
The old adoption path preserves the same MariaDB data rather than separating globals.
Bootstrap copies local title into a new database but does not preserve all settings.
Existing Settings authorization/layouts depend on workspace users and a live database;
the offline installation login currently manages organization and databases only.

These coupled readers, writers, file routes and permission checks need one coherent
cutover. Merely copying rows or redirecting all Setting reads to SQLite would either
lose later edits or transfer workspace privileges. This increment supplies a tested
staging boundary without changing any authentication or sending behavior.

## Implemented staging operation

The offline command adds an explicit operation (not part of ordinary startup or
automatic adoption):

```sh
node --import tsx scripts/adopt-legacy.mjs stage-configuration EXACT_DATABASE_NAME
```

Use only an isolated restored fixture for now. Follow the existing
[upgrade runbook](docker-upgrade.md) for the absolute `IT_ASSETS_CONTROL_DIR`, explicit
`IT_ASSETS_ADOPT_DATABASE_URL_FILE`, original settings-key secret file, optional Entra
secret/reference and extracted `IT_ASSETS_LEGACY_BRANDING_DIR`. Supply the original
APP_TIME_ZONE override if present. Stop the managed process using that control store;
the command takes the same owner.sqlite exclusive lock. It never reads ambient
DATABASE_URL as an import source, activates, initializes or migrates a workspace.

Compatibility/schema, mail decryption, Entra reference resolution and branding are
checked by existing adoption preflight. Only the fixed installation allowlist is
selected; secrets and validation inputs are not logged. Unknown keys remain solely
in the legacy database. The record includes a source identity but no connection
credentials, workspace roles, tokens or account mappings.

One `installation_config` row in control.sqlite stores an AES-256-GCM envelope under
the existing control.key, authenticated for this record/version. It holds settings,
source, optional timezone, original settings-key fingerprint and referenced branding
bytes. Files and settings commit together with the staging audit event in one SQLite
transaction, so staging cannot publish broken file references. Missing control.key
is not regenerated when a snapshot exists, even with no connection profiles.

Identical retries are no-ops (canonical key/file ordering). A different source,
settings value, file, timezone or key fingerprint fails without replacement. There
is no force/merge option: explicit conflict resolution is a future operation, not an
instruction to delete the control store. An existing organization title mismatch
also fails. No runtime consumers read this snapshot yet; it does not override later
managed administrator edits. Before runtime cutover, reconcile those edits against
the legacy snapshot explicitly. Do not assume the snapshot stays current after import.

## Compatibility and rollback

The existing `check` and `adopt` commands retain their behavior. Staging neither
requires nor creates a connection profile and does not alter enrollment or selection.
The table is additive. Existing application runtime continues to use the legacy
sources, so stopping this candidate and restarting the previous version leaves those
values intact. No downgrade migration or credential rewrite is required. Back up
the complete stopped control directory with its key, not just SQLite's main file
while WAL writes are active. Preserve original database, uploads and original
deployment secrets independently, as required by the existing rollback runbook.

Mail remains encrypted by the original settings key inside the new envelope. Losing
that original key still loses the ability to use mail configuration later; staging
is not a key-rotation or key-recovery procedure. Entra references still require their
deployment secret files on container recreation. Control persistence does not turn
deployment secrets into image contents.

## Export/import audit

The UI supports CSV/XLSX datasets and label-template JSON; it is not a full backup or
cross-provider migration utility. Evidence: `modules/settings/import-export.service.ts`.

| Data | Existing support / limits |
| --- | --- |
| Assets | Scalar fields, make/model text, category/location paths, status names, department labels and assigned-user email/name. Original IDs and all relationships are not preserved. |
| Categories, locations, departments/scopes | Separate import/export; hierarchy paths and missing-reference resolution exist. No all-dataset transaction or automatic dependency orchestration. |
| Manufacturers/models | Asset make/model scalar text, not a standalone relational catalog migration. |
| Users | Name/email, one exported role, departments and flags. No password hashes, full multi-role fidelity, sessions or identity-link migration. Import uses user-creation logic. |
| Assignments | Resolved against destination users; missing matches can leave assets unassigned with warnings. Import users and reference data before assets. |
| Loans, returns, history, business audits, attachments | No complete export/import endpoints in this UI. Not preserved by asset CSV/XLSX. |
| Labels | Dedicated JSON template path; not a full asset/template relationship backup. |
| Duplicates/order | Per-file detection and destination matching/skip/report logic, with entity-specific resolution. No lossless multi-dataset merge or transaction. |
| MariaDB to SQL Server | Prisma-backed paths can target the active provider, but end-to-end fidelity/parity is unvalidated. Do not advertise complete migration support. |

Track inventory migration separately. This phase performs no automatic inventory copy.

## Remaining increments and acceptance gate

1. Versioned runtime global-settings repository with explicit initial import/cutover
   state, optimistic writes and conflict resolution for existing managed edits.
2. Split General, Authentication and Exchange service reads/writes by ownership;
   share IdP transport while preserving workspace login policy and role mappings.
3. Stable installation branding routes/uploads and publication of verified snapshot
   files, with cache invalidation and offline shell support.
4. Reuse existing Settings forms with clear scope labels and an offline installation
   administrator guard. Workspace accounts must not implicitly gain global management
   access just because a new database grants them a workspace role.
5. Regression coverage for those runtime actions, session renewal, offline access,
   active mail/Entra configuration, and rollback after administrator edits.
6. Execute the requested full disposable MariaDB adoption → empty SQL initialization
   with its own admin → activation → return to MariaDB → container recreation sequence.
   Compare original records/permissions, verify empty SQL inventory, and prove no token
   or role leakage. This sequence has **not** been executed by this increment.

Control-store selection tests are not live database or container-switch tests.

## Validation for this increment

- 49 automated tests passed (8 new configuration regressions).
- Typecheck and lint passed; managed build generates both provider clients offline.
- New tests use temporary SQLite control stores only: selection/restart/removal,
  identical retry, organization/config conflicts, rejected workspace keys, GCM
  tampering/wrong-key detection, missing-key recovery, injected transaction rollback,
  original mail-key verification and atomic branding/reference preservation.
- Existing enrollment, control-session, integration security, adoption, SQL Server
  checksum and redirect-origin tests remain green.
- No live MariaDB/SQL Server, Docker, staging control store, production volume or
  external email/identity service was accessed. Profile selection tests do not run
  database initialization or connect to their unreachable fixture endpoints.
- Full power-loss recovery, old-image/container rollback, runtime settings switching,
  offline global Settings UI and the exact cross-provider acceptance sequence remain
  untested/unimplemented as described above.
- Final managed build passed after retrying a sandbox-denied generated-output mkdir.
  No dependency upgrades were made. The isolated HTTP action regression also passed
  login, repeated profile saves, direct/proxy public port 4052 → internal 4050 redirects,
  forged-origin rejection and logout; its temporary server exited normally.
