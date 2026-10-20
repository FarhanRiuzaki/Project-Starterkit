import { createApp } from "./app";
import { startJanitor } from "./db/janitor";
import { config } from "./kernel/config";
import { client } from "./kernel/db";
import { unexpected } from "./kernel/errors";
import { log } from "./kernel/log";

const { API_HOST, API_PORT } = config();
const app = createApp();
// `error`: the last resort for anything the app's own handlers let through (Bun's default page would show it).
const server = Bun.serve({ hostname: API_HOST, port: API_PORT, fetch: (r) => app.handle(r), error: (e) => unexpected(e) });
log.info({ url: server.url.href }, "api listening");
const stopJanitor = startJanitor();

let stopping = false;
/** Stop the janitor and accepting; let its run and the requests in flight (max 10 s) end; close the pool; exit 0. */
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  log.info({ signal }, "shutting down");
  // The janitor's run in flight and the requests in flight both end before the pool closes.
  await Promise.all([stopJanitor(), Promise.race([server.stop(), Bun.sleep(10_000).then(() => server.stop(true))])]);
  await client.close();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
