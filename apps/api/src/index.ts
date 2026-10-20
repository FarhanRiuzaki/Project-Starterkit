import { createApp } from "./app";
import { config } from "./config";
import { sql } from "./db/client";
import { log } from "./log";

const { API_HOST, API_PORT } = config();
const server = Bun.serve({ hostname: API_HOST, port: API_PORT, fetch: createApp().fetch });
log.info({ url: server.url.href }, "api listening");

let stopping = false;
/** Stop accepting, let in-flight requests finish (at most 10 s), close the pool, exit 0. */
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  log.info({ signal }, "shutting down");
  await Promise.race([server.stop(), Bun.sleep(10_000).then(() => server.stop(true))]);
  await sql.close();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
