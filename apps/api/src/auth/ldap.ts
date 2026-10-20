import { Client, Filter } from "ldapts";
import { type Config, config } from "../config";
import { log } from "../log";
import { LDAP_PASSWORD } from "../seed/demo";
import { safeEqual } from "./crypto";

/** The directory behind LDAP sign-in: true when `password` is the directory password of `username`. */
export type Directory = { verify(username: string, password: string): Promise<boolean> };

const TIMEOUT_MS = 5000;

/** `template` with every `{username}` replaced by the RFC 4515-escaped username (`\ * ( )` and NUL as `\5c \2a \28 \29 \00`). */
export const userFilter = (template: string, username: string): string => {
  const value = Filter.escape(username);
  return template.replaceAll("{username}", () => value); // a function: `$&` in the value stays literal
};

/** Mock directory: only the demo account `ldap` with LDAP_PASSWORD. */
const mock: Directory = { verify: async (username, password) => safeEqual(password, LDAP_PASSWORD) && username === "ldap" };

/**
 * Search the entry of `username` as LDAP_BIND_DN (StartTLS first when set), then bind as that entry with `password`.
 * Exactly one entry must match. Any error (timeout, no entry, wrong password) is false and one warn line, never the
 * password.
 */
async function verifyLdap(c: Config, username: string, password: string): Promise<boolean> {
  if (!password) return false; // an empty password is an anonymous bind, which many servers accept
  const client = new Client({ url: c.LDAP_URL!, timeout: TIMEOUT_MS, connectTimeout: TIMEOUT_MS });
  try {
    if (c.LDAP_STARTTLS && /^ldap:/i.test(c.LDAP_URL!)) await client.startTLS();
    if (c.LDAP_BIND_DN) await client.bind(c.LDAP_BIND_DN, c.LDAP_BIND_PASSWORD ?? "");
    const { searchEntries } = await client.search(c.LDAP_BASE_DN!, {
      scope: "sub", filter: userFilter(c.LDAP_USER_FILTER, username), attributes: ["dn"], sizeLimit: 2,
    });
    if (searchEntries.length !== 1) throw new Error(`${searchEntries.length} entries match`);
    await client.bind(searchEntries[0]!.dn, password);
    return true;
  } catch (e) {
    log.warn({ err: e instanceof Error ? e : { name: typeof e }, username }, "ldap sign-in failed");
    return false;
  } finally {
    await client.unbind().catch(() => {});
  }
}

/** LDAP_MOCK → the mock directory; LDAP_URL → the real one; neither → null (LDAP sign-in fails). */
export function directory(c: Config = config()): Directory | null {
  if (c.LDAP_MOCK) return mock;
  if (c.LDAP_URL) return { verify: (username, password) => verifyLdap(c, username, password) };
  return null;
}
