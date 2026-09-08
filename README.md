# IT Asset Tracker

Self-hosted asset management for internal IT teams: inventory, user and guest
assignments, check-in/out, labels and printing, imports/exports, Borrowed Items,
reminders, audit history, configurable permissions, and optional Microsoft Entra login.
The application runs on **port 4050**.

Built with Next.js App Router, React, TypeScript, Tailwind, Zod and Prisma 6.
**MariaDB 11.4 is the supported production database.** SQLite is a development/test
compatibility option; external SQL Server remains experimental and paused.

## Local development

Prerequisites: Git, Node.js 20 (the Docker/CI baseline), npm, and an isolated MariaDB
11.4 database. Never use a production database for development, migrations or tests.

```sh
git clone https://github.com/Wok3nn/IT-Assets.git It-Assets-Tracker
cd It-Assets-Tracker
npm ci
```

Copy `.env.example` to `.env` (`cp .env.example .env` on Unix,
`Copy-Item .env.example .env` in PowerShell). Set:

```dotenv
APP_URL=http://localhost:4050
DB_MODE=local
DB_PROVIDER=mariadb
DATABASE_URL=mysql://it_assets_dev:local-dev-password@127.0.0.1:43306/it_assets_dev
APP_DATA_DIR=./data
SESSION_SECRET=replace-with-a-random-secret
APP_SETTINGS_ENCRYPTION_KEY=replace-with-a-separate-random-key
```

Generate each secret separately:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Keep the encryption key stable across restarts and backups. Changing it makes saved
encrypted settings unreadable until re-entered. Never commit `.env`, credentials,
database copies or bearer tokens. URL-encode special characters in database passwords.
Explicit shell environment variables take precedence over environment files.
Prisma scripts load `.env`; Next.js also loads `.env.local`, which takes precedence
over `.env`. Keep database selection out of `.env.local`, or explicitly set identical
shell values for both commands, to avoid selecting different databases.

### Start a disposable local MariaDB

The following single-line command is valid in PowerShell and Unix shells. It exposes
only loopback port 43306 and uses a dedicated development container and volume:

```sh
docker run --name it-assets-dev-db -d -p 127.0.0.1:43306:3306 -e MARIADB_DATABASE=it_assets_dev -e MARIADB_USER=it_assets_dev -e MARIADB_PASSWORD=local-dev-password -e MARIADB_ROOT_PASSWORD=local-root-password -v it-assets-dev-db:/var/lib/mysql mariadb:11.4
docker logs it-assets-dev-db
```

Wait for MariaDB to report that it is ready. For subsequent starts use
`docker start it-assets-dev-db`. These example passwords are for an isolated local
instance only. If MariaDB is already installed, create an empty development database
and a dedicated user with database-level privileges, and adjust the URL's port.

Apply **existing** migrations and seed the new database:

```sh
npm run db:generate
npm run db:validate
npm run db:deploy
npm run db:seed
npm run dev
```

Open [localhost:4050](http://localhost:4050) and complete setup to create the initial
administrator. Seeding creates/updates baseline reference data; it does not create
an administrator. Use it deliberately: repeated seeding can restore default reference
labels/colors. Production startup uses the separate bootstrap script.

### Database permissions and new migrations

Applying migrations requires DDL and DML privileges on the application database.
The example MariaDB image grants its configured user access to that database.
`db:deploy` applies committed migrations and does **not** need a shadow database.

`npm run db:migrate -- --name descriptive_change` creates a migration with Prisma
`migrate dev`. Prisma creates and drops a temporary shadow database, so the development
account also needs `CREATE, ALTER, DROP, REFERENCES` globally. On the isolated example
instance, grant these through its administrator:

```sh
docker exec -it it-assets-dev-db mariadb -uroot -p
```

```sql
GRANT CREATE, ALTER, DROP, REFERENCES ON *.* TO 'it_assets_dev'@'%';
```

Use these broad privileges only on a dedicated development instance. If your database
administrator disallows automatic shadow databases, agree on a separate shadow database
and explicit Prisma shadow configuration before creating migrations. This repository
does not currently configure a shadow URL. Never point a shadow database at application
data. Do not run `migrate dev` against production.

## Commands and validation

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server on 4050 |
| `npm test` | Pure logic, security, setup and rendered integration UI tests |
| `npm run test:db` | Destructive-fixture suite; requires an explicit disposable database URL |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript; generate Prisma first |
| `npm run db:generate` | Generate client for selected provider |
| `npm run db:validate` | Validate selected schema |
| `npm run db:deploy` | Apply committed migrations |
| `npm run db:migrate -- --name example` | Create/apply development migration; shadow DB required |
| `npm run db:seed` | Seed baseline reference data |
| `npm run db:bootstrap` | Startup reference-data bootstrap |
| `npm run build` | Generate Prisma and build production app |
| `npm start` | Run production build on 4050 |
| `npm run worker:borrowed-reminders:dry-run` | Inspect eligible reminders without sending mail |

For a normal source check, run `db:generate`, `test`, `lint`, `typecheck`,
`db:validate`, then `build`. For database tests, create a **separate empty** loopback
MariaDB database named `it_assets_ci_test` (or `it_assets_<name>_test`). Explicitly
set `DB_MODE=local`, `DB_PROVIDER=mariadb` and `DATABASE_URL` in the shell, then run
`db:generate`, `db:deploy`, `db:seed`, and `test:db`. The suite creates persistent test
fixtures and refuses ordinary database names. It blocks external fetch calls.
The CI workflow provides the complete isolated MariaDB example.

On PowerShell set variables with `$env:DB_PROVIDER='mariadb'`; on Unix use
`export DB_PROVIDER=mariadb`. Restore your development variables and regenerate the
client whenever changing providers. Database test success on SQLite does not establish
MariaDB migration compatibility. See [validation results](docs/refactor-plan.md).

## Docker production deployment

Use [docker/docker-compose.example.yml](docker/docker-compose.example.yml), which
builds the web app and reminder worker alongside MariaDB. The example assumes:

- Repository at `/opt/docker/apps/It-Assets-Tracker` (edit `build.context` otherwise).
- Persistent database at `/opt/docker/data/it-assets-tracker/mariadb`.
- Persistent application data at `/opt/docker/data/it-assets-tracker/app`.

Copy the compose file to your deployment directory and edit its passwords, both
matching database URLs, `SESSION_SECRET`, external `APP_URL`, and the same persistent
`APP_SETTINGS_ENCRYPTION_KEY` for web and worker. `.env.example` is a reference;
compose service environment values are the deployment configuration. Keep port 4050,
or explicitly set `IT_ASSETS_HOST_PORT` for a separate test stack.

```sh
docker compose -f /path/to/IT-Assets-Tracker.yml up -d --build
docker compose -f /path/to/IT-Assets-Tracker.yml logs --tail=100
```

Complete the setup wizard. For updates, back up first, fetch/review the intended
release, then rebuild with the same compose command. Keep recoverable database backups
using a consistent MariaDB backup/dump procedure, application state and encryption key;
copying a running database directory alone is not a reliable backup. Branding uploads
currently use the app's public directory and need separate persistence planning.
Terminate HTTPS at your reverse proxy and set `APP_URL` to its external URL.

The optional worker processes due/overdue reminders. Configure Exchange Email Service
in Settings; keep its encryption key identical to the web app. Test only against a
disposable database with `BORROWED_REMINDER_DRY_RUN=true`. Initial worker startup can
race web migrations; inspect logs and restart the worker after first-time initialization
if needed. Docker runtime validation remains required on a Docker-capable host.

## Integrations

Settings → Integrations provides the IT Assets side of a controlled, read-only
DeskMap connector. An active super-admin with settings/permissions capabilities can
create a credential, approve user mappings and enable access. A fresh installation
shows **Not configured**. DeskMap still needs its own server-side connector and card UI.
See [the integration contract](docs/plugin-architecture.md).

## Troubleshooting

- Connection refused: confirm MariaDB readiness, URL host/port and container logs.
- Shadow database permission error: use `db:deploy` for existing migrations; new
  migrations need the development permissions above.
- Wrong Prisma provider or missing models: inspect explicit environment variables and
  `.env.local`, then regenerate; do not mix generated clients between providers.
- Port 4050 busy: stop the other development instance before starting this one.
- Setup/sign-in redirects: confirm migrations and initial setup completed on the same
  database used by the app. Do not bypass setup or change production permission defaults.
- Decryption failure: restore the original encryption key or re-enter the affected
  setting through its authorized settings page.
- Integration 401/403: check credential expiry, rotation, enabled state and approved
  mapping. Tokens belong in the caller's backend secret store, never browser code.

## Architecture and review

- [Architecture and ownership rules](docs/architecture.md)
- [Integration architecture and API v1](docs/plugin-architecture.md)
- [Audit findings, completed phases, validation and deferred work](docs/refactor-plan.md)

Existing dependency advisories and permission-policy risks are recorded in the review
plan. Review them before exposing a deployment to untrusted networks.
