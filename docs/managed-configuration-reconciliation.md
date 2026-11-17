# Phase 5C.3 — managed-profile reconciliation increment

Status (2026-11-17): **Priority 1 increment; full configuration runtime acceptance
remains incomplete.** This builds on `abe8f3d` and `9cfe6bd`. It adds capture, explicit
review, conflict rejection and protected rollback for existing managed-profile edits.
It does not make Entra/mail/timezone runtime installation-wide.

## Ownership and precedence

| Input / operation | Deterministic rule |
| --- | --- |
| Current installation configuration | Remains untouched by capture. If presentation was enabled, it remains authoritative for title, session timeout and branding. |
| Inventory Setting records | Read-only source for the existing explicit installation allowlist. Workspace roles, grants, token hashes, users, notification recipients/policies and asset rules are excluded. |
| Managed profile auth_config | Overrides legacy Setting values for tenant ID, client ID, secret reference and redirect URI when present. Local-login policy, SSO enablement and group mappings are not copied. Invalid auth_config fails capture. |
| Managed branding | Read referenced files from the selected profile's persistent branding directory; convert `/api/workspace-branding/<name>` references into the existing snapshot format. No files are written or moved. |
| Mail secret | Preserve exact ciphertext only after successful decryption with the source's original settings key. No re-encryption of legacy records or display of ciphertext/plaintext. |
| Entra secret | Require an available managed environment reference, never import a literal. Legacy literals must first use the verified legacy adoption path. Secret values are never put in reviews. |
| Timezone | Capture the existing calendar helper's effective APP_TIME_ZONE → TZ → UTC behavior using the explicitly supplied deployment environment. Invalid zones retain that helper's UTC fallback. Runtime scheduling remains unchanged. |
| Keep current installation | Closes the review without changing configuration. Safe even if the captured baseline is stale. |
| Use captured profile | Requires separate installation authentication and `APPLY SNAPSHOT`. Replaces the shared snapshot and synchronizes organization title atomically. Does not activate a database or enable runtime configuration. |
| Already-enabled presentation | Approved replacement becomes visible on the next read; optimistic version changes invalidate earlier edit forms. |
| Other global categories | Approved values remain staged. Existing Entra/mail/timezone runtime readers remain unchanged in this increment. |

This compares the captured profile against the staged/shared installation record and
organization at capture time. Earlier increments reused one encrypted record when
staging became active and retained only the original import fingerprint. They did
not retain a separate immutable copy of every historical staged value. This feature
cannot reconstruct historical values that predate its capture; retain the original
database/control backups. Every new review preserves its exact before-state encrypted.

## Capture in an isolated rehearsal

Do not run these commands against production, existing Astra/IT-Assets_DEV or the
Ubuntu staging store. Use a new disposable control store with a deliberately created
disposable database profile. Copying a control store alone does **not** make its saved
connection targets safe; verify the saved target points only to the disposable server.

Stop the managed supervisor and every source configuration writer. Supply an absolute
IT_ASSETS_CONTROL_DIR and the same explicitly configured secret files/environment as
the managed source deployment. No .env discovery, ambient DATABASE_URL adoption or
database scan is performed. The command holds the same owner.sqlite exclusive lock.

```sh
node --import tsx scripts/capture-managed-configuration.mjs capture PROFILE_ID EXACT_DATABASE_NAME
```

The explicit profile ID and database-name confirmation select one saved connection.
Source inspection must report compatible; then Setting records and profile auth_config
are read, and referenced branding bytes are validated. The original mail key is selected
with the managed launcher's precedence: managed key override, explicit original key
file, otherwise the existing control-key-derived settings key. A wrong key fails.
The source's effective timezone environment must also match the managed deployment.

Only a new encrypted review is saved. No initialization, migration, activation,
mail send or inventory modification occurs. A retry of the same profile version and
captured content returns the existing review, including a previously resolved review.
Changed profile/content creates a new review. Referenced image names are deduplicated
within each snapshot; retries do not create new files or duplicate review rows.

After an intervening installation edit, a pending old review cannot replace it. To
deliberately capture a new baseline, stop writers again and run:

```sh
node --import tsx scripts/capture-managed-configuration.mjs refresh PROFILE_ID EXACT_DATABASE_NAME
```

Refresh is explicit; it does not approve the result. Identical content and baseline
still produce the same review. Old reviews remain available for audit. Keep current
installation can dismiss stale pending reviews without applying anything.

## Review and source quiescence

Start the app and separately sign in as Installation Administrator in Database
Management. The review panel shows capture time, source profile, changed keys and
before/captured values. Mail ciphertext, key fingerprints and Entra references are
hidden; only configured/not-configured status is shown. Unchanged values are omitted.

The administrator explicitly chooses to keep the current installation or apply the
captured snapshot. There is no automatic precedence by timestamp or provider, no
automatic activation, and no automatic last-writer-wins merge. An installation edit,
organization edit, runtime-version change or connection-profile edit invalidates an
apply operation. Raw settings and secret-bearing review objects never become client props.

The review is a **captured snapshot**, not a live replication feed. Keep external
source settings writers stopped until resolution. Starting managed mode for review
does not freeze other workspace administrators or direct SQL writers. If the source
was edited after capture, recapture it explicitly before applying. Source database
records are never overwritten by apply, but choosing an old snapshot would deliberately
make its captured presentation authoritative; the UI names this distinction. Automatic
external-source drift detection and an enforced workspace edit freeze remain a limitation.

## Atomicity, encryption and rollback

An additive `configuration_review` table stores encrypted, authenticated envelopes
under the existing control.key, with the review ID bound as authenticated data. Each
record contains candidate, exact previous configuration/organization/runtime metadata,
baseline fingerprint, capture time and resolution state. Secret-bearing values are
not plaintext SQLite columns or audit messages. Missing keys are not regenerated even
if only review history remains. Preserve the complete stopped control directory and key.

Apply commits configuration, organization title, optimistic version, review state
and audit together. A failure before commit leaves the previous state and pending
review intact. Retrying an already-completed matching decision is a no-op; an opposite
decision is rejected. Neither source database nor source branding files is modified.

`RESTORE` in the same authenticated panel restores the before-state only if current
installation configuration still matches the recorded apply result. Any later edit
blocks restore. Restoration rotates form versions to prevent stale form replay, retains
the encrypted history, and is itself idempotent. Before-state may be an absent snapshot;
restoring it does not invent defaults or enable presentation. Historical snapshots
necessarily retain prior bytes for rollback, but no duplicate filesystem uploads are
created. There is no automatic history pruning or secret export endpoint.

The original legacy app can still use its unchanged database, settings and branding.
Changes approved into managed control storage are not back-written to the source.
An older app image will use its old runtime ownership rules; retain both legacy and
managed backups rather than deleting history as a downgrade strategy.

## Entra, mail and reminder audit

The existing Entra callback still resolves an active, login-enabled user in the
selected workspace and uses that workspace's group-to-role configuration. Capture
does not copy or grant users, mappings, roles or sessions. Runtime IdP transport remains
profile-local; full installation-wide transport editing/activation is still required.
No live Entra or cross-provider user login test was performed in this increment.

Mail is Microsoft Graph/Exchange application transport (`graph-mail.ts`), not SMTP.
Runtime transport remains selected-workspace Setting data. Recipient selection,
borrow/return notifications, reminder enablement/intervals and execution history must
stay workspace-bound when transport moves to control storage.

`borrowed-reminders-worker.ts` explicitly rejects IT_ASSETS_MANAGED=1 before running
cycles. The managed supervisor also sets BORROWED_REMINDER_DRY_RUN=true. The reminder
service's dryRun default is false, so that environment variable is **not** a universal
mail kill switch; the standalone worker passes its parsed flag explicitly. The current
entry point is the standalone worker. A future managed worker needs selection/revision
pinning, drain/restart, claim lifecycle and checks before delivery; simply removing
the rejection is unsafe. Inline borrow/return notifications are separate from this
worker and retain existing behavior. No test in this increment invokes Graph or sends mail.

## Remaining before full Phase 5C / Docker acceptance

- Installation-wide Entra transport readers/writers and offline management, retaining
  separate workspace login policies and role mappings.
- Installation-wide Exchange transport readers/writers, encrypted key lifecycle and
  offline management, retaining workspace dispatch policy and recipients.
- Authoritative timezone runtime/editor integration and scheduling/DST acceptance.
  Capturing effective timezone does not change runtime authority.
- Optional per-field/category conflict merging and enforced live-source edit fencing;
  current resolution is whole-snapshot and requires source quiescence.
- Real disposable MariaDB adoption/capture, independent SQL Server activation,
  original inventory/user/permission comparisons, image rollback and Docker recreation.
  Control-store and synthetic Setting fixtures are not these acceptance tests.
- Browser visual/accessibility acceptance of the new review panel.

This increment closes the safe explicit review/rollback path; it does not complete
Priorities 2–4 or the full cross-provider acceptance goal.

## Validation results

65 automated tests passed, including 8 reconciliation/capture tests. Typecheck, lint
and managed build passed. Isolated HTTP regression passed explicit review application
and restoration, offline management, presentation upload/branding, stale saves, login,
logout, forged-origin rejection and public 4052/internal 4050 server-action redirects.
All test stores/files were newly created temporary fixtures. Tests simulated a failing
SQLite transaction and reopened the store before retry; they did not simulate physical
power loss. Captured Setting maps and SQL Server profile metadata were synthetic.
The offline capture command has not been exercised against a live disposable MariaDB
or SQL Server in this increment. Docker, real Entra and mail delivery were not run.
No existing database, staging control store, Astra instance or persistent volume was
accessed. Temporary HTTP servers exited normally. Existing Node loader deprecation
and Browserslist age warnings remain; no dependency upgrades were made.
