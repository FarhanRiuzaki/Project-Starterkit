# The web image. Build from the repo root: `docker build -f apps/web/Dockerfile -t starterkit-web .`
# Installs and builds with Bun on Node 24, then runs Next's standalone server (next.config.ts `output: "standalone"`)
# on node:24-slim, port 3000. Runtime env: API_BASE_URL, INTERNAL_API_TOKEN, SESSION_SECRET (apps/web/.env.example).
FROM node:24-slim AS build
COPY --from=oven/bun:1.4.3 /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json bun.lock tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
RUN bun install --frozen-lockfile --filter @starterkit/web
COPY packages packages
COPY apps/web apps/web
RUN bun run --filter @starterkit/web build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static apps/web/.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/login').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "apps/web/server.js"]
