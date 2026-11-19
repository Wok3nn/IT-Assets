FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:managed

FROM node:24-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next-managed ./.next-managed
COPY --from=build /app/public ./public
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json /app/tsconfig.json /app/next.config.ts /app/prisma.managed.config.ts ./
# COPY preserves checkout modes. Keep code root-owned and non-writable by node,
# while preserving executable dependencies (Prisma/esbuild) and traversable dirs.
RUN chown -R root:root /app && chmod -R a=rX,u+w /app \
    && mkdir -p /data/control \
    && chown -R node:node /data/control /app/.next-managed \
    && chmod 700 /data/control
ENV NODE_ENV=production IT_ASSETS_CONTROL_DIR=/data/control IT_ASSETS_BIND=0.0.0.0
USER node
RUN node scripts/check-managed-image-permissions.mjs
EXPOSE 4050
CMD ["node","--import","tsx","scripts/managed-start.mjs"]
