import type { ReactNode } from "react";
import { Panel } from "./panel";
import { Avatar } from "./avatar";
export function UserCard({ name, email, badges, detail, activity, actions }: { name: string; email: string; badges?: ReactNode; detail?: ReactNode; activity?: ReactNode; actions?: ReactNode }) {
  return <Panel bodyClassName="grid gap-3"><div className="flex items-start gap-3"><Avatar name={name} /><div className="grid min-w-0 gap-0.5"><h3 className="truncate text-body font-medium">{name}</h3><p className="truncate text-body-sm text-fg-3">{email}</p></div></div><div className="flex flex-wrap items-center gap-6">{badges}<span className="text-body-sm text-fg-2">{detail}</span></div><div className="flex items-center justify-between gap-4"><span className="text-caption text-fg-3">{activity}</span>{actions}</div></Panel>;
}
