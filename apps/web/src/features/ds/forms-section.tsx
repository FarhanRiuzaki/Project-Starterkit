"use client";

import { useState } from "react";
import {
  type ComboOption, Combobox, Disclosure, ErrorSummary, Field, FileUpload, FormActions, FormSection, FormWizard, Panel, Progress, RadioGroup,
  RequiredNote, ReviewList, Timeline,
  type TimelineItem, type UploadFn, useForm,
} from "@starterkit/ui/ds";
import { rules } from "@starterkit/ui/lib/validate";
import { Button } from "@starterkit/ui/ui/button";
import { Input } from "@starterkit/ui/ui/input";
import { Switch } from "@starterkit/ui/ui/switch";
import { Textarea } from "@starterkit/ui/ui/textarea";
import { toast } from "@starterkit/ui/ui/toast";

/** Fictional sample data for the /ds gallery's forms and flows. */
const CITIES: ComboOption[] = [
  { value: "jkt", label: "Jakarta", description: "Java" }, { value: "bdg", label: "Bandung", description: "Java" },
  { value: "sby", label: "Surabaya", description: "Java" }, { value: "dps", label: "Denpasar", description: "Bali" },
  { value: "mdn", label: "Medan", description: "Sumatra" }, { value: "mks", label: "Makassar", description: "Sulawesi" },
  { value: "pdg", label: "Padang", description: "Sumatra", disabled: true },
];
const TEAMS: ComboOption[] = ["Design", "Engineering", "Finance", "Operations", "Support"].map((t) => ({ value: t.toLowerCase(), label: t }));
const PLANS = [
  { value: "team", label: "Team", description: "Up to 20 people, shared roles." },
  { value: "org", label: "Organization", description: "Unlimited people, an approval flow for role changes." },
] as const;
const MINUTE = 60_000;
const NOW = Date.UTC(2026, 9, 20, 9, 30);
const APPROVAL: TimelineItem[] = [
  { id: "1", title: "Request submitted", status: "done", at: NOW - 26 * 60 * MINUTE, actor: "Alex Rivers, Support" },
  { id: "2", title: "Team lead approval", status: "done", at: NOW - 20 * 60 * MINUTE, actor: "Sam Hale", note: "Fine for the on-call rota." },
  { id: "3", title: "Security review", status: "current", actor: "Waiting for Robin Lund" },
  { id: "4", title: "Access granted", status: "upcoming" },
];
const SHIPMENT: TimelineItem[] = [
  { id: "a", title: "Order placed", status: "done", at: NOW - 3 * 24 * 60 * MINUTE },
  { id: "b", title: "Packed at the warehouse", status: "done", at: NOW - 2 * 24 * 60 * MINUTE, actor: "Bekasi hub" },
  { id: "c", title: "Address check", status: "rejected", at: NOW - 30 * 60 * MINUTE, note: "The building number is missing. The courier will call." },
  { id: "d", title: "Express handover", status: "skipped" },
  { id: "e", title: "Out for delivery", status: "upcoming" },
];
/** Simulated upload: progress in steps; a file whose name starts with "fail" fails, to show the error and Try again. */
const TICK_MS = 250;
const fakeUpload: UploadFn = (file, { onProgress, signal }) => new Promise((resolve, reject) => {
  let p = 0;
  const t = setInterval(() => {
    p += 0.25;
    onProgress(p);
    if (p >= 1) { clearInterval(t); if (file.name.toLowerCase().startsWith("fail")) reject(new Error("refused")); else resolve(); }
  }, TICK_MS);
  signal.addEventListener("abort", () => { clearInterval(t); reject(new Error("aborted")); });
});
/** Simulated server search over CITIES. */
const searchCities = (q: string, signal: AbortSignal) => new Promise<ComboOption[]>((resolve, reject) => {
  const t = setTimeout(() => resolve(CITIES.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()))), TICK_MS);
  signal.addEventListener("abort", () => { clearTimeout(t); reject(new Error("aborted")); });
});

function ValidationDemo() {
  const f = useForm({
    initial: { name: "", email: "", bio: "", plan: "" as "" | "team" | "org" },
    schema: { name: [rules.required("Enter a name.")], email: [rules.required("Enter an email address."), rules.email()], bio: [rules.maxLength(160, "Use 160 characters or fewer.")], plan: [rules.required("Choose a plan.")] },
    idPrefix: "ds-form",
  });
  const [alerts, setAlerts] = useState(true);
  return (
    <form noValidate onSubmit={f.submit(() => toast("Saved sample profile."))} className="grid max-w-lg gap-4">
      <ErrorSummary errors={f.shown} idPrefix="ds-form" labels={{ name: "Name", email: "Email", bio: "Bio", plan: "Plan" }} />
      <RequiredNote />
      <Field id={f.id("name")} label="Name" required error={f.error("name")}><Input {...f.text("name")} autoComplete="off" /></Field>
      <Field id={f.id("email")} label="Email" required note="Errors show after you leave the field, and clear as soon as it's fixed." error={f.error("email")}>
        <Input {...f.text("email")} type="email" autoComplete="off" />
      </Field>
      <Field id={f.id("bio")} label="Bio" error={f.error("bio")}><Textarea {...f.text("bio")} limit={160} /></Field>
      <RadioGroup name={f.id("plan")} legend="Plan" required variant="cards" options={PLANS} value={f.values.plan}
        onChange={(plan) => { f.set("plan", plan); f.blur("plan"); }} error={f.error("plan")} />
      <div className="flex items-center justify-between gap-4 rounded-lg border border-line bg-card px-3 py-2">
        <span id="ds-alerts" className="text-body text-fg">Email me when a new device signs in</span>
        <Switch checked={alerts} onChange={setAlerts} label="Email me when a new device signs in" />
      </div>
      <div><Button type="submit">Save profile</Button></div>
    </form>
  );
}

function WizardDemo() {
  const f = useForm({
    initial: { name: "", email: "", city: "", note: "" },
    schema: { name: [rules.required("Enter a name.")], email: [rules.required("Enter an email address."), rules.email()], city: [rules.required("Choose a city.")] },
    idPrefix: "ds-wiz",
  });
  const [step, setStep] = useState(0);
  const [city, setCity] = useState<ComboOption | null>(null);
  return (
    <FormWizard label="Invite a teammate" submitLabel="Send invitation" step={step} onStepChange={setStep}
      check={(k) => f.check(k as ("name" | "email" | "city")[])}
      onSubmit={async () => { toast(`Invitation sent to ${f.values.email}.`); f.reset(); setCity(null); setStep(0); }}
      steps={[
        { id: "who", title: "Teammate", description: "Who you are inviting.", fields: ["name", "email"], content: <>
          <RequiredNote />
          <Field id={f.id("name")} label="Name" required error={f.error("name")}><Input {...f.text("name")} autoComplete="off" /></Field>
          <Field id={f.id("email")} label="Email" required error={f.error("email")}><Input {...f.text("email")} type="email" autoComplete="off" /></Field>
          <Field id={f.id("note")} label="Message" note="Optional. Shown in the invitation email."><Textarea {...f.text("note")} limit={300} rows={4} /></Field>
        </> },
        { id: "where", title: "Office", description: "Where they work, for the sign-in log.", fields: ["city"], content: (
          <Field id={f.id("city")} label="City" required error={f.error("city")}>
            <Combobox id={f.id("city")} label="City" placeholder="Search a city" options={CITIES} value={city}
              onChange={(c) => { setCity(c); f.set("city", c?.value ?? ""); }} onBlur={() => f.blur("city")} invalid={!!f.error("city")} />
          </Field>
        ) },
        { id: "check", title: "Review", description: "Check the details before you send the invitation.", content: (
          <ReviewList onChange={setStep} rows={[{ label: "Name", value: f.values.name, step: 0 }, { label: "Email", value: f.values.email, step: 0 }, { label: "City", value: city?.label ?? "", step: 1 }]} />
        ) },
      ]} />
  );
}

function LayoutDemo() {
  const [twoFactor, setTwoFactor] = useState(true);
  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); toast("Saved sample organization."); }}>
      <FormSection title="Organization" description="The name people see in the sidebar and in emails. Required fields are marked with *.">
        <Field id="ds-org-name" label="Organization name" required><Input id="ds-org-name" defaultValue="Northwind" autoComplete="off" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="ds-org-city" label="City"><Input id="ds-org-city" autoComplete="off" /></Field>
          <Field id="ds-org-code" label="Postal code"><Input id="ds-org-code" inputMode="numeric" autoComplete="off" className="max-w-32" /></Field>
        </div>
      </FormSection>
      <FormSection title="Security" description="Applies to every member at their next sign-in.">
        <div className="flex items-center justify-between gap-4">
          <span className="text-body text-fg">Require two-factor authentication</span>
          <Switch checked={twoFactor} onChange={setTwoFactor} label="Require two-factor authentication" />
        </div>
      </FormSection>
      <FormActions><Button type="submit">Save organization</Button><Button type="button" variant="ghost">Cancel</Button></FormActions>
    </form>
  );
}

function ComboDemo() {
  const [one, setOne] = useState<ComboOption | null>(CITIES[0]!);
  const [many, setMany] = useState<ComboOption[]>([TEAMS[1]!]);
  const [remote, setRemote] = useState<ComboOption | null>(null);
  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5"><span className="text-label text-fg">City (single, local)</span><Combobox label="City" options={CITIES} value={one} onChange={setOne} placeholder="Search a city" /></div>
      <div className="grid gap-1.5"><span className="text-label text-fg">Teams (multiple, create)</span>
        <Combobox label="Teams" multiple options={TEAMS} value={many} onChange={setMany} placeholder="Add a team" onCreate={(t) => ({ value: t.toLowerCase(), label: t })} />
      </div>
      <div className="grid gap-1.5"><span className="text-label text-fg">City (server search)</span><Combobox label="City, server search" loadOptions={searchCities} value={remote} onChange={setRemote} placeholder="Type to search" /></div>
    </div>
  );
}

/** The /ds gallery's forms and flows: validation, controls, combobox, wizard, upload, progress, timeline, disclosure. */
export function FormsSection() {
  return (
    <div className="grid grid-cols-12 gap-gutter">
      <Panel title="Form and validation" description="Errors after leaving a field or on submit; summary on top" className="col-span-12 md:col-span-6"><ValidationDemo /></Panel>
      <Panel title="Wizard" description="Steps on the right stay in view; per-step validation, Back keeps answers, review with Change" cards className="col-span-12"><WizardDemo /></Panel>
      <Panel title="Form layout" description="Sections: title and purpose on the left, fields on the right; buttons stay in reach" className="col-span-12"><LayoutDemo /></Panel>
      <Panel title="Combobox" description="Single, multiple with chips and create, server search" className="col-span-12 md:col-span-6"><ComboDemo /></Panel>
      <Panel title="File upload" description="Drop, paste or choose; checked before sending; a file named fail… fails" className="col-span-12 md:col-span-6">
        <FileUpload label="Attachments" upload={fakeUpload} accept={["image/*", ".pdf"]} acceptLabel="an image or a PDF" maxSize={5 * 1024 * 1024} maxFiles={4} />
      </Panel>
      <Panel title="Progress" description="Determinate with a value, a count, failed, and indeterminate" className="col-span-12 md:col-span-6">
        <div className="grid gap-4">
          <Progress label="Importing users" value={64} />
          <Progress label="Files" value={3} max={5} valueText="3 of 5 files" />
          <Progress label="Export" value={40} failed valueText="Stopped at 40%" />
          <Progress label="Preparing the report" />
        </div>
      </Panel>
      <Panel title="Disclosure" description="Native details, opens with the shared transition" className="col-span-12 md:col-span-6">
        <div className="grid gap-2">
          <Disclosure summary="What can an Admin change?">Users and their roles; not the permissions a role holds.</Disclosure>
          <Disclosure summary="Advanced options">Session length and the sign-in rate limits.</Disclosure>
        </div>
      </Panel>
      <Panel title="Timeline: approval" description="Done, in progress, not started" className="col-span-12 md:col-span-6"><Timeline label="Access request approval" items={APPROVAL} /></Panel>
      <Panel title="Timeline: tracking" description="Rejected and skipped steps" className="col-span-12 md:col-span-6"><Timeline label="Shipment tracking" items={SHIPMENT} /></Panel>
    </div>
  );
}
