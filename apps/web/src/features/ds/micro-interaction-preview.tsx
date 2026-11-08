"use client";

import { RadioGroup } from "@starterkit/ui/ds/form-options";

import { useEffect, useRef, useState } from "react";
import { Accordion, Checkbox, CopyValue, Field, InputAffix, InteractiveCard, NumberInput, Panel, Segmented, Slider, Stepper, Switch, ProgressBar, type IndicatorStep } from "@starterkit/ui/ds";
import { Button } from "@starterkit/ui/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@starterkit/ui/ui/dialog";
import { Input } from "@starterkit/ui/ui/input";
import { Skeleton } from "@starterkit/ui/ui/skeleton";
import { plural } from "@starterkit/ui/lib/format";
import { Icon } from "@starterkit/ui/ui/icon";
import { CheckIcon, SpinnerIcon } from "@starterkit/ui/ui/icons";
import { DUR, ReducedMotionScope, useDelayedFlag, usePrefersReducedMotion } from "@starterkit/ui/motion";

/** Uses the production components: every control changes local preview state only. */
export function MicroInteractionPreview() {
  const [reduced, setReduced] = useState("off"), [selected, setSelected] = useState(false), [enabled, setEnabled] = useState(false);
  const [radio, setRadio] = useState("email"), [seats, setSeats] = useState<number | "">(12), [progress, setProgress] = useState(32);
  const [open, setOpen] = useState(false), [invalid, setInvalid] = useState(false), [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false), [saved, setSaved] = useState(false), [cardOpens, setCardOpens] = useState(0);
  const inheritedReduced = usePrefersReducedMotion();
  const effectiveReduced = inheritedReduced || reduced === "reduced";
  const shownBusy = useDelayedFlag(busy), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const steps: IndicatorStep[] = ["Details", "Members", "Review"].map((label, i) => ({ id: label, label, status: i < step ? "done" : i === step ? "current" : "todo" }));
  function save() {
    setBusy(true); setSaved(false);
    timer.current = setTimeout(() => { setBusy(false); setSaved(true); }, DUR.tween * 1000);
  }
  return <Dialog><DialogTrigger asChild><Button type="button" variant="secondary" size="sm">Explore micro-interactions</Button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] max-w-5xl grid-rows-[auto_minmax(0,1fr)]"><DialogHeader className="pb-4"><DialogTitle>Micro-interactions</DialogTitle><DialogDescription>Try the shared components with a mouse, keyboard or touch. This preview changes no account data.</DialogDescription></DialogHeader>
      <ReducedMotionScope active={effectiveReduced}><div data-micro-preview="" data-motion-preview={effectiveReduced ? "reduced" : undefined} className="scroll-quiet grid min-h-0 min-w-0 gap-6 overflow-y-auto overscroll-contain p-6 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-body-sm text-fg-2">Feedback stays with the control. Focus and entered values stay in place.</p><Segmented label="Micro-interaction reduced motion" value={reduced} onChange={setReduced} options={[{ value: "off", label: "System motion" }, { value: "reduced", label: "Reduced" }]} /></div>
        <div className="grid min-w-0 gap-6 md:grid-cols-2">
          <Panel title="Buttons and feedback" bodyClassName="grid content-start gap-4"><div className="flex flex-wrap items-center gap-3"><Button type="button" onClick={save} disabled={busy} aria-busy={shownBusy || undefined} className="min-w-32">{shownBusy ? <Icon icon={SpinnerIcon} className="motion-safe:animate-spin" /> : saved ? <Icon key="saved" icon={CheckIcon} className="animate-swap" /> : null}{busy ? "Saving…" : saved ? "Saved" : "Save example"}</Button><Button type="button" variant="secondary" disabled>Unavailable</Button></div><p role="status" className="min-h-5 text-body-sm text-fg-2">{busy ? "Saving the local example…" : saved ? "Example saved." : "Unavailable actions have no press effect."}</p><CopyValue label="example identifier" value="example-22020283" /></Panel>
          <Panel title="Selection" bodyClassName="grid content-start gap-4"><div className="flex items-center gap-2"><Checkbox label="Include archived items" checked={selected} onToggle={() => setSelected(!selected)} /><span className="text-body-sm">Include archived items</span></div><div className="flex items-center justify-between gap-3"><label htmlFor="micro-notifications" className="text-body-sm">Notifications</label><Switch id="micro-notifications" checked={enabled} onChange={e => setEnabled(e.target.checked)} /></div><div className="flex items-center gap-2"><Checkbox label="Managed setting" checked readOnly reason="Managed by your administrator." /><span className="text-body-sm text-fg-3">Managed setting</span></div><RadioGroup legend="Delivery" name="micro-delivery" value={radio} onValueChange={setRadio} options={[{ value: "email", label: "Email" }, { value: "in-app", label: "In-app" }]} /></Panel>
          <Panel title="Fields and validation" bodyClassName="grid content-start gap-4"><Field id="micro-project" label="Project name" note={invalid ? "Enter a project name before continuing." : "Hover, focus and type. Validation never shakes the field."}><Input id="micro-project" aria-invalid={invalid || undefined} /></Field><Field id="micro-budget" label="Monthly budget"><InputAffix id="micro-budget" prefix="USD" suffix="/ month" defaultValue="2,500" /></Field><NumberInput label="Seats" value={seats} onValueChange={setSeats} min={1} max={100} /><Button type="button" variant="secondary" size="sm" className="justify-self-start" onClick={() => setInvalid(!invalid)}>{invalid ? "Clear validation" : "Show validation"}</Button></Panel>
          <Panel title="Progress and disclosure" bodyClassName="grid content-start gap-4"><ProgressBar label="Import progress" value={progress} /><label htmlFor="micro-progress" className="sr-only">Sample progress</label><Slider id="micro-progress" min={0} max={100} value={progress} onChange={e => setProgress(Number(e.target.value))} /><Accordion title="Import details" open={open} onOpenChange={setOpen}><p>Content reveals in place. Closing preserves the draft and returns to the same trigger.</p></Accordion></Panel>
        </div>
        <Panel title="Step completion" bodyClassName="grid gap-4"><Stepper label="Micro-interaction example steps" steps={steps} onStepSelect={id => setStep(steps.findIndex(s => s.id === id))} /><div className="flex items-center justify-between gap-3"><p key={step} className="animate-reveal-in text-body-sm text-fg-2" role="status">{steps[step]!.label}: step {step + 1} of {steps.length}</p><Button type="button" variant="secondary" onClick={() => setStep((step + 1) % steps.length)}>{step === steps.length - 1 ? "Restart example" : "Next step"}</Button></div></Panel>
        <Panel title="Cards and loading" bodyClassName="grid gap-4 md:grid-cols-2">
          <div className="grid content-start gap-3"><InteractiveCard aria-label="Open sample card" onClick={() => setCardOpens(count => count + 1)}><span className="text-label">Open sample card</span><span className="text-body-sm text-fg-2">Hover, focus or press the whole card.</span></InteractiveCard><p role="status" className="text-caption text-fg-2">Card opened {plural(cardOpens, "time", "times")}.</p><InteractiveCard disabled aria-label="Unavailable sample card"><span className="text-label">Unavailable sample card</span><span className="text-caption text-fg-3">Your role cannot open this example.</span></InteractiveCard></div>
          <div className="grid content-start gap-3"><p className="text-label">Shared loading shape</p><div data-slot="skeleton-example" className="grid gap-3 rounded-lg border border-line bg-card p-4"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-3/4" /><Skeleton className="mt-2 h-16 w-full" /></div><p className="text-caption text-fg-2">Shimmer becomes a static placeholder with reduced motion.</p></div>
        </Panel>
      </div></ReducedMotionScope>
    </DialogContent>
  </Dialog>;
}
