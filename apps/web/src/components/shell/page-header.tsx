import type { ReactNode } from "react";

/**
 * Page header (ui-standard §1): `title-1` title, optional status next to it, actions right (one primary action),
 * one sentence of scope under the title. The top bar already shows the breadcrumb.
 */
export function PageHeader({ title, status, actions, description }: {
  title: string; status?: ReactNode; actions?: ReactNode; description?: string;
}) {
  return (
    <header className="flex flex-wrap items-start gap-x-3 gap-y-3">
      <div className="grid min-w-0 gap-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-title-1 text-fg">{title}</h1>
          {status}
        </div>
        {description && <p className="max-w-[72ch] text-body-sm text-fg-3">{description}</p>}
      </div>
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
