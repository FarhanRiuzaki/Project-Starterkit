import type { ActivityDto, AuthLogDto } from "../../shared/contracts/audit";
import type { AuthMethod } from "../../shared/contracts/auth";
import type { RoleDto } from "../../shared/contracts/rbac";
import type { MeDto } from "../../shared/contracts/me";
import { UserDto } from "../../shared/contracts/users";
import { seed } from "./seed";

/** `totpLastStep`: the TOTP time step that last completed a sign-in; that code and older ones are refused (no replay). */
export type UserRecord = UserDto & { passwordHash: string | null; totpSecret: string | null; recoveryCodes: string[]; totpLastStep?: number;
  /** Secret from `POST /api/me/2fa`, not active until `PUT` confirms a code; never part of the DTO. */
  pendingTotpSecret?: string;
};
/** The only safe way to return a user from a route: the schema parse drops passwordHash, totpSecret, recoveryCodes. */
export function toUserDto(record: UserRecord): UserDto {
  return UserDto.parse(record);
}

/** The signed-in user's own view (GET /api/me): the DTO plus whether a password is set. */
export const toMeDto = (record: UserRecord): MeDto => ({ ...toUserDto(record), hasPassword: record.passwordHash !== null });

export type RoleRecord = Omit<RoleDto, "userCount">;
/** `expiresAt` = createdAt + SESSION_TTL_HOURS (absolute); idle = no request for SESSION_IDLE_MINUTES since `lastSeenAt` (lib/server/session.ts). */
export type SessionRecord = { id: string; userId: string; method: AuthMethod; device: string; ip: string; createdAt: string; lastSeenAt: string; expiresAt: string };
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
  /** Permission names in catalog order: PERMISSIONS, then names added through POST /api/permissions. */
  permissionCatalog: Set<string>;
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
