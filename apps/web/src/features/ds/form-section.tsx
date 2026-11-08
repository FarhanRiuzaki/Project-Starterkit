"use client";

import { useRef, useState } from "react";
import { Field, FormActions, FormErrorSummary, InputAffix, NumberInput, Panel, Wizard } from "@starterkit/ui/ds";
import { Input } from "@starterkit/ui/ui/input";
import { Button } from "@starterkit/ui/ui/button";
import { formatNumber } from "@starterkit/ui/lib/format";

/** Interactive examples; no account or billing mutation is made by this gallery. */
export function FormSectionGallery() {
  const [seats, setSeats] = useState<number | "">(12);
  const [step, setStep] = useState(0), [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false), [attempted, setAttempted] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const errors = attempted && !name.trim() ? [{ id: "demo-team-name", message: "Enter a team name." }] : [];
  function advance() {
    setAttempted(true);
    if (!name.trim()) { document.getElementById("demo-team-name")?.focus(); return; }
    if (step === 2) setSubmitted(true); else setStep(step + 1);
    requestAnimationFrame(() => heading.current?.focus());
  }
  return <div className="grid gap-section">
    <Panel title="Form controls" description="Shared sizing, baseline alignment and accessible descriptions">
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Field id="affix-prefix" label="Monthly budget" note="Currency: USD"><InputAffix id="affix-prefix" prefix="USD" defaultValue="2,500" inputMode="decimal" /></Field>
        <Field id="affix-suffix" label="Site address"><InputAffix id="affix-suffix" suffix=".app" defaultValue="example" /></Field>
        <Field id="affix-both" label="Monthly budget" note="Currency: USD; per month"><InputAffix id="affix-both" prefix="USD" suffix="/ month" defaultValue="2,500" inputMode="decimal" /></Field>
        <Field id="demo-seats" label="Seats" note="1–100 seats · step 1"><NumberInput id="demo-seats" label="seats" min={1} max={100} value={seats} onValueChange={setSeats} /></Field>
        <Field id="affix-invalid" label="Monthly budget" note="Enter an amount greater than zero."><InputAffix id="affix-invalid" prefix="USD" defaultValue="0" aria-invalid /></Field>
        <Field id="affix-fixed" label="Plan code" note="Fixed by your plan."><InputAffix id="affix-fixed" prefix="PLAN" value="STANDARD" readOnly /></Field>
      </div>
    </Panel>
    <Wizard title="Setup progress" steps={["Team details", "Preferences", "Review"].map((label, i) => ({ id: String(i), label, status: submitted || i < step ? "done" : i === step ? "current" : "todo" }))}>
      <Panel bodyClassName="p-6">
        <form className="grid gap-6" onSubmit={(e) => { e.preventDefault(); advance(); }}>
          <div><h2 ref={heading} tabIndex={-1} className="text-title-2">{submitted ? "Example complete" : ["Team details", "Preferences", "Review your choices"][step]}</h2><p className="mt-2 text-body-sm text-fg-3">Interactive wizard example. Nothing is saved to your account.</p></div>
          <FormErrorSummary errors={errors} />
          {submitted ? <p role="status" className="text-body">Your example is ready. Restart to try another configuration.</p> : step === 0 ? <Field id="demo-team-name" label="Team name" note={errors.length ? "Enter a team name." : "Use a name your team will recognize."}><Input id="demo-team-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={errors.length > 0 || undefined} /></Field>
            : step === 1 ? <Field id="wizard-seats" label="Seats" note="1–100 seats"><NumberInput id="wizard-seats" label="team seats" min={1} max={100} value={seats} onValueChange={setSeats} required /></Field>
              : <dl className="grid gap-4 text-body"><div className="flex justify-between gap-4"><dt className="text-fg-3">Team name</dt><dd>{name}</dd></div><div className="flex justify-between gap-4"><dt className="text-fg-3">Seats</dt><dd>{seats === "" ? "Not set" : formatNumber(seats)}</dd></div></dl>}
          <FormActions>{submitted ? <Button type="button" onClick={() => { setSubmitted(false); setStep(0); setAttempted(false); }}>Restart example</Button> : <><Button type="button" variant="secondary" disabled={step === 0} onClick={() => { setStep(step - 1); requestAnimationFrame(() => heading.current?.focus()); }}>Back</Button><Button type="submit">{step === 2 ? "Finish example" : "Continue"}</Button></>}</FormActions>
        </form>
      </Panel>
    </Wizard>
  </div>;
}
