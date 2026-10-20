import type { ReactNode } from "react";
import { cn } from "../lib/cn";

/**
 * One group of a long form (Polaris annotated layout, Carbon form sections): from 768 px the title and what the group
 * is for sit in a column on the left (a third) and the fields on the right, capped at a readable width (`max-w-xl`),
 * so a wide card holds the explanation instead of empty space; on a phone the title stacks above the fields. Sections
 * are divided by a hairline. Use it when a form has two groups or more; a short form (a dialog, sign-in) is one column.
 */
export function FormSection({ title, description, children, className }: { title: string; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("grid gap-4 border-t border-line py-6 first-of-type:border-t-0 first-of-type:pt-0 md:grid-cols-3 md:gap-8", className)}>
      <div className="grid content-start gap-1">
        <h3 className="text-title-3 text-fg">{title}</h3>
        {description && <p className="text-body-sm text-fg-3">{description}</p>}
      </div>
      <div className="grid min-w-0 max-w-xl content-start gap-4 md:col-span-2">{children}</div>
    </section>
  );
}

/**
 * The form's buttons, last in the card: the primary action first, then Cancel (ui-standard §5). Sticky to the bottom of
 * the window while the form is taller than it, so Save stays in reach on a long form; it takes the card's padding back
 * (`-mx-4 -mb-4`) so its hairline runs edge to edge. Pass `sticky={false}` in a dialog or a short form.
 */
export function FormActions({ children, sticky = true, className }: { children: ReactNode; sticky?: boolean; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3",
      sticky && "sticky bottom-0 z-10 -mx-4 -mb-4 rounded-b-lg border-t border-line bg-card px-4 py-3 pb-[max(--spacing(3),env(safe-area-inset-bottom))]", className)}>
      {children}
    </div>
  );
}
