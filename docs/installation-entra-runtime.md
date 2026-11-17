# Phase 5C.4 — persistent Microsoft Entra credentials

Implemented locally on 2026-11-17. No deployment or existing database access.

## Ownership and activation

Previously, managed `auth_config` was profile-specific and referenced an environment
secret; legacy deployments read inventory Setting records. After explicit installation
administrator enablement, tenant ID, client ID, callback override and client secret
come exclusively from the encrypted installation record. Microsoft Entra remains the
fixed provider; there is no new provider registry or duplicated credential authority.

Local-login recovery, Entra enablement, SSO-only account policy and group-to-role
mappings remain workspace-specific. Enabling the installation provider does not enable
login in another inventory. Users, roles, permissions, sessions and tokens are never
captured. The callback still requires an existing active, login-enabled user in the
currently selected database. It never provisions users. A new SQL workspace must
explicitly provision identities and configure its own sign-in policy/mappings.

## Upgrade and management

Use the existing offline legacy staging or managed-profile capture/review workflow.
Keep source writers stopped through capture and resolution. Capture now freezes the
verified Entra secret inside the encrypted snapshot, so later environment changes do
not alter a newly captured credential. Existing reference-only snapshots remain
supported at enablement using their original managed environment reference. Restore
that reference or recapture if it is unavailable; incomplete enablement changes nothing.

After staging/review, sign in separately as installation administrator under Database
Management and type ENABLE in the Microsoft Entra section. This does not switch a
database. Ordinary users have no additional setup steps. The installation page works
with inventory offline and edits tenant/client/callback values plus an optional secret
replacement. Blank secret means preserve. Workspace Authentication retains its layout
and policy/mapping editors; provider fields become read-only with a management link.
Workspace saves cannot replace installation credentials, including forged requests.

APP_URL remains the public URL, including a mapped port such as 4052. Leave callback
blank to use APP_URL + /api/auth/entra/callback, or enter the exact registered public
callback. The internal listener/self-fetch origin remains separate; no origin or CSRF
allowlist was relaxed. Keep the whole persistent control directory, including
control.sqlite and control.key, mounted across container recreation. No new environment
secret is required after enablement, but retain the old deployment secrets for rollback.

## Credentials, conflicts and rollback

The secret is encrypted by existing AES-256-GCM control envelopes (including review
history), never put in public props, HTML, audit messages or ordinary settings columns.
Only server-side transport receives plaintext in memory. UI exposes configured status
and an empty replacement field. Callback failures use fixed error messages rather
than returning provider errors that might echo credentials. Protect control backups
and key together; the key is intentionally not regenerated when encrypted records exist.

Enable/save require installation authentication, strict Origin and version checks.
Reconciliation retains explicit APPLY SNAPSHOT approval, encrypted previous credentials,
atomic audit/commit, idempotent resolution/restore and baseline conflict rejection.
Already-active Entra requires a complete candidate; applying incomplete source settings
cannot clear it. Approved replacements rotate the runtime version. Restoration also
rotates it and refuses to overwrite later edits. Capture alone never enables Entra.
Source drift after capture still requires explicit recapture; reviews are snapshots.

Sign-in state pins the Entra configuration version. Changes between start and callback
are rejected, with another check before session creation. Existing cookie realm and
activation revision isolate workspace cookies, and the database proxy fences stale
process revisions. Installation login remains separate from workspace sessions.

Unmanaged deployments and managed installations before enablement retain their existing
runtime. Legacy inventory records and profile transport settings remain available for
rollback. Older binaries do not understand the new encrypted credential field: roll
back using the matching stopped pre-cutover control backup and original deployment
secrets, rather than opening the upgraded store with an old binary. Do not overwrite
inventory data to roll back configuration. New global secret rotation does not update
the legacy secret; verify the original credential is still valid before rollback.

## Validation and remaining acceptance

Automated tests use new temporary control stores, unreachable saved profile targets,
mocked inventory clients and locally signed fixture Entra tokens. They test adoption,
missing credentials, interrupted transactions/retry, encryption, restart, MariaDB →
SQL Server → MariaDB selection, stale edits, masked conflicts and rollback. Actual
start/callback route tests mock only provider HTTP and database clients, testing PKCE,
public callback port 4052, nonce/state, workspace identity denial, independent mappings,
configuration changes and cookie revision isolation. No real Entra sign-in is claimed.

Mapped-port HTTP coverage uses only 127.0.0.2:4050 with public Host/Origin localhost:4052,
an isolated temporary store and the managed build. It exercises offline enable/save,
masked HTML, stale saves, proxy headers, foreign origins and installation logout.

Real Entra tenant sign-in, real cross-provider inventory authorization and Docker
container recreation remain deployment acceptance checks. Persistent-store reopen and
mocked cross-provider tests are not substitutes for those checks. Mail and timezone
runtime remain outside this increment. No production, Astra, IT-Assets_DEV, staging
store or existing persistent Docker volume was accessed, and nothing was pushed.

Validation completed: `npm test` passed 69 tests; `npm run typecheck`, `npm run lint`
and `npm run build:managed` passed. `node --import tsx scripts/test-action-redirect.mjs`
passed, including new Entra HTTP actions. The managed build required approved local
filesystem access after Windows EPERM; the HTTP fixture required approved loopback
access after sandbox EACCES. Fixture server stopped normally. No live inventory used.
