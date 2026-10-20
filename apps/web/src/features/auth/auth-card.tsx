import type { ReactNode } from "react";
import { Brand, Panel } from "@starterkit/ui/ds";
import { Icon } from "@starterkit/ui/ui/icon";
import { FailedIcon } from "@starterkit/ui/ui/icons";
import { SunnyGoMark, SunnyGoWordmark } from "@/components/brand";

/** The sign-in card (design system §5.4 flat variant): brand, title, one-line description, then the step. */
export function AuthCard({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <Panel variant="flat" className="animate-enter w-full max-w-100" bodyClassName="grid gap-6 p-8">
      <div className="grid gap-5">
        {/* Wordmark 120 px; the card's 32 px padding and the 20 px gap keep the clear space (sun ≈ 16 px). */}
        <Brand mark={<SunnyGoMark className="size-7" />} wordmark={<SunnyGoWordmark className="w-30" />} />
        <div className="grid gap-1">
          <h1 className="text-title-1 text-fg">{title}</h1>
          {description && <p className="text-body-sm text-fg-2">{description}</p>}
        </div>
      </div>
      {children}
    </Panel>
  );
}

/** Form-level error under the fields; announced. */
export function FormError({ id, message }: { id: string; message: string }) {
  return (
    <div id={id} role="alert" className="flex items-start gap-2 rounded-lg border border-down-mark/40 bg-down-soft px-3 py-2.5 text-body-sm text-fg">
      <Icon icon={FailedIcon} className="mt-0.5 size-4 shrink-0 text-down-ink" />
      <p className="min-w-0 break-words">{message}</p>
    </div>
  );
}
