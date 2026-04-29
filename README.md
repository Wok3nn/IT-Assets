<p align="center">
  <img 
    src="https://github.com/user-attachments/assets/786c4b73-204c-49bc-bfbf-cbe17c38e8f7" 
    width="200" 
    alt="IT-Asset-Tracker Logo"
  />
</p>

<h1 align="center">IT-Assets</h1>

<p align="center">
  A self-hosted asset management app for teams that need a simple way to track equipment, people, locations, categories, and printable labels from one web interface.
</p>

# IT-Asset-Tracker

IT-Asset-Tracker is a self-hosted asset management app for teams that need a simple way to track equipment, people, locations, categories, and printable labels from one web interface.

It is designed for small to mid-sized internal environments that want:
- a clean browser-based inventory system
- local admin setup and optional Microsoft Entra sign-in
- printable asset labels with reusable templates
- Docker Compose deployment with MariaDB-backed persistence

## What It Does

The app currently includes:
- first-run setup for the initial workspace and admin account
- asset, user, category, department, and location management
- role and permission controls
- import/export tools for multiple entity types
- label template creation, preview, and print workflows
- theme-aware branding and a Docker-ready deployment path

## Recommended Docker Compose Deployment

The supported production deployment path is Docker Compose with two containers:
- `IT-Assets` for the app
- `IT-Assets-MariaDB` for the database

Use the main Compose file in this repository:

```bash
docker compose -f docker/docker-compose.example.yml up -d --build
```

That file is equivalent to this deployment shape:

```yaml
services:
  mariadb:
    container_name: IT-Assets-MariaDB
    image: mariadb:11.4
    environment:
      MARIADB_DATABASE: it_assets
      MARIADB_USER: it_assets
      MARIADB_PASSWORD: change-me
      MARIADB_ROOT_PASSWORD: change-me-root
    volumes:
      - mariadb_data:/var/lib/mysql
    healthcheck:
      test: ["CMD-SHELL", "mariadb-admin ping -h 127.0.0.1 -uroot -p$$MARIADB_ROOT_PASSWORD --silent"]
      interval: 5s
      timeout: 5s
      retries: 20

  it-assets:
    container_name: IT-Assets
    build:
      context: ../apps/IT-Assets
      dockerfile: docker/Dockerfile
      args:
        DB_PROVIDER: mariadb
    depends_on:
      mariadb:
        condition: service_healthy
    ports:
      - "4050:4050"
    environment:
      PORT: 4050
      APP_URL: http://localhost:4050
      SESSION_SECRET: SECRET_SESSION_KEY_CHANGE_ME
      SESSION_COOKIE_SECURE: auto
      DB_MODE: local
      DB_PROVIDER: mariadb
      DATABASE_URL: mysql://it_assets:change-me@mariadb:3306/it_assets
      APP_DATA_DIR: /data
    volumes:
      - /opt/docker/data/it-assets:/data
    restart: unless-stopped

volumes:
  mariadb_data:
```

Basic startup flow:

1. Clone the repository.
2. Review `docker/docker-compose.example.yml` and change `APP_URL`, `SESSION_SECRET`, and database passwords.
3. Create the host app data directory if you use the default bind mount:

```bash
mkdir -p /opt/docker/data/it-assets
```

4. Build and start the container:

```bash
docker compose -f docker/docker-compose.example.yml up -d --build
```

5. Open `http://localhost:4050` and complete the first-run setup wizard.

On container startup, the app automatically:
- waits for MariaDB to become healthy
- creates its internal `/data/state` and `/data/uploads` folders if they do not exist
- applies MariaDB Prisma migrations automatically on first startup and later updates
- bootstraps missing default roles and asset statuses without overwriting existing records

You should not need to run `npx prisma ...` inside the container.

## First-Run Setup

<img width="1172" height="883" alt="image" src="https://github.com/user-attachments/assets/74397022-3000-437d-8d90-95cf60228096" />

On a fresh database, the app opens the First-Run Setup page. This creates the initial workspace and the first local admin account.

After setup is complete:
- `/setup` is no longer the normal landing page
- you sign in through `/login`
<img width="469" height="591" alt="image" src="https://github.com/user-attachments/assets/11601469-0a0f-4dbb-9c4a-d863bf6f5789" />

- the main dashboard becomes available
<img width="2276" height="1250" alt="image" src="https://github.com/user-attachments/assets/db2d43d7-66e7-409e-b14e-9f02f07efa68" />

## Key Environment Variables

These are the main environment values most deployments need:

- `PORT`: the web server port inside the container. Default is `4050`.
- `APP_URL`: the public base URL used for redirects, logout, and authentication callbacks.
- `SESSION_SECRET`: the secret used to sign session data. Change this before production use.
- `SESSION_COOKIE_SECURE`: optional. `auto` works well for most deployments and turns on secure cookies automatically when `APP_URL` uses `https`.
- `DB_MODE`: should be `local` for the supported Docker Compose deployment.
- `DB_PROVIDER`: should be `mariadb` for the supported Docker Compose deployment.
- `DATABASE_URL`: Prisma database connection string. For Docker Compose, use the MariaDB service hostname, for example `mysql://it_assets:change-me@mariadb:3306/it_assets`.
- `APP_DATA_DIR`: root directory for runtime app data such as state files. In Docker, this should normally be `/data`.

## APP_URL Guidance

`APP_URL` must match the real URL users can reach.

Examples:
- `http://localhost:4050` for a local test deployment
- `https://assets.example.com` behind a reverse proxy

Important:
- if you use a reverse proxy, set `APP_URL` to the public URL, not the container hostname
- do not use internal Docker hostnames for redirects or callbacks
- logout and Microsoft Entra callback behavior depend on this being correct

## Microsoft Entra SSO Note

If you enable Microsoft Entra sign-in, the callback URL in the Entra app registration must exactly match the deployed app URL.

Example:

```text
https://assets.example.com/api/auth/entra/callback
```

Use the same public base URL as `APP_URL`. Do not register an internal container hostname.

For Entra group-to-role mapping to work reliably, especially when the ID token does not contain the `groups` claim because of group overage, the Entra app registration also needs Microsoft Graph delegated permission for signed-in user group lookup:

- `User.Read`

After adding the permission, grant tenant/admin consent if your Entra tenant requires it for this app. The app uses the signed-in user token to call:

```text
GET https://graph.microsoft.com/v1.0/me/transitiveMemberOf/microsoft.graph.group?$select=id
```

Group mappings continue to match Entra group Object IDs from Settings > Authentication. If no mapped group is found, the app falls back to the user’s local stored role.

## Where Data Is Stored

In the Docker flow above, persistent data is stored in the mounted host directory:

```text
/opt/docker/data/it-assets
```

Inside the container, the app uses:
- `/data/state` for app state files
- `/data/uploads` for uploaded app files

MariaDB stores database files in the Compose-managed `mariadb_data` volume by default. You can replace that volume with a bind mount if your host backup strategy requires a specific path.

SQLite is not the supported production deployment path. It can remain useful for local development or targeted tests, but production Docker deployments should use MariaDB.

SQL Server external mode is experimental and paused. The related code may remain in the repository for future work, but it is not the recommended deployment path and the normal Docker Compose flow should not route through `/setup/db`.

## Updating The App

For a typical Docker deployment:

1. Pull the latest changes:

```bash
git pull
```

2. Rebuild and restart:

```bash
docker compose -f docker/docker-compose.example.yml up -d --build
```

3. Let the container restart normally. It applies pending migrations automatically on startup before the app server begins accepting requests.

Avoid `npx prisma ...` inside the container. If you ever need a manual Prisma command, use the project scripts such as `npm run db:deploy` so the local pinned Prisma version is used.

## Validation Before Push

The repository includes a lightweight GitHub Actions validation workflow that runs on pull requests and pushes to `main`.

It checks:
- dependency install with `npm ci`
- TypeScript validation with `npm run typecheck`
- a full production build with `npm run build`

If you want to run the same checks locally before pushing:

```bash
npm ci
npm run typecheck
npm run build
```

## Optional `.env.example`

The repository includes [.env.example](./.env.example) as an optional reference for local development and custom deployments.

It is useful when:
- running the app outside Docker
- creating your own `.env` file
- checking the expected variable names

It is not required if your Docker Compose file already provides the needed environment values.

## Local Development

If you want to run the app without Docker:

1. Copy `.env.example` to `.env`
2. Install dependencies with `npm install`
3. Generate Prisma client with `npm run db:generate`
4. Run migrations with `npm run db:deploy`
5. Bootstrap missing baseline roles and statuses with `npm run db:bootstrap`
6. Start the dev server with `npm run dev`

## Notes

- The supported production database is MariaDB through Docker Compose.
- SQLite is not the production deployment path.
- SQL Server external mode is experimental and paused.
- Labels are fully implemented and support preview and print workflows.
- Import/Export supports assets, users, categories, departments, locations, and labels, with labels using JSON as the full-fidelity format.
