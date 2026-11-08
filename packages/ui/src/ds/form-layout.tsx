"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { Panel } from "./panel";
import { FormActions } from "./form-controls";
import { Input } from "../ui/input";

export function Fieldset({ legend, description, children, ...props }: ComponentProps<"fieldset"> & { legend: string; description?: string }) {
  const id = useId();
  return <fieldset {...props} aria-describedby={description ? id : props["aria-describedby"]} className={cn("grid min-w-0 gap-3", props.className)}><legend className="mb-3 text-title-2">{legend}</legend>{description && <p id={id} className="text-body-sm text-fg-2">{description}</p>}{children}</fieldset>;
}
export function FormSection({ title, description, split, children }: { title: string; description?: string; split?: boolean; children: ReactNode }) {
  return <Panel bodyClassName="p-6"><div className={cn("grid gap-6", split && "xl:grid-cols-[1fr_2fr]")}><div className="grid content-start gap-2"><h2 className="text-title-2">{title}</h2>{description && <p className="text-body-sm text-fg-2">{description}</p>}</div><div className="grid min-w-0 gap-6">{children}</div></div></Panel>;
}
export function FormLayout({ title, children, actions, columns = 1, ...props }: ComponentProps<"form"> & { title: string; actions: ReactNode; columns?: 1 | 2 }) {
  return <Panel bodyClassName="p-6"><form {...props} className={cn("grid gap-5", props.className)}><h2 className="text-title-2">{title}</h2><div className={cn("grid gap-6", columns === 2 && "md:grid-cols-2")}>{children}</div><FormActions>{actions}</FormActions></form></Panel>;
}
export { DatePicker } from "./date-picker";
/** Time input preserves typing and the platform time keyboard. */
export function TimeInput(props: Omit<ComponentProps<typeof Input>, "type">) { return <Input {...props} type="time" />; }
