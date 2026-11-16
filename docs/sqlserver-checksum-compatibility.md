# SQL Server checksum compatibility — 2026-11-16

Root cause established from local bytes, Git history and owner-supplied database
diagnostics; no live database was accessed.

The Windows file is 19,786 bytes: 451 LF endings and a final CRLF on line 452.
HEAD is 19,785 bytes: 452 LF endings. Both start with `BEGIN`, without a BOM.
After CRLF-to-LF normalization they are byte-identical. There are no SQL changes.
System Git config has `core.autocrlf=true`; no applicable attributes/filter were
reported. Git's clean normalization removes the final CR, explaining clean status
despite different working-file bytes. The HEAD blob is unchanged from `9d2ddd1`.
`2b0cb14` created the separate legacy SQL Server migration history, not this migration.

The database recorded the executed mixed-ending Windows hash
`c6b8c50026d1be6eded4166c8c668ca5ff115789d4677f5e982c0f8ddca199a5`.
Linux uses canonical hash
`59d4f44d2e81890d05b0fdf5289c646eb5a2319a34da5403afb4b369509eb09e`.
The inspector's all-LF/all-CRLF candidates omitted the mixed-ending hash, returning
incompatible before the live DDL comparison. Converting the entire file to CRLF
cannot reproduce a file whose only CRLF is its final newline.

The fix recognizes that historical hash only for SQL Server migration
`20261105000000_inventory` AND the exact verified canonical content hash. Changed SQL,
other migrations/providers and arbitrary checksums remain rejected. All catalog,
completed-history, live Prisma schema-diff and independently verified filtered-index
checks still run. `.gitattributes` pins migration checkouts to LF. No historical SQL
blob or database history row was edited. Unrecognized checksums now produce a specific
safe UI error instead of an unexplained incompatible result.

The owner's metadata establishes permissions, successful migration and required
filtered indexes. It does not prove complete live DDL parity. After this fix, reinspect;
any further mismatch must be investigated on a disposable copy, not bypassed.

Session fixes include `0e4d90c`: refresh/action document transitions no longer send an
unconditional logout beacon. Server-side departure revocation, explicit logout, fixed
one-hour expiry, origin checks and authorization remain. Expired setup requests now
carry an allowlisted step 1–5 through sign-in; existing server step gates still apply.
No arbitrary return URL is accepted and no session is extended indefinitely.

## Staging procedure (owner-operated; no push performed)

Transfer/review the local commits before rebuilding; a remote pull cannot retrieve
unpushed changes. On Ubuntu use the SAME staging Compose files, environment and project
as the existing deployment. Set `IT_ASSETS_MANAGED_URL=http://localhost:4052` when the
browser accesses the SSH tunnel at that origin; retain 4052:4050 mapping. A different
Host/Origin must not be solved by disabling CSRF checks. Keep the existing control
volume and deployment secrets. Do not use `down -v` or touch port 4051/Astra.

```sh
docker compose -p it-assets-v060-staging -f /absolute/path/to/staging-compose.yml config --quiet
docker compose -p it-assets-v060-staging -f /absolute/path/to/staging-compose.yml build web
docker compose -p it-assets-v060-staging -f /absolute/path/to/staging-compose.yml up -d --no-deps web
```

Sign in once; save/test/reinspect repeatedly, refresh, traverse permitted steps,
then verify explicit logout and expired-session step restoration. Reinspect the existing
SQL profile; do not initialize it. Docker/browser validation must be recorded on staging.
Docker is unavailable on this workstation; no remote Docker acceptance is claimed.

Legacy upgrade remains the explicit offline adoption procedure in `docker-upgrade.md`:
preserve database, original settings key, Entra secret/configuration and branding files;
enroll the separate installation administrator and explicitly activate. A Git pull does
not import/activate databases or recreate workspace users. Switching does not migrate
records or confer roles in another workspace. Reminder-worker continuity, live Entra,
Docker recreation and restore/rollback remain production acceptance gates.

Validation: 40 automated tests, typecheck, lint, managed build and isolated offline HTTP suite passed. No Docker/browser or live SQL Server validation executed. The HTTP test server was stopped. No inventory records or migration history were modified; nothing pushed.
