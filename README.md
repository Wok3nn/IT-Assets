# IT-Asset-Tracker

IT-Asset-Tracker is a self-hosted asset management app for teams that need a simple way to track equipment, people, locations, categories, and printable labels from one web interface.

It is designed for small to mid-sized internal environments that want:
- a clean browser-based inventory system
- local admin setup and optional Microsoft Entra sign-in
- printable asset labels with reusable templates
- Docker-friendly deployment with SQLite-backed persistence

## What It Does

The app currently includes:
- first-run setup for the initial workspace and admin account
- asset, user, category, department, and location management
- role and permission controls
- import/export tools for multiple entity types
- label template creation, preview, and print workflows
- theme-aware branding and a Docker-ready deployment path

## Quick Start With Docker Compose

The example below is the documented baseline:

```yaml
services:
  it-assets:
    container_name: IT-Assets
    build:
      context: ../apps/IT-Assets
      dockerfile: docker/Dockerfile
    ports:
      - "4050:4050"
    environment:
      PORT: 4050
      APP_URL: http://localhost:4050
      SESSION_SECRET: SECRET_SESSION_KEY_CHANGE_ME
      DATABASE_URL: file:/data/db/app.db
      APP_DATA_DIR: /data
    volumes:
      - /opt/docker/data/it-assets:/data
    restart: unless-stopped
```

Basic startup flow:

1. Clone the repository.
2. Create a Compose file using the example above.
3. Build and start the container:

```bash
docker compose up -d --build
```

4. Run database migrations:

```bash
docker compose exec it-assets npm run db:deploy
```

5. Seed the baseline roles and statuses:

```bash
docker compose exec it-assets npm run db:seed
```

6. Open `http://localhost:4050` and complete the first-run setup wizard.

## First-Run Setup

On a fresh database, the app opens the First-Run Setup page. This creates the initial workspace and the first local admin account.

After setup is complete:
- `/setup` is no longer the normal landing page
- you sign in through `/login`
- the main dashboard becomes available

## Key Environment Variables

These are the main environment values most deployments need:

- `PORT`: the web server port inside the container. Default is `4050`.
- `APP_URL`: the public base URL used for redirects, logout, and authentication callbacks.
- `SESSION_SECRET`: the secret used to sign session data. Change this before production use.
- `SESSION_COOKIE_SECURE`: optional. `auto` works well for most deployments and turns on secure cookies automatically when `APP_URL` uses `https`.
- `DATABASE_URL`: Prisma database connection string. For Docker, the normal SQLite path is `file:/data/db/app.db`.
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

## Where Data Is Stored

In the Docker flow above, persistent data is stored in the mounted host directory:

```text
/opt/docker/data/it-assets
```

Inside the container, the app uses:
- `/data/db/app.db` for the SQLite database
- `/data/state` for app state files

If you change the mounted volume path, keep `DATABASE_URL` and `APP_DATA_DIR` aligned with that layout.

## Updating The App

For a typical Docker deployment:

1. Pull the latest changes:

```bash
git pull
```

2. Rebuild and restart:

```bash
docker compose up -d --build
```

3. Apply any new migrations:

```bash
docker compose exec it-assets npm run db:deploy
```

If release notes or future changes require a new seed pass, run `npm run db:seed` again.

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
5. Seed baseline data with `npm run db:seed`
6. Start the dev server with `npm run dev`

## Notes

- The app currently uses SQLite by default.
- Labels are fully implemented and support preview and print workflows.
- Import/Export supports assets, users, categories, departments, locations, and labels, with labels using JSON as the full-fidelity format.
