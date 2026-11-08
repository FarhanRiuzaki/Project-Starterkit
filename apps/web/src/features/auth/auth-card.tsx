import { Icon } from "@starterkit/ui/ui/icon";
import { FailedIcon } from "@starterkit/ui/ui/icons";

export { AuthCard } from "@starterkit/ui/ds/auth-card";

/** Form-level error under the fields; announced. */
export function FormError({ id, message }: { id: string; message: string }) {
  return (
    <div id={id} role="alert" className="flex items-start gap-2 rounded-lg border border-down-mark/40 bg-down-soft px-3 py-2.5 text-body-sm text-fg">
      <Icon icon={FailedIcon} className="mt-0.5 size-4 shrink-0 text-down-ink" />
      <p className="min-w-0 break-words">{message}</p>
    </div>
  );
}
