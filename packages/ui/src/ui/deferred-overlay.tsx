"use client";

import {
  type ComponentProps, type ComponentType, createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import { Slot } from "radix-ui";
import { createLoader, whenIdle } from "../motion/gate";
import { type Intent, type OpenHow, type OverlayKind, opensOnKey, opensOnPointer, takeIntent } from "./deferred-intent";

type RootProps = { children?: ReactNode; defaultOpen?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void; modal?: boolean };
type TriggerProps = ComponentProps<"button"> & { asChild?: boolean };
/** What an overlay implementation module exports: its Radix-backed root and trigger (plus parts the facade forwards). */
export type OverlayImpl = { Root: ComponentType<RootProps>; Trigger: ComponentType<TriggerProps> };

type ElRef = (el: HTMLElement | null) => void;
type Ctx<M> = { impl: M | null; twin: ElRef; real: ElRef; open: (how: OpenHow) => void; preload: () => void; takeKeyOpen: () => boolean };

/**
 * A Radix overlay (menu, popover) whose implementation is a separate chunk, out of every route's first-load JS.
 *
 * Until the chunk arrives — imported once the main thread is idle after hydration, or at once on hover, focus or
 * press — the trigger renders as a stand-in with the closed Radix trigger's markup (`type`, `aria-haspopup`,
 * `aria-expanded="false"`, `data-state="closed"`, the wrapper's `data-slot`; deferred-overlay.test.ts compares them; only
 * the menu trigger's generated `id` is absent, which nothing refers to while closed), and the content renders
 * nothing, as a closed Radix overlay does. A press on the stand-in opens the overlay as soon as it has loaded, with
 * the same rules as the Radix trigger (deferred-intent.ts), once, and only while the press is recent (a failed load
 * drops it); a key press opens with focus on the first item, as with Radix. Then the root renders the Radix root around the same
 * children; the trigger node is replaced once, and when the stand-in had focus the new trigger takes it over, so
 * keyboard users stay where they were. A blocked chunk leaves the stand-in in place and retries on the next press.
 * Later mounts (client navigation) render the Radix overlay directly.
 */
export function deferredOverlay<M extends OverlayImpl>(kind: OverlayKind, slot: string, load: () => Promise<M>) {
  const loader = createLoader(load);
  const C = createContext<Ctx<M> | null>(null);

  function Root({ children, defaultOpen, ...props }: RootProps) {
    // Hydration: on a hard load the chunk is never loaded before the shell hydrates (it loads after idle), so this is
    // null on the server and in the hydrating render alike. A root mounted later (client navigation) starts on Radix.
    const [state, setState] = useState<{ impl: M | null; openWith: OpenHow | null }>(() => ({ impl: loader.get(), openWith: null }));
    const intent = useRef<Intent | null>(null);
    const keyOpen = useRef(false);
    const twinEl = useRef<HTMLElement | null>(null);
    const refocus = useRef(false);
    const live = useRef(true);
    const switched = useRef(state.impl != null);
    useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
    const fetchImpl = useCallback(() => {
      void loader.load().then((m) => {
        // Hover, focus, idle and the press share one load: only its first callback switches (and takes the press).
        if (!live.current || switched.current) return;
        // A press is honoured once, by the load that follows it, and only while recent: a failed load drops it (the
        // stand-in stays a working button; the next press retries), so a later retry never opens on its own.
        const how = m ? takeIntent(intent.current, Date.now()) : null;
        intent.current = null;
        if (!m) return;
        switched.current = true;
        refocus.current = twinEl.current != null && twinEl.current === document.activeElement;
        keyOpen.current = how === "key";
        setState({ impl: m, openWith: how });
      });
    }, []);
    const { impl, openWith } = state;
    useEffect(() => (impl ? undefined : whenIdle(fetchImpl)), [impl, fetchImpl]);
    const value = useMemo<Ctx<M>>(() => ({
      impl,
      twin: (el: HTMLElement | null) => { twinEl.current = el; },
      real: (el: HTMLElement | null) => { if (el && refocus.current) { refocus.current = false; el.focus(); } },
      open: (how: OpenHow) => { intent.current = { how, at: Date.now() }; fetchImpl(); },
      preload: fetchImpl,
      takeKeyOpen: () => { const k = keyOpen.current; keyOpen.current = false; return k; },
    }), [impl, fetchImpl]);
    const R = impl?.Root;
    return <C.Provider value={value}>{R ? <R {...props} defaultOpen={defaultOpen ?? openWith != null}>{children}</R> : children}</C.Provider>;
  }

  function Trigger({ asChild, children, onPointerDown, onKeyDown, onClick, onFocus, onPointerEnter, ref, ...props }: TriggerProps) {
    const c = useContext(C);
    if (!c) throw new Error("A deferred overlay trigger must be inside its root");
    // A caller's ref is composed with the internal ones (focus hand-off), never replaces them.
    const own = (el: HTMLElement | null) => { if (typeof ref === "function") ref(el as HTMLButtonElement | null); else if (ref) (ref as { current: unknown }).current = el; };
    const T = c.impl?.Trigger;
    if (T) {
      return <T ref={(el: HTMLElement | null) => { c.real(el); own(el); }} asChild={asChild} onPointerDown={onPointerDown} onKeyDown={onKeyDown} onClick={onClick} onFocus={onFocus}
        onPointerEnter={onPointerEnter} {...props}>{children}</T>;
    }
    const Comp = asChild ? Slot.Root : "button";
    const able = !props.disabled;
    return (
      <Comp ref={(el: HTMLElement | null) => { c.twin(el); own(el); }} type="button" aria-haspopup={kind} aria-expanded={false} data-state="closed" data-disabled={props.disabled ? "" : undefined} data-slot={slot} {...props}
        onPointerEnter={(e) => { onPointerEnter?.(e); c.preload(); }}
        onFocus={(e) => { onFocus?.(e); c.preload(); }}
        onPointerDown={(e) => {
          onPointerDown?.(e);
          // As the Radix menu trigger: no focus on the trigger while opening, so the content takes it.
          if (!e.defaultPrevented && able && opensOnPointer(kind, e)) { e.preventDefault(); c.open("pointer"); }
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (!e.defaultPrevented && able && opensOnKey(kind, e.key)) { e.preventDefault(); c.open("key"); }
        }}
        onClick={(e) => { onClick?.(e); if (!e.defaultPrevented && able && kind === "dialog") c.open("pointer"); }}>
        {children}
      </Comp>
    );
  }

  /**
   * A part that only renders inside open content (items, labels, the content itself): nothing until its own root has
   * switched to Radix. Never `loader.get()`: the chunk can be loaded while this root still renders the stand-in (its
   * setState is pending), and a Radix part outside its Radix root throws.
   */
  function part<K extends keyof M & string>(name: K) {
    type P = M[K] extends ComponentType<infer X> ? X : never;
    function Part(props: P) {
      const impl = useContext(C)?.impl;
      const X = impl?.[name] as ComponentType<P> | undefined;
      return X ? <X {...(props as P & object)} /> : null;
    }
    Part.displayName = name;
    return Part;
  }

  /**
   * True once, right after this root switched to Radix because of a key press on the stand-in: the content then
   * focuses its first item, as Radix does for a keyboard open (its root missed that keydown).
   */
  function useTakeKeyOpen(): () => boolean {
    const c = useContext(C);
    return c ? c.takeKeyOpen : () => false;
  }

  return { Root, Trigger, part, useTakeKeyOpen, loader };
}
