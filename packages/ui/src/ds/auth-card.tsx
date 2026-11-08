import type { ReactNode } from "react";
import { Panel } from "./panel";
/** Reusable presentation; authentication and provider wiring stay in the feature. */
export function AuthCard({ title, description, children, headingLevel = 1 }: { title: string; description?: ReactNode; children: ReactNode; headingLevel?: 1 | 2 }) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return <Panel className="animate-enter w-full max-w-100" bodyClassName="grid gap-6 p-6 md:p-8"><div className="grid gap-1"><Heading className="text-title-1 text-fg">{title}</Heading>{description && <p className="text-body-sm text-fg-2">{description}</p>}</div>{children}</Panel>;
}
