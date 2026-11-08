import type { ReactNode } from "react";
import { Panel } from "./panel";
import { StepMarker } from "./step-indicator";
import { Icon, type IconData } from "../ui/icon";
import { CheckIcon } from "../ui/icons";
import { formatNumber } from "../lib/format";
import { cn } from "../lib/cn";

/** Product actions are slots: the feature owns permissions, confirmation and async results. */
export function WizardReview({ title, rows, note }: { title: string; rows: readonly { id: string; label: string; value: ReactNode; action?: ReactNode }[]; note?: string }) {
  return <Panel bodyClassName="grid gap-5 p-6"><h2 className="text-title-2">{title}</h2><dl className="grid gap-5">{rows.map((r) => <div key={r.id} className="grid grid-cols-[1fr_auto] items-start gap-3 md:grid-cols-[1fr_2fr_auto]"><dt className="text-label text-fg-2">{r.label}</dt><dd className="min-w-0 break-words text-body max-md:col-start-1 max-md:row-start-2">{r.value}</dd>{r.action && <dd className="max-md:col-start-2 max-md:row-span-2 max-md:row-start-1">{r.action}</dd>}</div>)}</dl>{note && <p className="text-caption text-fg-3">{note}</p>}</Panel>;
}
export function WizardCompletion({ title, description, action }: { title: string; description: string; action: ReactNode }) {
  return <Panel bodyClassName="grid justify-items-start gap-5 p-8"><Icon icon={CheckIcon} className="size-6 text-primary" /><h2 className="text-title-1">{title}</h2><p role="status" className="text-body text-fg-2">{description}</p>{action}</Panel>;
}
export function NotificationItem({ title, message, time, state, action }: { title: string; message: string; time: ReactNode; state: "Unread" | "Read" | "Action required"; action?: ReactNode }) {
  return <Panel bodyClassName={cn("grid justify-items-start gap-3", state === "Unread" && "bg-primary-soft")}><div className="flex w-full flex-wrap justify-between gap-3 text-caption text-fg-3"><span>{state}</span>{time}</div><h3 className="text-label">{title}</h3><p className="text-body-sm text-fg-2">{message}</p>{action}</Panel>;
}
export function ActivityItem({ title, description, time, icon }: { title: string; description: ReactNode; time: ReactNode; icon: IconData }) {
  return <div className="flex gap-4 p-4"><Icon icon={icon} className="size-6 shrink-0 text-fg-3" /><div className="grid min-w-0 gap-2"><h3 className="text-label">{title}</h3><div className="text-body-sm text-fg-2">{description}</div><div className="text-caption text-fg-3">{time}</div></div></div>;
}
export function OnboardingChecklist({ title, tasks }: { title: string; tasks: readonly { id: string; label: string; done: boolean; action?: ReactNode }[] }) {
  return <Panel bodyClassName="grid gap-5 p-6"><h2 className="text-title-2">{title}</h2><p className="text-body-sm text-fg-2">{formatNumber(tasks.filter((t) => t.done).length)} of {formatNumber(tasks.length)} tasks completed</p><ol className="grid gap-4">{tasks.map((t, i) => <li key={t.id} className="flex items-center gap-4"><StepMarker n={i + 1} status={t.done ? "done" : "todo"} /><span className="min-w-0 flex-1 text-body">{t.label}<span className="sr-only">{t.done ? ", complete" : ", incomplete"}</span></span>{!t.done && t.action}</li>)}</ol></Panel>;
}
export function PlanCard({ title, price, terms, features, badge, action }: { title: string; price: string; terms: string; features: readonly string[]; badge?: string; action: ReactNode }) {
  return <Panel bodyClassName="grid justify-items-start gap-5 p-6"><p className="eyebrow text-fg-3">{badge ?? "Plan"}</p><h2 className="text-title-2">{title}</h2><p className="text-title-1">{price}</p><p className="text-caption text-fg-3">{terms}</p><ul className="grid gap-4">{features.map((f) => <li key={f} className="flex gap-2 text-body-sm text-fg-2"><Icon icon={CheckIcon} className="size-4 shrink-0" />{f}</li>)}</ul>{action}</Panel>;
}
export function IntegrationCard({ title, description, status, icon, action }: { title: string; description: string; status: string; icon: IconData; action: ReactNode }) {
  return <Panel bodyClassName="grid justify-items-start gap-4 p-6"><Icon icon={icon} className="size-6" /><h2 className="text-title-2">{title}</h2><p className="text-body-sm text-fg-2">{description}</p><p className="text-caption text-fg-3">{status}</p>{action}</Panel>;
}
/** Only pass a masked identifier here. Newly created secrets belong in SecretOnceDialog. */
export function ApiKeyRow({ name, maskedIdentifier, status, actions }: { name: string; maskedIdentifier: string; status: string; actions: ReactNode }) {
  return <Panel bodyClassName="grid gap-3"><h3 className="text-label">{name}</h3><code className="break-all font-mono text-mono text-fg-2">{maskedIdentifier}</code><p className="text-caption text-fg-3">{status}</p><div className="flex flex-wrap gap-3">{actions}</div></Panel>;
}
export function BillingSummary({ title, rows, action, note }: { title: string; rows: readonly { label: string; value: ReactNode }[]; action: ReactNode; note?: string }) {
  return <Panel bodyClassName="grid justify-items-start gap-5 p-6"><h2 className="text-title-2">{title}</h2><dl className="grid w-full gap-5">{rows.map((r) => <div key={r.label} className="grid gap-2 md:grid-cols-2"><dt className="text-body-sm text-fg-3">{r.label}</dt><dd className="min-w-0 text-body">{r.value}</dd></div>)}</dl>{action}{note && <p className="text-caption text-fg-3">{note}</p>}</Panel>;
}
