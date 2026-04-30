# IT Asset Tracker

## Overview

IT Asset Tracker is a self-hosted web app for managing IT equipment, assigned users, departments, locations, categories, and printable asset labels. It is designed for small and mid-sized internal teams that want a practical inventory system they can run with Docker.

The recommended production deployment is Docker Compose with the app container and a MariaDB container. No external database is required for the default setup.

## Features

- Asset management with assignment, status, category, department, and location tracking
- Category and location hierarchy management
- Department and user management
- Role-based access foundations
- CSV import and export workflows
- Label templates with QR code and barcode support
- Printable labels for assets
- Theme-aware branding settings
- Local authentication with optional Microsoft Entra sign-in configuration
- Docker-first deployment with MariaDB persistence

## Quick Start (Docker - Recommended)

### Folder Structure

The production compose example is written for this host layout:

```text
/opt/docker/
+-- apps/
|   +-- it-assets-tracker/
+-- compose/
|   +-- IT-Assets-Tracker.yml
+-- data/
    +-- it-assets-tracker/
        +-- app/
        +-- mariadb/
```

### Step 1: Clone Repo

```bash
mkdir -p /opt/docker/apps
cd /opt/docker/apps
git clone <repo-url> It-Assets-Tracker
cd It-Assets-Tracker
```

### Step 2: Copy Compose File

The production compose example lives at:

```text
docker/docker-compose.example.yml
```

Copy it to your compose directory:

```bash
mkdir -p /opt/docker/compose
cp /opt/docker/apps/It-Assets-Tracker/docker/docker-compose.example.yml /opt/docker/compose/IT-Assets-Tracker.yml
```

### Step 3: Review/Edit Compose File

Before production use, open `/opt/docker/compose/IT-Assets-Tracker.yml` and review:

- `APP_URL`: defaults to `http://localhost:4050`; change it to your real external URL when using a domain or reverse proxy.
- `SESSION_SECRET`: replace `change-me` with a long random value.
- `MARIADB_PASSWORD` and `MARIADB_ROOT_PASSWORD`: replace the placeholders before production use.
- Data paths: defaults are under `/opt/docker/data/it-assets-tracker`.

`APP_URL` should not include a trailing slash.

### Step 4: Start Containers

```bash
mkdir -p /opt/docker/data/it-assets-tracker/app
mkdir -p /opt/docker/data/it-assets-tracker/mariadb

docker compose -f /opt/docker/compose/IT-Assets-Tracker.yml up -d --build
```

### Step 5: Access App

Open:

```text
http://localhost:4050
```

On first launch, complete the setup wizard to create the workspace and first administrator account.

## Docker Compose Example

This is the full recommended production compose file:

```yaml
services:
  # MariaDB is the default and supported production database.
  mariadb:
    container_name: IT-Assets-MariaDB
    image: mariadb:11.4
    environment:
      # Change these before production use.
      MARIADB_DATABASE: it_assets
      MARIADB_USER: it_assets
      MARIADB_PASSWORD: change-me
      MARIADB_ROOT_PASSWORD: change-me-root
    volumes:
      # Bind mount for straightforward host backups.
      - /opt/docker/data/it-assets-tracker/mariadb:/var/lib/mysql
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "mariadb-admin ping -h 127.0.0.1 -uroot -p$$MARIADB_ROOT_PASSWORD --silent"]
      interval: 5s
      timeout: 5s
      retries: 20

  # Main IT Asset Tracker application.
  it-assets:
    container_name: IT-Assets-Tracker
    build:
      # This absolute path lets the compose file live in /opt/docker/compose.
      context: /opt/docker/apps/It-Assets-Tracker
      dockerfile: docker/Dockerfile
      args:
        DB_MODE: local
        DB_PROVIDER: mariadb
    depends_on:
      mariadb:
        condition: service_healthy
    ports:
      # Production default. Use another host port, such as 4051, for test stacks.
      - "${IT_ASSETS_HOST_PORT:-4050}:4050"
    environment:
      PORT: 4050
      # Use the externally reachable app URL here. Do not include a trailing slash.
      APP_URL: ${APP_URL:-http://localhost:4050}
      SESSION_SECRET: change-me
      SESSION_COOKIE_SECURE: auto
      DB_MODE: local
      DB_PROVIDER: mariadb
      DATABASE_URL: mysql://it_assets:change-me@mariadb:3306/it_assets
      APP_DATA_DIR: /data
    volumes:
      # App runtime state and uploads.
      - /opt/docker/data/it-assets-tracker/app:/data
    restart: unless-stopped
```

### Services

- `it-assets`: the Next.js application container.
- `mariadb`: the MariaDB database container used by the default deployment.

### Key Configs

- `ports`: exposes the app on host port `4050` by default.
- `APP_URL`: the public URL users type into their browser.
- `DATABASE_URL`: points the app container to the MariaDB service over the Docker network.
- `volumes`: persist app state/uploads and MariaDB data under `/opt/docker/data/it-assets-tracker`.

### Database Notes

- MariaDB in Docker is the default production database.
- No external database is required.
- SQLite is not used for production deployments.
- SQL Server support is currently paused and experimental.

## Production vs Test Deployments

The production compose file exposes host port `4050`.

Do not run two IT Asset Tracker stacks on the same host port. For test deployments, use another port such as `4051`.

A test compose file is provided at:

```text
docker/docker-compose.test.yml
```

Example:

```bash
cp /opt/docker/apps/It-Assets-Tracker/docker/docker-compose.test.yml /opt/docker/compose/IT-Assets-Tracker-Test.yml
docker compose -f /opt/docker/compose/IT-Assets-Tracker-Test.yml up -d --build
```

The test compose file uses:

- `IT-Assets-Tracker-Test`
- `IT-Assets-MariaDB-Test`
- host port `4051`
- data path `/opt/docker/data/it-assets-tracker-test`

## APP_URL And Access

`APP_URL` must match the URL users use to reach the app.

Examples:

```text
http://localhost:4050
http://your-server-ip:4050
https://it-assets.example.com
```

Rules:

- Do not include a trailing slash.
- For direct IP access, use `http://your-server-ip:4050`.
- For domain access, use the external domain, such as `https://it-assets.example.com`.
- Do not use internal Docker service names for `APP_URL`.

## Reverse Proxy Notes

Direct access works with:

```yaml
ports:
  - "4050:4050"
```

For reverse-proxy-only access, bind the app to localhost on the Docker host:

```yaml
ports:
  - "127.0.0.1:4050:4050"
```

For Nginx Proxy Manager, configure the proxy host as:

```text
Scheme: http
Forward Hostname / IP: Docker host IP, or 127.0.0.1 if Nginx Proxy Manager runs on the same host
Forward Port: 4050
```

Then set:

```text
APP_URL=https://it-assets.example.com
```

## Data Storage

Default host paths:

```text
/opt/docker/data/it-assets-tracker/app
/opt/docker/data/it-assets-tracker/mariadb
```

Inside the app container:

```text
/data
```

Inside the MariaDB container:

```text
/var/lib/mysql
```

Back up both host directories for a complete deployment backup.

## Updating

```bash
cd /opt/docker/apps/It-Assets-Tracker
git pull
docker compose -f /opt/docker/compose/IT-Assets-Tracker.yml up -d --build
```

The app runs provider-aware Prisma generation, MariaDB migrations, and baseline bootstrap automatically during container startup.

## Local Development

For local development outside Docker:

```bash
npm install
npm run db:generate
npm run dev
```

Use `.env.example` as a starting point for local environment variables. Local development may use different database settings, but production documentation assumes Docker Compose with MariaDB.

## Security Notes

- Change `SESSION_SECRET` before production use.
- Change MariaDB passwords before production use.
- Keep `/opt/docker/data/it-assets-tracker` backed up and access-controlled.
- Do not commit real `.env` files, database files, secrets, tokens, or exported production data.

## Status

MariaDB container-based deployment is the supported production path. SQL Server integration is paused/experimental, and SQLite is not the production deployment path.
