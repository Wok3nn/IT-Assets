# Controlled integration architecture

Status: IT Assets foundation implemented, 2026-09-08. DeskMap has not been changed or
connected. A fresh installation reports **Not configured**.

## Goals and terminology

An **integration** is a reviewed external application registered in source. A
**connector** is that application's server-side client of this API. A **grant** maps
one explicitly approved external identity to a local user. A **scope** names a permitted
operation. This system does not install packages, evaluate supplied JavaScript, load
remote code, synchronize inventory, or provide an unrestricted database/export API.

IT Assets remains the asset system of record. The initial interaction is a deliberate
selection of a person in DeskMap opening a card and requesting their assignments.
Hover previews, write access and automatic identity synchronization are future work.

## Implemented components

| Component | Responsibility |
| --- | --- |
| `src/modules/integrations/integrations.shared.ts` | Reviewed registry, shared identity schema, scope and admin capability predicate |
| `integration-security.ts` | Random credentials, SHA-256 comparison, identity keys and bounded in-process limiter |
| `integrations.service.ts` | Settings persistence, credential/grant lifecycle, safe overviews and configuration audits |
| `integrations.admin.server.ts` | Current-session administrator guard |
| `integrations.api.ts` | Machine request validation, authorization, minimal read projection and success audit |
| `components/integrations-panel.tsx` | Feature-owned configuration UI using shared primitives |
| `src/app/(dashboard)/settings/integrations/page.tsx` | Page guards, server actions and composition |
| `src/app/api/integrations/v1/assigned-assets/route.ts` | Dynamic Node GET endpoint delegating to module |

Persistence uses scalar `Setting` rows under category `integrations` and keys
`integrations.<id>.*`. Individual values fit existing MariaDB VARCHAR(191) storage.
Existing `AuditLog` records capture activity. No schema or migration changes are needed.
All database access uses the central database service. The first registry ID is
`deskmap`; credential, grant and audit keys are namespaced by integration ID.

## Lifecycle and configuration

1. An active `SUPER_ADMIN` with both `viewSettings` and `managePermissions` opens
   Settings → Integrations. Every mutation rechecks this guard and completed setup.
2. Create a credential. The UI returns plaintext once; save it directly to the
   consuming application's backend secret store. It expires after 90 days.
3. Approve identities by specifying an active IT Assets user ID (from its profile URL)
   and either an Entra tenant/object ID pair or that same local user ID.
4. Enable the integration only after a valid credential and at least one grant exist.
5. The first successful API request records communication time. This is historical
   evidence of a read, not an ongoing connection health check.
6. Disable to suspend reads; revoke to remove the credential; rotate to immediately
   replace its hash, reset communication state and disable pending explicit re-enable.

Rotation and revocation retain mappings so administrators can inspect/remove them.
Adding the same external identity again deliberately replaces its mapping, with the
old and new target recorded in the audit payload. Removal prevents subsequent reads
for that identity. A deleted/inactive mapped user receives the same 404 as an unknown
grant. Already authorized in-flight requests may finish after a disable/revoke action.

Statuses are Not configured, Credential expired, Disabled, Awaiting first request,
and Last communication recorded. There is no fabricated Connected status or outbound
connection test. The page shows credential expiry, scope, mappings and ten most recent
activity summaries; it does not return stored token hashes to client components.

## Authentication and secret handling

Requests authenticate only with `Authorization: Bearer <token>`. Tokens contain an
integration prefix and 32 cryptographically random bytes encoded as base64url. Only
SHA-256 hashes are persisted and comparison uses constant-time verification. Tokens
are not accepted in query parameters, cookies or request bodies. Interactive session
cookies do not authorize this API. Tokens do not grant application sign-in or admin access.

Plaintext is available only in the immediate credential creation action result/UI.
It is not recoverable from later page loads. Do not log authorization headers, place
tokens in URLs, commit them, or send them to browser code. Configure HTTPS at the proxy
and redact headers in infrastructure logs. Hashes do not need reversible encryption;
other application secrets still rely on the existing persistent settings encryption key.

## Authorization and identity

The sole implemented scope is `assigned-assets:read`. There is no write, user-list,
audit, finance, or unrestricted asset scope. An administrator's explicit per-user grant
approves **all current and future direct assignments to that user**, regardless of
interactive asset scopes or status. This is a separate machine policy, not impersonation
of that user's interactive permissions. Do not grant a person when only a subset of
their assignments may be shared; field/asset-level grants are not implemented.

Preferred identity: Entra **tenant ID + object ID**, both normalized UUIDs. Object ID
alone is insufficient across tenants. The current IT Assets User model does not persist
Entra Object ID and has no synchronization service. Its existing Entra login email
matching remains unchanged. Administrators must independently verify the mapping;
the connector never silently matches an email address or display name.

Fallback: the IT Assets immutable local user ID, explicitly approved for the same user.
DeskMap must store that mapping if it cannot supply a verified Entra identity. A user's
email/name change does not change a stored grant. Recreated or moved Entra accounts
require review of their new identifiers. Removed local users require a fresh mapping.

The consumer's backend must authorize its own viewer before making a request. A valid
connector token can query every identity granted to that integration; IT Assets cannot
infer which DeskMap viewer clicked a card. No asset-record links are returned because
those require separate interactive access. Guests and borrowed loans are excluded:
this contract reads `Asset.assignedUserId`, not temporary borrower relationships.

## API v1 contract

`GET /api/integrations/v1/assigned-assets`

Required query parameters: `type=entra`, `tenantId=<UUID>`, `id=<object UUID>`; or
`type=local`, `id=<local CUID>` without tenantId. Optional `limit` is an integer 1–100
(default 50). Optional `after` is the last asset CUID from `nextCursor`. Unknown or
duplicate parameters are rejected. IDs sort ascending for cursor pagination.
Concurrent assignment changes between pages are not a snapshot guarantee.

Example DeskMap backend request (placeholder credential, never a real token):

```http
GET /api/integrations/v1/assigned-assets?type=entra&tenantId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa&id=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb&limit=50 HTTP/1.1
Host: assets.example.org
Authorization: Bearer <server-held-token>
Accept: application/json
```

```json
{
  "identity": {
    "type": "entra",
    "tenantId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
  },
  "assets": [
    {
      "id": "cmexampleasset000000000001",
      "assetTag": "IT-1042",
      "name": "Work laptop",
      "make": "Dell",
      "model": "Latitude",
      "status": { "key": "ASSIGNED", "name": "Assigned" }
    }
  ],
  "nextCursor": null
}
```

The projection is exactly asset ID, tag, name, make, model and status key/name.
Optional model fields/status can be null. Response identity echoes the normalized
approved identity and does not add the local user ID to an Entra response. No email,
serial number, notes, price, location, audit entries or administrator information is
returned. A granted active user with no assignments gets `assets: []`, status 200.
Assigned assets are included even if a custom/retired status remains on the record.

Errors use `{ "error": { "code": "..." } }`:

| HTTP | Code | Meaning |
| --- | --- | --- |
| 400 | `invalid_request` | Invalid/duplicate/unknown parameters |
| 401 | `unauthorized` | Missing, malformed, invalid, revoked or expired credential |
| 403 | `forbidden` | Valid credential but disabled integration or incorrect scope |
| 404 | `not_found` | Unapproved identity or inactive/missing target user |
| 429 | `rate_limited` | Request budget exhausted; honor `Retry-After` |
| 503 | `unavailable` | Incomplete setup or storage/transaction failure |

401 includes `WWW-Authenticate: Bearer`. Responses carry `Cache-Control: no-store`
and `X-Content-Type-Options: nosniff`. The Next route rejects unsupported mutation
methods with 405; framework-generated method responses need not use the JSON envelope.
There is no browser CORS integration; use a server-to-server request. API changes that
remove fields or alter semantics require a new version. Additive changes should be
reviewed and reflected in consumer contract tests.

## Limits, failures and audit

A bounded fixed-window limiter admits at most 120 requests/minute per application
process in total and 60 authenticated requests/minute per integration. The global
admission budget includes valid traffic and malformed requests; it is not a per-IP
limiter and resets on restart. Multi-instance production deployments need shared/edge
limits and request-size/concurrency protections. Do not trust caller-supplied forwarding
headers to create identities. The in-process map accepts only registry IDs and one
anonymous bucket, preventing attacker-created unlimited keys.

Reads are capped at 101 selected rows (100 plus pagination sentinel). Transactions
allow 2 seconds to acquire and 5 seconds to execute. These limits do not impose a total
HTTP deadline: the initial configuration read and database connection establishment use
provider defaults. Configure a finite ingress deadline and a consumer timeout (for
example 10 seconds). DeskMap should display an unavailable state and retry with bounded
backoff for 429/503, respecting Retry-After, without retrying invalid credentials.
No outgoing network request is made by this integration foundation.

Successful reads update last-success time and insert an audit row in the same transaction
as the read; audit failure therefore returns 503 instead of returning unrecorded data.
Records identify the integration and target local user/count, without the credential or
asset payload. Configuration actions record the administrator and operation; mapping
changes also record identity and previous/new target where applicable. Denied requests
are not individually persisted to avoid attacker-driven audit growth. A generic server
warning is emitted for API failures, excluding request URLs, identities and raw database
errors. Central proxy monitoring and retention policies are deployment responsibilities.
The success audit grows with use; plan retention before high-volume rollout.

## Tests and remaining work

Implemented tests cover credential format/hash handling, expiry, rotation/revocation,
rate limiter boundaries, tenant normalization/isolation, local grants, invalid inputs,
inactive users, disabled/scope enforcement, pagination, minimal fields, audit secrecy,
admin predicate, rendered initial UI and assignment/loan/guest regression scenarios.
The review plan records database-provider and live HTTP validation limitations.

DeskMap must later implement:

1. Backend secret storage and authenticated client with timeouts, pagination and backoff.
2. Verified Entra tenant/object identities, or administrator-approved local mappings.
3. Viewer authorization before each request; no browser-visible connector credential.
4. A click/selection card showing tags and handling loading, no-assets, unavailable and
   authorization errors without confusing them. Hover previews are optional later work.
5. Joint staging contract/security tests and credential rotation procedures.

Future integrations require a reviewed registry entry and matching ID validation;
shared storage/security/read logic is already namespaced. Multiple installations of
one consumer currently share one entry/credential and require separate registry IDs or
an explicitly designed client-instance model. New scopes or write operations require
separate authorization and audit design. OAuth/service identities, automatic Entra
mapping, per-asset grants, distributed limits, retention jobs and connection health
probes are proposals, not features in this foundation. Do not extend this into a remote
package loader.
