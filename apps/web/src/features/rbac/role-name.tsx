import { Field } from "@starterkit/ui/ds";
import { plural } from "@starterkit/ui/lib/format";
import { Input } from "@starterkit/ui/ui/input";
import type { RoleDto } from "@/lib/shared/contracts/rbac";

/** Name input for the create and rename dialogs (2–40 characters, unique; the server checks both). */
export function RoleNameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field id="role-name" label="Name" note="2–40 characters. Each role needs a different name.">
      <Input id="role-name" value={value} maxLength={40} required autoFocus autoComplete="off" onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

/** Throws the message the dialog shows when the name is too short (the dialog form skips native validation). */
export function assertRoleName(name: string): void {
  if (name.trim().length < 2) throw new Error("Enter a name of 2 to 40 characters.");
}

/** Why a role can't be deleted, or null. */
export function deleteBlock(r: RoleDto): string | null {
  if (r.locked) return "The Superadmin role can't be deleted.";
  if (r.userCount > 0) return `${plural(r.userCount, "user has", "users have")} this role. Remove it from them first.`;
  return null;
}
