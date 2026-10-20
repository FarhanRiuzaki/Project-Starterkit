# The API image. Build from the repo root: `docker build -f apps/api/Dockerfile -t starterkit-api .`
# Serves on API_PORT (4000): `bun src/index.ts`. One-shot migration (schema owner in MIGRATION_DATABASE_URL):
# `docker run --rm -e MIGRATION_DATABASE_URL=… starterkit-api bun run db:migrate`; `bun run db:seed` the same way.
FROM oven/bun:1.4.3 AS deps
WORKDIR /app
# Every workspace manifest, so the frozen lockfile matches; only the API's production dependencies are installed.
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
# ponytail: about 289 MB of node_modules (measured on a hand-built copy of this stage), mostly @starterkit/ui's runtime
# dependencies (icons, radix, recharts, react) that come with the workspace although the API imports only ui/lib/*.
# Upgrade path: `bun build src/index.ts --target bun` into one file plus drizzle/ in the image; db/migrate.ts then needs
# an env override for its DIR (it resolves drizzle/ from import.meta.dir, which a bundle moves).
RUN bun install --frozen-lockfile --production --filter @starterkit/api

FROM oven/bun:1.4.3
WORKDIR /app
ENV NODE_ENV=production API_HOST=0.0.0.0 API_PORT=4000
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/packages packages
COPY --from=deps /app/apps/api/node_modules apps/api/node_modules
# The workspace sources the API imports: @starterkit/shared and @starterkit/ui/lib/*.
COPY packages/shared/src packages/shared/src
COPY packages/ui/src/lib packages/ui/src/lib
COPY apps/api/package.json apps/api/
COPY apps/api/drizzle apps/api/drizzle
COPY apps/api/src apps/api/src
WORKDIR /app/apps/api
USER bun
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD ["bun", "-e", "fetch(`http://127.0.0.1:${process.env.API_PORT}/healthz`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["bun", "src/index.ts"]
