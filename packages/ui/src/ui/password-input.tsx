"use client";

import { type ComponentProps, type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { Button } from "./button";
import { Icon } from "./icon";
import { HideIcon, ShowIcon } from "./icons";
import { Input } from "./input";

/**
 * A password field with a "Show password" toggle (masked by default) and a Caps Lock note while it is on. The field
 * is masked again when its form submits, so the browser offers to save the password. Paste and password managers
 * work as on a plain password input (WCAG 3.3.8).
 */
export function PasswordInput({ className, ref: outer, onKeyDown, onKeyUp, onBlur, ...props }: Omit<ComponentProps<"input">, "type">) {
  const [shown, setShown] = useState(false);
  const [caps, setCaps] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const capsId = useId();
  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const mask = () => { if (ref.current) ref.current.type = "password"; setShown(false); };
    form.addEventListener("submit", mask, true);
    return () => form.removeEventListener("submit", mask, true);
  }, []);
  const readCaps = (e: KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState("CapsLock"));
  const describedBy = [props["aria-describedby"], caps ? capsId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="grid gap-1">
      <div className="relative">
        <Input {...props} ref={(el: HTMLInputElement | null) => { ref.current = el; if (typeof outer === "function") outer(el); else if (outer) outer.current = el; }} type={shown ? "text" : "password"} className={cn("pr-9", className)} aria-describedby={describedBy}
          onKeyDown={(e) => { readCaps(e); onKeyDown?.(e); }} onKeyUp={(e) => { readCaps(e); onKeyUp?.(e); }}
          onBlur={(e) => { setCaps(false); onBlur?.(e); }} />
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Show password" aria-pressed={shown} disabled={props.disabled}
          className="absolute top-1/2 right-0.5 -translate-y-1/2" onClick={() => setShown((s) => !s)}>
          <Icon icon={shown ? HideIcon : ShowIcon} />
        </Button>
      </div>
      {caps && <span id={capsId} className="text-caption text-degraded-ink">Caps Lock is on.</span>}
    </div>
  );
}
