# Phase 5C.2 — appearance and session policy runtime increment

This is an independently testable runtime increment, not completion of Phase 5C.
For the subsequent managed-profile capture/reconciliation path, see
[Phase 5C.3](managed-configuration-reconciliation.md); the limitations below describe
this increment's original baseline unless superseded there.
It builds on `abe8f3d` and the [configuration ownership audit](installation-configuration.md).
No production or existing staging configuration was inspected or changed.

## Runtime scope

After explicit enablement, these values have one authoritative source in the existing
encrypted control-store configuration:

- `app.title`, with the local organization title synchronized in the same transaction.
- `session.timeoutMinutes`, consumed by the existing workspace session service.
- The four `branding.logo.*` / `branding.icon.*` references and their image bytes.

`getGeneralSettings` reads only workspace keys from the inventory database and overlays
these control-owned values. `getSessionTimeoutMinutes`, `getBrandingSettings` and
`getAppShellBrandingSettings` read enabled configuration without touching inventory.
The offline ControlShell uses the same appearance. Organization edits in the existing
authenticated setup flow update the authoritative title and its version atomically.
The organization record's title is a synchronized compatibility mirror, not an
independently editable title source after enablement. Site name remains control-owned.

Before enablement, existing readers/writers continue their previous behavior. There
is no automatic import at startup or when selecting another database. After enablement,
missing/corrupt configuration fails closed rather than falling back to a new workspace's
defaults. There is no runtime switch back to workspace-owned presentation settings.

## Explicit transition

For an existing legacy MariaDB installation, rehearse using a disposable restored copy:

1. Stop writers to the source settings and the managed process using the target control
   store. Keep original key files, uploads and database backup for rollback.
2. Run the existing offline `stage-configuration EXACT_DATABASE_NAME` command with the
   explicit URL file, original encryption key, Entra reference inputs and branding
   extraction described in the upgrade runbook. Re-running identical input is safe.
3. Start managed mode. Separately authenticate as Installation Administrator in
   Settings → Database Management. Expand “Installation appearance and session policy”.
4. Review the staged title, session timeout and file count. Type `ENABLE` and confirm.
   The action verifies the displayed snapshot fingerprint, installation session and
   exact public request origin. Invalid values or organization-title conflicts fail.
5. Verify the appearance and session settings, then test database activation normally.
   No database is initialized, activated or migrated by enabling presentation.

A fresh installation with no saved profiles or legacy adoption can explicitly enable
defaults from its organization record. The configuration schema accepts an
`installation` source tag for this case; existing version-1 MariaDB snapshots remain
readable. Existing profiles without a staged snapshot cannot silently enable defaults.

This transition does **not** reconcile later managed profile-specific edits with an
older legacy snapshot. In particular, source `/api/workspace-branding/...` references
still require a separate reviewed migration path. Stop and resolve such cases; do
not delete a control store or replace configured branding with defaults to proceed.
The source must remain quiescent between staging and enablement. No background process
keeps the staged snapshot synchronized with subsequent legacy edits.

## Editing and authorization

The existing Settings pages and navigation remain in place. General Settings shows
shared title/session fields read-only after enablement, while asset numbering,
make/model rules and statuses remain editable under workspace permissions. Branding
shows existing values with editing disabled and a link to separate installation login.
Forged calls to the old workspace actions cannot change global values or write files.

Installation administrators edit title, timeout and replacement logos/icons in the
existing Database Management workspace, using its shared fields, cards, shell and
action error handling. No workspace login is needed for these controls. A workspace
administrator role alone grants no access. Every write rechecks the control session,
request origin, enabled state and optimistic configuration version. Another session
observes updates on its next server read; stale saves require reload, not last-writer-wins.
The save form remounts after a successful version change to clear completed uploads.

The database connection/status/inspection/activation controls remain available in the
same offline area. Inventory operations remain gated. No workspace users, password
hashes, roles, identity mappings or bearer grants are copied. Workspace sessions and
their cookie realm/revision fences remain in their selected database; the shared timeout
changes expiry policy only, not session identity or authorization.

## Branding persistence

Imported image bytes stay in the encrypted configuration record. New uploads replace
references and bytes in the same SQLite transaction as settings, organization mirror,
version and audit. No separate filesystem publication step can leave broken references.
Only files referenced by the four branding settings remain in the runtime record.
Original legacy files and Setting rows are not deleted or rewritten.

The application translates preserved `/branding/uploads/<filename>` references into
`/api/installation-branding/<filename>` when rendering. This route works without an
active database and exposes only currently published, allowlisted PNG/ICO filenames.
Branding is deliberately public for sign-in pages; arbitrary control files, staged-only
files and obsolete image names are not public. Responses use the correct image type,
`nosniff` and `no-store`. The existing branding redirect route also bypasses inventory
bootstrap only when shared presentation is enabled.

Uploads require an installation session, valid PNG/ICO MIME and signature, at most
2 MB per image, and generated filenames. Client paths are never used. Next's action
body limit is 10 MB to accommodate four 2 MB files plus multipart overhead; origin
validation remains unchanged. No wildcard allowed-origins setting was added.

## Persistence, conflicts and rollback

The existing control volume and original control.key persist configuration across
process/container recreation. No new volume or database schema migration is required.
`presentationRuntime` stores a version and the original import fingerprint. Identical
legacy re-import is a no-op even after administrator edits; different imports fail
without overwriting those edits. Settings, file replacements, organization mirror and
audit commit together; a tested transaction failure rolls all of them back.

Back up the complete stopped control directory and its key. Restore matching files;
do not copy only the main SQLite file from an active WAL writer. An older application
can still use the unchanged legacy database and original branding after rollback.
Presentation changes made in managed mode are intentionally not back-written to that
legacy database. Keep the managed backup to recover those changes after rollback.
Downgrading to an older build will resume its old workspace-owned runtime behavior.

## Validation and remaining work

Automated tests cover explicit cutover, fresh/default versus existing-profile gates,
installation-token checks, optimistic writes, cross-handle visibility, restart,
control selection MariaDB → SQL Server → MariaDB, original import retry after edits,
credential preservation, organization synchronization, transactional failure rollback,
image validation/path restrictions and actual branding/session service reads with no
active inventory. Profile-local authentication mapping isolation is tested separately
from shared appearance. These are control-store tests, not live database acceptance.

The HTTP regression uses a new temporary control store on 127.0.0.2:4050 with public
Host/Origin localhost:4052. It covers login, explicit enablement, actual upload/save,
offline management rendering, public image bytes, stale saves, profile saves, forged
origins, logout and unauthorized post-logout updates. No existing SSH tunnel is stopped.

Still outstanding:

- Global Entra tenant/client/reference/redirect runtime integration and an offline
  editor, while retaining workspace login policy and group-to-role authorization.
- Global Exchange/Graph transport and credential editing, independent of workspace
  notification recipients, enablement and reminder policies. No SMTP service exists.
- Installation timezone runtime/editor integration. The staged timezone remains unused
  by runtime; deployment APP_TIME_ZONE remains the source.
- Migration/reconciliation of already edited managed profile configuration and branding.
- Full reuse of the rich Branding Settings editor inside offline administration, image
  preview/reset controls there, and browser visual/accessibility acceptance.
- Real disposable MariaDB/SQL Server login, inventory preservation, switching, old-image
  rollback and Docker recreation. No claim is made that a real MariaDB workspace user
  was tested against a live SQL Server workspace in this increment.
- Real Entra/email acceptance and managed reminder worker lifecycle remain separate gates.

The existing integration registry has no global service transport setting to move;
its credentials, grants, scope and activity correctly remain workspace-specific.

Validation results (2026-11-16): 57 automated tests passed, including 8 new runtime
regressions. Typecheck, lint and managed build passed. The final isolated HTTP suite
passed, including the database-independent branding redirect alias. The first build
attempt hit a sandbox EPERM while creating generated output; the approved retry
passed. Existing Browserslist age and Node loader deprecation warnings remain.
Temporary test servers exited normally; no existing database or persistent volume
was contacted, and nothing was pushed or deployed.
