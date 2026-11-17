# Managed reminder worker — audit and separate implementation plan

Phase 5C.5 decision: keep managed scheduled reminders disabled. Persistent transport
and timezone do not by themselves make background scheduling safe across activation.

## Existing behavior

`npm run worker:borrowed-reminders` loads deployment environment and runs the standalone
worker. Legacy example Compose defines a separate worker with a fixed database URL,
settings encryption key and timezone environment. Managed Compose/supervisor does not
launch it. The standalone worker rejects IT_ASSETS_MANAGED=1 before importing its
processing service; the processing service now independently rejects managed calls.
Do not start a legacy worker against an inventory that may become inactive in managed
mode: it does not observe the control-store selection.

Default polling is 30 minutes, minimum 1 minute, using BORROWED_REMINDER_POLL_INTERVAL_MS.
`--once`, `--dry-run` and BORROWED_REMINDER_DRY_RUN=true are supported. A process-local
running flag prevents overlapping cycles only within that process. SIGINT/SIGTERM sets
a flag and waits for the current cycle; the polling sleep is not interruptible. Restart
starts another cycle. Errors are logged and subsequent cycles retry unless --once.

Legacy database selection follows normal environment/bootstrap resolution. The managed
web database proxy instead requires a selected profile and matching IT_ASSETS_REVISION;
the existing worker has no managed supervisor handshake, lifecycle or drain protocol.
Mail dependencies are workspace dispatch policies plus the runtime transport service.
Managed transport can now read control-store credentials, but that does not authorize
a worker or select a safe workspace for its notification records.

Reminder eligibility uses application timezone calendar dates. Due reminders use the
loan due-date key; overdue reminders use today's key modulo the workspace interval.
`scheduledFor` is UTC midnight of the date key, not the local wall-clock send instant.
Up to 5,000 outstanding loans are read in due-date order per cycle; there is no cursor
covering larger backlogs. Template timestamps currently use server-local formatting.

Dedupe keys include loan ID, reminder type and occurrence date. Unique insertion claims
a reminder; SENT/SKIPPED never retry. FAILED can retry after six hours and PENDING can
be reclaimed after two hours using a conditional update. These records remain in their
workspace. The Prisma P2002 detection currently uses the default generated client's
error class; separate SQL Server client compatibility must be proven before managed use.

## Duplicate and recovery gaps

The local running flag is not a deployment-wide lease. Unique claims reduce duplicates,
but Graph delivery and history/dedupe completion are separate operations. A crash after
Graph accepts mail but before SENT commits can reclaim the PENDING row and send twice.
A long-running sender can also outlive the pending reclaim interval. There is no fencing
token/lease heartbeat or supported delivery idempotency mechanism in this implementation.
A process can retain a prepared recipient/message while selection changes. New transport
revision checks stop dispatch detected before sendMail, but cannot recall an already
accepted remote request. Therefore exactly-once delivery is not guaranteed.

## Proposed implementation phases (not enabled)

1. Add an explicitly configured managed worker child under supervisor ownership, pinned
   to profile ID, revision and generation. Default disabled. Stop claiming, drain in-flight
   sends and stop the child before activation commits; restart only after exact-workspace
   readiness. Ensure old legacy workers are stopped during deployment cutover.
2. Define a per-workspace durable outbox and lease/fencing protocol with heartbeat and
   atomic claim/result transitions. Preserve recipient/policy provenance. Test generated
   Prisma error handling for both providers and concurrent worker ownership.
3. Decide delivery semantics for the crash-after-acceptance window. With no implemented
   external idempotency support, ambiguous outcomes need an explicit operator policy
   rather than automatic resend. Do not promise exactly-once delivery from SQL alone.
4. Capture timezone/policy versions per occurrence, define timezone-change behavior and
   add bounded backlog pagination. Preserve UTC storage and calendar-date eligibility.
5. Add deterministic fake Graph and disposable cross-provider tests for dual workers,
   activation while claiming/token-fetching/sending, lease expiry, SIGTERM, restart at
   every transition, failed retries, DST changes and ambiguous remote acceptance.
6. Add explicit deployment configuration, worker readiness/health, alarms and audit.
   Rehearse control+inventory backup/restore and rollback without sending real messages;
   then perform an operator-approved delivery test before production activation.

No worker implementation or Compose auto-start change is included in Phase 5C.5.
