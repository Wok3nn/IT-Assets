# Managed server-action redirects behind Docker/proxies

The installed Next.js 15 action handler fetches an app-relative redirect as an RSC
response. Without `__NEXT_PRIVATE_ORIGIN`, it builds that fetch origin from the
request Host/forwarded host. A browser accessing localhost:4052 sends that public
authority even though the container only listens on 4050. The container therefore
tries its own loopback port 4052 and receives ECONNREFUSED. APP_URL must remain public;
changing it to the internal URL would break strict origin validation and callbacks.

`managed-web.mjs` now sets Next's private origin after binding, before reporting ready,
using the actual TCP socket address and port. Wildcard IPv4/IPv6 listeners resolve to
their corresponding loopback address; explicitly bound addresses remain explicit.
Self-fetch transport is HTTP because the custom Node listener is HTTP, including when
a proxy terminates public HTTPS. Browser headers never select this internal target.
No hostname, public deployment port or production domain is hardcoded in this routing.

`IT_ASSETS_MANAGED_URL` still sets public `APP_URL`. Origin equality checks, Next's
Host/Origin checks, cookie security, session expiration, authentication callbacks and
revision fences are unchanged. Configure the reverse proxy to preserve the public
Host (including nondefault port), or supply the correct trusted forwarded host; strip
untrusted client-supplied forwarding headers at the proxy. Do not enable wildcard
Server Action allowed-origins or rewrite browser Origin to bypass validation.

## Deployment

Keep the staging configuration:

```yaml
environment:
  IT_ASSETS_MANAGED_URL: http://localhost:4052
  IT_ASSETS_BIND: 0.0.0.0
ports:
  - "4052:4050"
```

For reverse proxies, use the actual public HTTPS origin instead. No new deployment
environment variable is required; do not manually set `__NEXT_PRIVATE_ORIGIN`.
After transferring the reviewed local commit (nothing is pushed automatically), rebuild
and recreate only staging web using its original Compose file and persistent volumes:

```sh
docker compose -p it-assets-v060-staging -f /absolute/path/to/staging-compose.yml build web
docker compose -p it-assets-v060-staging -f /absolute/path/to/staging-compose.yml up -d --no-deps web
```

Do not change production, Astra port 4051, database services or control volumes.
The private variable is a Next.js implementation hook, verified against the installed
version. Run `node --import tsx scripts/test-action-redirect.mjs` after managed builds
and Next upgrades: it exercises actual streamed action redirects with public port
4052 and internal port 4050, without an asset database. Docker runtime acceptance
must still execute in staging; local HTTP emulation is not a Docker test.

## Validation (2026-11-16)

Passed 41 automated tests, typecheck, lint and managed build. The isolated action
regression passed direct public Host and reverse-proxy forwarded-host cases for
4052 to 4050, streamed login/profile-save redirects, repeated authorized actions,
foreign and forged matching origins, and logout/session invalidation. It binds
127.0.0.2:4050 to avoid the existing localhost SSH tunnel. All profiles are disposable
and point at an unreachable fixture address; no inventory connection is made.
Docker staging acceptance and live workspace authentication remain deployment checks.
