/** Presentation hint only: never discovers an account or decides its authentication provider. */
export function loginIdentifierBadge(value: string): "Email" | "Username" | "LDAP" | null {
  const identifier = value.trim();
  if (!identifier) return null;
  if (identifier.includes("@")) return "Email";
  if (/^\d+$/.test(identifier)) return "LDAP";
  return "Username";
}
