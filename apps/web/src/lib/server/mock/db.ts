import type { ActivityDto, AuthLogDto } from "../../shared/contracts/audit";
import type { AuthMethod } from "../../shared/contracts/auth";
import type { RoleDto } from "../../shared/contracts/rbac";
import { UserDto } from "../../shared/contracts/users";
import { seed } from "./seed";

export type UserRecord = UserDto & { passwordHash: string | null; totpSecret: string | null; recoveryCodes: string[] };
/** The only safe way to return a user from a route: the schema parse drops passwordHash, totpSecret, recoveryCodes. */
export function toUserDto(record: UserRecord): UserDto {
  return UserDto.parse(record);
}

export type RoleRecord = Omit<RoleDto, "userCount">;
export type SessionRecord = { id: string; userId: string; method: AuthMethod; device: string; ip: string; createdAt: string; lastSeenAt: string };
export type ResetTokenRecord = { userId: string; expiresAt: number };

export type Db = {
  users: Map<string, UserRecord>;
  roles: Map<string, RoleRecord>;
  sessions: Map<string, SessionRecord>;
  activity: Map<string, ActivityDto>;
  authLog: Map<string, AuthLogDto>;
  /** token hash -> record */
  resetTokens: Map<string, ResetTokenRecord>;
  /** user id -> directory password (LDAP users have no passwordHash) */
  ldapDirectory: Map<string, string>;
};

/** Read-only view `rules.ts` needs. */
export type DbView = Pick<Db, "users" | "roles">;

const KEY = Symbol.for("starterkit.mockdb");
type G = typeof globalThis & { [KEY]?: Db };

export function db(): Db {
  const g = globalThis as G;
  return (g[KEY] ??= seed());
}

export function resetDb(now?: number): Db {
  return ((globalThis as G)[KEY] = seed(now));
}
