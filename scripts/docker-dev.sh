#!/bin/sh
# Entry point of the `app` service in docker-compose.dev.yml: the dev stack (web + API, hot reload) in one container.
# Secrets are generated once into the `state` volume, so sessions and encrypted TOTP secrets survive restarts.
# Then install (fast when the node_modules volumes are warm), migrate, system seed, demo seed (skipped once present)
# and `bun run dev`. Prints file names and steps only, never a value.
set -e
STATE=/state/dev.env
if [ ! -f "$STATE" ]; then
  bun -e '
    const { randomBytes } = require("node:crypto");
    const hex = () => randomBytes(32).toString("hex");
    console.log(`INTERNAL_API_TOKEN=${hex()}\nSESSION_SECRET=${hex()}\nDATA_ENCRYPTION_KEY=${randomBytes(32).toString("base64")}`);
  ' > "$STATE"
  echo "dev secrets written to the state volume"
fi
set -a
. "$STATE"
set +a

bun install --frozen-lockfile
bun run db:migrate
bun run db:seed
bun run db:seed:demo
exec bun run dev
