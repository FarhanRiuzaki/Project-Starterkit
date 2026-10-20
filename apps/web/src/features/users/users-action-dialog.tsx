"use client";

import { ConfirmActionDialog, Field } from "@starterkit/ui/ds";
import { Select } from "@starterkit/ui/ui/select";
import type { UserRowDto } from "@starterkit/shared/contracts/users";
import { RoleSearch } from "./role-search";

export type BulkAction = "activate" | "deactivate" | "delete" | "assignRole";
export type Pending = { kind: "bulk"; action: BulkAction; ids: string[] } | { kind: "one"; action: "delete"; user: UserRowDto };

const VERB: Record<BulkAction, string> = { activate: "Activate", deactivate: "Deactivate", delete: "Delete", assignRole: "Assign role to" };
const BULK_NOTE: Record<BulkAction, string> = {
  activate: "Users who are already active stay as they are. Users with permissions your role doesn't hold are skipped.",
  deactivate: "Your own account, the last active Superadmin and users with permissions your role doesn't hold are skipped.",
  delete: "Your own account, the last active Superadmin and users with permissions your role doesn't hold are skipped.",
  assignRole: "Your own account and users with permissions your role doesn't hold are skipped, and so is everyone when your role doesn't hold every permission of the chosen role.",
};
const LABEL: Record<BulkAction, string> = { activate: "Activate users", deactivate: "Deactivate users", delete: "Delete users", assignRole: "Assign role" };

/**
 * The users list's confirm dialog (one user or a bulk action; Assign role picks the role here). Its own chunk, loaded by
 * users-page.tsx on intent, outside the route's first load (AGENTS.md §9).
 */
export function UsersActionDialog({ pending, role, onRole, roles, onClose, onConfirm }: {
  pending: Pending; role: string; onRole: (role: string) => void; roles: { names: string[]; more: boolean };
  onClose: () => void; onConfirm: () => Promise<void>;
}) {
  const dialog = pending.kind === "bulk"
    ? { title: `${VERB[pending.action]} ${pending.ids.length} ${pending.ids.length === 1 ? "user" : "users"}`, description: BULK_NOTE[pending.action], label: LABEL[pending.action] }
    : { title: `Delete ${pending.user.name}`, description: pending.user.email, label: "Delete user" };
  const impact = pending.action === "delete" ? ["The account is removed and its sessions end.", "This can't be undone."]
    : pending.action === "deactivate" ? ["They are signed out and can't sign in until reactivated."]
    : pending.action === "assignRole" ? ["The role is added to each user's current roles."] : ["They can sign in again."];
  return (
    <ConfirmActionDialog open onOpenChange={(o) => { if (!o) onClose(); }} auditFields={false} reasons={[]} destructive={pending.action === "delete"}
      title={dialog.title} description={dialog.description} impact={impact} actionLabel={dialog.label} onConfirm={onConfirm}
      extra={pending.action === "assignRole" && (
        <Field id="bulk-role" label="Role">
          {roles.more
            ? <RoleSearch id="bulk-role" label="Role" value={role} onChange={onRole} />
            : <Select id="bulk-role" value={role} onChange={(e) => onRole(e.target.value)} disabled={roles.names.length === 0}>
              {roles.names.length === 0
                ? <option value="">No roles yet. Create one on the Roles page.</option>
                : roles.names.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>}
        </Field>
      )} />
  );
}
