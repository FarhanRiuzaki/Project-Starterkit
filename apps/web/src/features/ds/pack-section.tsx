"use client";
import { useRef, useState } from "react";
import { Accordion, ActivityItem, ApiKeyRow, BillingSummary, CheckboxGroup, ChoiceCard, Combobox, DatePicker, Field, FileItem, FileUpload, FilterRule, FormSection, IntegrationCard, NotificationItem, OnboardingChecklist, OtpInput, Panel, PlanCard, RadioGroup, RepeatableField, SettingsRow, Slider, Switch, TimeInput, WizardReview, WizardCompletion } from "@starterkit/ui/ds";
import { Button } from "@starterkit/ui/ui/button";
import { Input } from "@starterkit/ui/ui/input";
import { Textarea } from "@starterkit/ui/ui/textarea";
import { CalendarIcon, UsersIcon } from "@starterkit/ui/ui/icons";
import { toast } from "@starterkit/ui/ui/toast";
import { APP_TIME_ZONE, APP_TIME_ZONE_LABEL, formatDateTimeLong, formatNumber } from "@starterkit/ui/lib/format";
const sample = () => toast("Design-system example", { description: "This example does not change account data." });
const action = (label: string) => <Button type="button" variant="secondary" onClick={sample}>{label}</Button>;

export function PackSection() {
  const [notes, setNotes] = useState(""), [role, setRole] = useState("viewer"), [choice, setChoice] = useState("private");
  const [checks, setChecks] = useState<string[]>(["email"]), [people, setPeople] = useState<string[]>([]), [otp, setOtp] = useState("");
  const [enabled, setEnabled] = useState(false), [open, setOpen] = useState(false), [threshold, setThreshold] = useState(70);
  const serial = useRef(1), [emails, setEmails] = useState([{ id: "0", value: "alex@example.com" }]);
  const [rule, setRule] = useState({ property: "role", operator: "is", value: "Viewer" });
  return <div className="grid gap-section">
    <FormSection title="Selection and input" description="Interactive examples. Values are local to this gallery.">
      <div className="grid gap-6 md:grid-cols-2">
        <Field id="sample-description" label="Description" note={`Optional · ${formatNumber(notes.length)} / 500 characters`}><Textarea id="sample-description" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <RadioGroup legend="Default access" name="sample-access" value={role} onValueChange={setRole} options={[{ value: "viewer", label: "Viewer" }, { value: "editor", label: "Editor" }, { value: "admin", label: "Administrator" }]} />
        <CheckboxGroup legend="Notifications" value={checks} onValueChange={setChecks} options={[{ value: "email", label: "Email" }, { value: "digest", label: "Weekly digest" }]} />
        <Field id="sample-people" label="Team members"><Combobox id="sample-people" label="Team members" multiple value={people} onValueChange={setPeople} options={[{ value: "alex", label: "Alex Morgan" }, { value: "priya", label: "Priya Shah" }, { value: "noor", label: "Noor Chen" }]} /></Field>
        <Field id="sample-date" label="Start date" note="Calendar date in your locale"><DatePicker id="sample-date" /></Field>
        <Field id="sample-time" label="Scheduled time" note={APP_TIME_ZONE}><TimeInput id="sample-time" defaultValue="09:30" /></Field>
        <Field id="sample-otp" label="Verification code" note="Paste the full 6-digit code."><OtpInput id="sample-otp" value={otp} onValueChange={setOtp} /></Field>
        <Field id="sample-threshold" label={`Alert threshold · ${formatNumber(threshold)}%`} note="Arrow keys adjust by 1%; Home / End set limits."><Slider id="sample-threshold" min={0} max={100} step={1} value={threshold} aria-valuetext={`${threshold}%`} onChange={(e) => setThreshold(Number(e.target.value))} /></Field>
      </div>
      <fieldset className="grid gap-3 md:grid-cols-2"><legend className="mb-3 text-label">Access policy</legend><ChoiceCard name="sample-policy" label="Invite-only access" description="Only people you invite can join." checked={choice === "private"} onChange={() => setChoice("private")} /><ChoiceCard name="sample-policy" label="Team access" description="Existing team members can join." checked={choice === "team"} onChange={() => setChoice("team")} /></fieldset>
      <RepeatableField legend="Invite team members" rows={emails} max={5} addLabel="Add another member" onAdd={() => setEmails([...emails, { id: String(serial.current++), value: "" }])} onRemove={(id) => setEmails(emails.filter((e) => e.id !== id))} render={(id, i) => <Field id={`invite-${id}`} label={`Email ${i + 1}`}><Input id={`invite-${id}`} type="email" value={emails.find((e) => e.id === id)!.value} onChange={(e) => setEmails(emails.map((row) => row.id === id ? { ...row, value: e.target.value } : row))} /></Field>} />
      <FilterRule {...rule} onChange={setRule} properties={[{ value: "role", label: "Role" }]} operators={[{ value: "is", label: "is" }, { value: "is-not", label: "is not" }]} />
    </FormSection>
    <UploadExamples />
    <SettingsRow title="Weekly summary" description="Example setting. Toggle to preview the selected state."><Switch aria-label="Weekly summary" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /></SettingsRow>
    <Accordion title="Advanced settings" open={open} onOpenChange={setOpen}><Field id="sample-retention" label="Retention note"><Input id="sample-retention" defaultValue="Draft is preserved when collapsed" /></Field></Accordion>
    <div className="grid gap-6 xl:grid-cols-2">
      <WizardReview title="Review team" rows={[{ id: "team", label: "Team", value: "Operations", action: action("Edit team") }, { id: "access", label: "Access", value: "Invite only", action: action("Edit access") }]} note="Example review. Invitations are sent only after confirmation." />
      <WizardCompletion title="Example complete" description="Show this state only after the server confirms the operation." action={action("Open example")} />
      <NotificationItem title="Team invitation" message="Alex invited you to the Operations team." state="Unread" time={`Today, 09:41 ${APP_TIME_ZONE_LABEL}`} action={action("View invitation")} />
      <Panel title="Activity timeline"><ActivityItem title="Alex Morgan changed a role" description="Viewer → Editor" time={formatDateTimeLong(Date.UTC(2026, 10, 7, 2, 41))} icon={UsersIcon} /></Panel>
      <OnboardingChecklist title="Finish setup" tasks={[{ id: "profile", label: "Complete profile", done: true }, { id: "members", label: "Invite team members", done: false, action: action("Start invitation") }, { id: "calendar", label: "Connect an integration", done: false, action: action("Choose integration") }]} />
      <PlanCard title="Business" price="$29 / seat / month" terms="Example price · billed monthly · taxes calculated at checkout" features={["Unlimited projects", "Shared permissions", "Priority support"]} action={action("Choose plan")} />
      <IntegrationCard title="Calendar integration" description="Keep important team dates in sync." status="Example · not connected" icon={CalendarIcon} action={action("Connect")} />
      <ApiKeyRow name="Production automation" maskedIdentifier="key_••••••••7K2A" status="Example · active · last used 2 hours ago" actions={action("Manage key")} />
      <BillingSummary title="Billing overview" rows={[{ label: "Plan", value: "Business · 10 seats" }, { label: "Next invoice", value: "$290.00 USD" }, { label: "Billing date", value: "1 Dec 2026" }]} action={action("Manage billing")} note="Example amounts. No payment or subscription is connected." />
    </div>
  </div>;
}

function UploadExamples() {
  const reset = useRef<HTMLButtonElement>(null);
  const [files, setFiles] = useState<File[]>([]), [visible, setVisible] = useState({ uploading: true, success: true, error: true });
  const dismiss = (state: keyof typeof visible) => { setVisible(current => ({ ...current, [state]: false })); reset.current?.focus(); toast(state === "uploading" ? "Example upload cancelled" : "Example file removed"); };
  return <Panel title="File upload" description="Dropzone and individual file states" actions={<Button ref={reset} type="button" variant="secondary" onClick={() => setVisible({ uploading: true, success: true, error: true })}>Reset file examples</Button>} bodyClassName="grid gap-6">
    <div className="grid min-w-0 gap-6 xl:grid-cols-2">
      <FileUpload label="Import users" prompt="Drop a CSV here or browse" description="CSV or XLSX, up to 10 MB. One user per row." files={files} onFilesChange={setFiles} accept=".csv,.xlsx" maxBytes={10 * 1024 * 1024} multiple />
      <FileUpload label="Unavailable upload" prompt="Drop a CSV here or browse" description="Uploads are unavailable while an import is running." files={[]} onFilesChange={() => {}} accept=".csv,.xlsx" maxBytes={10 * 1024 * 1024} disabled />
    </div>
    <div className="grid gap-3">
      <h3 className="text-label">File items</h3>
      <p className="text-caption text-fg-3">Transfer states below are examples. Chosen files above stay on this device.</p>
      <div data-slot="file-item-examples" className="grid max-w-lg min-w-0 gap-4">
        {visible.uploading && <FileItem name="users-finance-nov.csv" state="uploading" progress={64} onCancel={() => dismiss("uploading")} />}
        {visible.success && <FileItem name="users-finance-nov.csv" state="success" size={248 * 1024} rows={412} onRemove={() => dismiss("success")} />}
        {visible.error && <FileItem name="users-finance-nov.csv" state="error" error="Row 17: email is missing" onRemove={() => dismiss("error")} />}
      </div>
    </div>
  </Panel>;
}
