# IT-Asset-Tracker

Modern self-hosted asset management with a cleaner dashboard experience, scope-aware permissions, and first-class label templates.

## Planned MVP

- First-run setup wizard
- Local admin authentication
- Dashboard shell
- Asset, category, scope, user, and location modules
- Role and scope permissions
- Branding and settings
- Label template management and browser printing
- Docker deployment with SQLite persistence under `/data`

## Stack

- Next.js
- TypeScript
- TailwindCSS
- shadcn/ui-style component architecture
- Framer Motion
- Prisma ORM
- SQLite for MVP

## Local Development

1. Copy `.env.example` to `.env`
2. Install dependencies with `npm install`
3. Generate Prisma client with `npm run db:generate`
4. Run migrations with `npx prisma migrate dev --name init`
5. Seed system roles and statuses with `npm run db:seed`
6. Start the app with `npm run dev`

## Docker

Use `docker/docker-compose.example.yml` as the starting point for local deployment.

The app listens on `4050` and stores persistent runtime data in `/data`.

## Notes

This repository is currently scaffolded for the first build pass. Business logic, auth flow, and CRUD screens are still placeholder implementations.
