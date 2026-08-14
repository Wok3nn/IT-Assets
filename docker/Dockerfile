# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS deps
ARG DB_MODE=local
ARG DB_PROVIDER=mariadb
WORKDIR /app
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    if [ -f package-lock.json ]; then npm ci; else npm install; fi

FROM node:20-alpine AS builder
ARG DB_MODE=local
ARG DB_PROVIDER=mariadb
WORKDIR /app
ENV DB_MODE=${DB_MODE}
ENV DB_PROVIDER=${DB_PROVIDER}
ENV DATABASE_URL=mysql://it_assets:change-me@mariadb:3306/it_assets
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
ARG DB_MODE=local
ARG DB_PROVIDER=mariadb
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4050
ENV DB_MODE=${DB_MODE}
ENV DB_PROVIDER=${DB_PROVIDER}
ENV DATABASE_URL=mysql://it_assets:change-me@mariadb:3306/it_assets
LABEL org.opencontainers.image.title="IT-Asset-Tracker"
LABEL org.opencontainers.image.description="A modern self-hosted asset management platform."
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma/providers ./prisma/providers
COPY --from=builder /app/prisma/data ./prisma/data
COPY --from=builder /app/prisma/migrations ./prisma/migrations
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
RUN mkdir -p /data/db /data/state /data/uploads
EXPOSE 4050
CMD ["node", "scripts/docker-start.mjs"]
