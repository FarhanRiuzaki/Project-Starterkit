import { SQL } from "bun";

/** Creates the database `url` names when it doesn't exist, connecting to the server's `postgres` database. */
export async function createDatabase(url: string): Promise<boolean> {
  const target = new URL(url);
  const name = decodeURIComponent(target.pathname.slice(1));
  target.pathname = "/postgres";
  const server = new SQL(target.href, { max: 1 });
  try {
    const [found] = await server`select 1 from pg_database where datname = ${name}`;
    if (found) return false;
    await server.unsafe(`create database "${name.replaceAll('"', '""')}"`);
    return true;
  } finally {
    await server.close();
  }
}
