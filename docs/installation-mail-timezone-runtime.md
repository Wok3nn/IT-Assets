# Phase 5C.5 — persistent email transport and application timezone

Implemented locally, 2026-11-17, following `b518324`. No deployment, live inventory
access or email sending was performed. Managed reminder execution remains disabled.

## Ownership audit

| Configuration / behavior | Owner and runtime |
| --- | --- |
| SMTP host, port, TLS, username/password | Not implemented. This release does not add SMTP or imply SMTP compatibility. |
| Microsoft 365 / Exchange | Existing Graph HTTPS client-credentials transport, fixed Graph token scope and sendMail API. No configurable protocol/port/TLS downgrade. |
| `mail.tenantId`, `mail.clientId`, `mail.senderMailbox` | Installation after explicit enablement; otherwise original workspace Setting behavior. Sender is the Graph mailbox identity; no separate display-name or reply-to setting exists. |
| `mail.clientSecretEncrypted` | Original workspace AES-256-GCM ciphertext retained unchanged for rollback. Verified capture additionally preserves its value only inside the control-key-encrypted installation/review envelope. |
| Internal `mail.clientSecret` | Secret-bearing server-only snapshot field, never selected from arbitrary workspace Setting input. Encrypted at rest by control.key; never returned in public settings/HTML. |
| `mail.enabled` | Workspace dispatch permission, default false. Enabling installation transport does not enable notifications in a new workspace. Explicit test email retains its existing authenticated Settings action. |
| `mail.adminRecipient` | Workspace administrative recipient. Borrower addresses derive from workspace users/loans. Never captured. |
| `mail.notifyBorrowerOnBorrow`, `mail.notifyBorrowerOnReturn`, `mail.notifyAdminOnBorrow`, `mail.notifyAdminOnReturn` | Workspace event policies, never captured. |
| `mail.dueReminderEnabled`, `mail.overdueRemindersEnabled`, `mail.overdueReminderIntervalDays` | Workspace reminder policies, never captured. |
| Notification/reminder history and dedupe rows | Workspace inventory tables; no transfer, reset or migration. |
| Email templates / branding | Existing messages are code-generated text with escaped HTML conversion. No editable email template, email logo or independent email-branding configuration exists. Application appearance retains its existing installation authority. |
| Application timezone | Explicitly enabled installation setting. Before enablement: APP_TIME_ZONE, then TZ, then UTC; invalid deployment values fall back to UTC as before. |
| Other global preferences | Existing title/session/branding/Entra paths remain unchanged. No new generic preference import or notification subscription store is introduced. |

## Storage, activation and administration

The encrypted installation snapshot remains the sole runtime authority for an enabled
category. Separate `mailRuntime` and `timezoneRuntime` markers hold optimistic versions.
Settings writes, credential replacement/clearing, marker changes and audit are atomic.
Mail transport and timezone can be enabled separately; incomplete/empty mail settings
remain manageable and simply produce no usable transport until completed.

Existing installations use the established offline legacy staging or saved-profile
capture and explicit conflict review. Keep source configuration writers stopped until
resolution. New captures verify the original mail key, preserve original ciphertext
and freeze the credential inside the encrypted envelope. The installation credential
then survives restart or a changed deployment settings key. Older ciphertext-only
snapshots require the matching original key at enablement/approval; decryption failure
changes nothing. No legacy inventory row is overwritten.

In Database Management, sign in separately as installation administrator and type
ENABLE for each category. These forms are available with inventory disconnected or
offline. Blank replacement secret preserves the current credential. Type CLEAR to
remove it; a removed credential is not resurrected from retained legacy ciphertext.
Clear and replacement cannot be submitted together. Secret/key contents are never shown.
No save or enable action sends an email or starts a worker.

Existing Exchange Settings keeps workspace policies, recipients and test-email action.
Once global transport is enabled, provider fields are read-only with a link to separate
installation authentication. Forged workspace submissions cannot write installation
transport; secret replacement/clear is rejected. General Settings displays the effective
timezone and links to installation administration. Shared forms/shells are reused.
Strict Origin checks and installation session authorization apply to the new actions.

Preserve the complete control directory and control.key on a persistent volume. Keep
APP_URL set to the public URL; internal listener mapping is unchanged. No new Docker
service, volume, migration or production worker is enabled. Retain the original mail
settings key and old credential for legacy rollback even though enabled installation
mail no longer needs that environment key at runtime.

## Timezone semantics

New legacy and managed captures freeze the source deployment's effective timezone,
including TZ/UTC fallback. Capture intentionally reads source deployment environment,
not an already-enabled destination control-store timezone. Supply the source environment
when capturing. A previously staged null timezone uses the displayed current deployment
value on explicit enablement; once enabled, later environment changes do not override it.
An approved snapshot replacing active timezone must contain a valid IANA identifier.

The borrowed-item calendar helper now resolves installation timezone dynamically.
UTC Date values and database timestamps are not rewritten. Eligibility still compares
calendar date keys; interval arithmetic uses UTC midnight representations of those keys,
not elapsed 24-hour local durations. Existing server-local notification text formatting
and browser display/input behavior are unchanged. This is a calendar policy setting,
not a process-wide mutation of TZ. An intentional timezone change may change due-today
classification; review this before enabling a future scheduler. Tests cover spring and
fall DST boundaries and date-key UTC conversion.

## Review, retry and rollback

Capture has no runtime side effect. APPLY SNAPSHOT is still required; enabled categories
consume approved values only. Reviews contain encrypted previous mail/timezone values
and runtime markers. Public comparisons hide secret values, including newly captured
mail credentials. Administrator edits, runtime changes and profile edits invalidate
pending approvals. Apply/restore are transactional, retryable and idempotent; restoring
rotates versions and refuses to overwrite later edits. An enable retry for its original
fingerprint is a no-op, including after later administrator edits.

Source drift after capture is not automatically detected. Keep writers stopped and
recapture/refresh deliberately. Older binaries cannot parse the new internal secret
field: rollback requires a matching pre-cutover stopped control backup and original
secrets, not opening the new store with an old binary. Configuration rollback does not
roll back inventory. Encrypted history intentionally retains prior credentials; clearing
a runtime secret does not delete protected backups.

## Mail sending and safety limits

Transport reads are database-independent; dispatch remains a workspace operation.
Graph requests check active selection/revision before acquiring a token and again before
sendMail, rejecting stale processes after a switch. Tokens are transient, not persisted.
Provider response text is no longer copied into history/errors: fixed operation/status
messages avoid echoing credentials. No tests contact Microsoft or send real email.

An already-dispatched remote email cannot be recalled by a database switch, and the
current notification flow has no transactional outbox covering external delivery.
Managed scheduled reminders therefore remain disabled at both worker entry and service
entry. See the separate [worker audit and implementation plan](managed-reminder-worker-plan.md).

## Validation and acceptance limits

75 automated tests passed, including encrypted legacy/managed capture, old-key failures,
interrupted enablement and retry, restart and copied stopped-store recreation, simulated
MariaDB → SQL Server → MariaDB continuity, offline transport, workspace recipient/policy
isolation, credential clearing, stale edits/reviews, rollback and timezone/DST behavior.
Mock Graph calls verify a switch during token acquisition prevents sendMail. No real
email is sent. Typecheck/lint and managed-build/HTTP results are recorded below.

Real Docker container recreation, real SQL Server/MariaDB transport operation, live
Microsoft Graph delivery and visual browser acceptance remain deployment checks.
Copying a disposable stopped store and mocking databases is not live container or SQL
Server acceptance. Existing production/Astra/IT-Assets_DEV/staging stores and Docker
volumes were not accessed. Nothing is pushed or deployed.

Final validation: `npm test` passed 75 tests; `npm run typecheck`, `npm run lint` and
`npm run build:managed` passed. The build required approved local filesystem access
after Windows EPERM. `node --import tsx scripts/test-action-redirect.mjs` passed with
approved loopback access after sandbox EACCES. HTTP coverage exercises mail/timezone
enable/save, invalid zones, stale forms, offline masked HTML, forwarded hosts, strict
Origin and logout using public port 4052 / internal port 4050. The fixture server stopped.
