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
3. Create the host data directory:

```bash
mkdir -p /opt/docker/data/it-assets
```

4. Build and start the container:

```bash
docker compose up -d --build
```

5. Open `http://localhost:4050` and complete the first-run setup wizard.

On container startup, the app now automatically:
- creates its internal `/data/db`, `/data/state`, and `/data/uploads` folders if they do not exist
- initializes the SQLite database schema automatically on first startup
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
- `/data/db/app.db` for the SQLite database
- `/data/state` for app state files

***Future Updates inlcude external DB options***

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

- The app currently uses SQLite by default.
- Labels are fully implemented and support preview and print workflows.
- Import/Export supports assets, users, categories, departments, locations, and labels, with labels using JSON as the full-fidelity format.
