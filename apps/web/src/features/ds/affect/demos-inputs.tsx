"use client";

import { useState } from "react";
import { Checkbox } from "@starterkit/ui/affect/checkbox";
import { ColorPicker, ColorPickerPanel } from "@starterkit/ui/affect/color-picker";
import { DatePicker } from "@starterkit/ui/affect/date-picker";
import { FilterMenu, type FilterValue } from "@starterkit/ui/affect/filter-menu";
import { FormField } from "@starterkit/ui/affect/form-field";
import { NumberInput } from "@starterkit/ui/affect/number-input";
import { OtpInput, type OtpStatus } from "@starterkit/ui/affect/otp-input";
import { Rating } from "@starterkit/ui/affect/rating";
import { Select } from "@starterkit/ui/affect/select";
import { Switch } from "@starterkit/ui/affect/switch";
import { TagInput } from "@starterkit/ui/affect/tag-input";
import { TextArea } from "@starterkit/ui/affect/text-area";
import { TextField } from "@starterkit/ui/affect/text-field";
import { TimePicker } from "@starterkit/ui/affect/time-picker";
import { PICKER } from "./fixtures";
import type { AffectDemo } from "./types";

const SAMPLE_TODAY = new Date(2026, 10, 14);

function CheckboxDemo() {
  const [items, setItems] = useState([true, false, false]);
  const all = items.every(Boolean);
  const some = items.some(Boolean) && !all;
  const names = ["Weekly digest", "Product updates", "Security alerts"];
  return (
    <div className="grid gap-3">
      <Checkbox
        label="Select all"
        checked={all}
        indeterminate={some}
        onChange={(e) => setItems(items.map(() => e.target.checked))}
      />
      {names.map((name, i) => (
        <Checkbox
          key={name}
          label={name}
          checked={items[i] ?? false}
          onChange={(e) => setItems(items.map((v, j) => (j === i ? e.target.checked : v)))}
        />
      ))}
      <Checkbox variant="card" label="Card variant" description="The whole row is the target" defaultChecked />
      <Checkbox label="Accept the terms" error="Accept the terms to continue" />
      <Checkbox label="Disabled option" disabled />
    </div>
  );
}

function ColorPickerDemo() {
  const [color, setColor] = useState<string>(PICKER.accent);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <ColorPicker
          label="Accent colour"
          showValue
          value={color}
          onValueChange={setColor}
          presets={[PICKER.accent, ...PICKER.presets]}
        />
        <ColorPicker size="sm" label="With opacity" alpha defaultValue={PICKER.translucent} showValue />
      </div>
      <ColorPickerPanel value={color} onValueChange={setColor} />
    </div>
  );
}

function DatePickerDemo() {
  const [date, setDate] = useState<Date | null>(new Date(2026, 10, 20));
  return (
    <div className="grid gap-3">
      <DatePicker
        label="Delivery date"
        hint="Weekends are not available"
        value={date}
        onChange={setDate}
        today={SAMPLE_TODAY}
        min={SAMPLE_TODAY}
        isDateDisabled={(d) => d.getDay() === 0 || d.getDay() === 6}
        weekStartsOn={1}
      />
      <DatePicker label="Start date" optional today={SAMPLE_TODAY} error="Choose a start date" />
    </div>
  );
}

function FilterMenuDemo() {
  const [value, setValue] = useState<FilterValue>({ status: ["open"] });
  return (
    <FilterMenu
      title="Filter tickets"
      value={value}
      onChange={setValue}
      defaultOpen={["status"]}
      groups={[
        {
          id: "status",
          label: "Status",
          chipPrefix: "Status",
          options: [
            { id: "open", label: "Open" },
            { id: "pending", label: "Pending" },
            { id: "closed", label: "Closed" },
          ],
        },
        {
          id: "owner",
          label: "Owner",
          chipPrefix: "Owner",
          options: [
            { id: "mira", label: "Mira Alvarez" },
            { id: "tomas", label: "Tomas Lindqvist" },
            { id: "yuna", label: "Yuna Park" },
          ],
        },
      ]}
    />
  );
}

function FormFieldDemo() {
  const [text, setText] = useState("");
  const invalid = text.length > 0 && text.length < 3;
  return (
    <FormField
      label="Project code"
      hint="Three to ten characters"
      required
      error={invalid ? "Use at least three characters" : undefined}
      counter={`${text.length}/10`}
    >
      {({ id, labelId, ...aria }) => (
        <input
          {...aria}
          id={id}
          aria-labelledby={labelId}
          className="text-body-sm"
          maxLength={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      )}
    </FormField>
  );
}

function NumberInputDemo() {
  const [qty, setQty] = useState<number | null>(12);
  return (
    <div className="grid gap-3">
      <NumberInput label="Seats" hint="Hold Shift for larger steps" min={0} max={100} step={1} largeStep={10} value={qty} onValueChange={setQty} />
      <NumberInput label="Monthly budget" prefix="$" unit="per month" defaultValue={1250} step={50} formatOptions={{ maximumFractionDigits: 0 }} />
      <NumberInput label="Discount" optional error="Enter a value from 0 to 100" defaultValue={140} min={0} max={100} />
    </div>
  );
}

function OtpInputDemo() {
  const [status, setStatus] = useState<OtpStatus>("idle");
  return (
    <div className="grid gap-3">
      <OtpInput
        label="Verification code"
        separator
        status={status}
        errorMessage="That code does not match. Try again."
        successLabel="Code verified"
        onResend={() => setStatus("idle")}
        resendIn={20}
        onComplete={(code) => setStatus(code === "123456" ? "success" : "error")}
      />
      <p className="text-body-sm text-fg-2">Enter 123456 for success, any other code for an error.</p>
      <div className="flex flex-wrap items-center gap-2">
        {(["idle", "verifying", "error", "success"] as const).map((s) => (
          <button key={s} type="button" className="text-label text-fg-3" onClick={() => setStatus(s)}>
            Show {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function RatingDemo() {
  const [stars, setStars] = useState<number | null>(4);
  const [thumb, setThumb] = useState<"up" | "down" | null>(null);
  return (
    <div className="grid gap-3">
      <Rating value={stars} onValueChange={setStars} allowClear aria-label="Rate this article" />
      <Rating readOnly defaultValue={3.5} size="sm" aria-label="Average rating" />
      <Rating variant="thumbs" value={thumb} onValueChange={setThumb} allowClear aria-label="Was this helpful" />
      <Rating disabled defaultValue={2} size="lg" aria-label="Disabled rating" />
    </div>
  );
}

const PLANS = [
  { value: "free", label: "Free", description: "Up to 3 projects" },
  { value: "team", label: "Team", description: "Unlimited projects" },
  { value: "business", label: "Business", description: "Audit exports and priority support" },
  { value: "legacy", label: "Legacy", description: "No longer offered", disabled: true },
];

function SelectDemo() {
  const [plan, setPlan] = useState<string | null>("team");
  return (
    <div className="grid gap-3">
      <Select label="Plan" hint="You can change it later" options={PLANS} value={plan} onChange={setPlan} />
      <Select label="Region" optional placeholder="Choose a region" options={[{ value: "eu", label: "Europe" }, { value: "ap", label: "Asia Pacific" }]} />
      <Select label="Currency" error="Choose a currency" options={[{ value: "usd", label: "US dollar" }, { value: "eur", label: "Euro" }]} />
    </div>
  );
}

function SwitchDemo() {
  const [on, setOn] = useState(true);
  return (
    <div className="grid gap-3">
      <Switch label="Email notifications" description="Sent to the address on your profile" checked={on} onChange={(e) => setOn(e.target.checked)} />
      <Switch size="sm" placement="end" label="Compact switch, label first" defaultChecked />
      <Switch label="Disabled switch" disabled />
    </div>
  );
}

function TagInputDemo() {
  const [tags, setTags] = useState(["mira@example.com", "tomas@example.com"]);
  return (
    <TagInput
      label="Invite teammates"
      hint="Press Enter or comma to add, up to 5"
      placeholder="name@example.com"
      value={tags}
      onChange={setTags}
      max={5}
      avatar
      normalize={(t) => t.trim().toLowerCase()}
      validate={(t) => (/^\S+@\S+\.\S+$/.test(t) ? true : "Enter a valid email address")}
    />
  );
}

function TextAreaDemo() {
  const [sent, setSent] = useState("");
  return (
    <div className="grid gap-3">
      <TextArea
        label="Release notes"
        hint="Press Cmd or Ctrl and Enter to post"
        placeholder="What changed in this release?"
        maxLength={280}
        counter
        minRows={3}
        maxRows={8}
        expandable
        onSubmitShortcut={setSent}
      />
      {sent && <p className="text-body-sm text-fg-2">Posted: {sent}</p>}
      <TextArea label="Comment" optional error="Add a comment before sending" defaultValue="" />
    </div>
  );
}

function TextFieldDemo() {
  const [name, setName] = useState("Mira Alvarez");
  return (
    <div className="grid gap-3">
      <TextField label="Full name" clearable value={name} onChange={(e) => setName(e.target.value)} onClear={() => setName("")} />
      <TextField label="Website" prefix="https://" suffix=".example" defaultValue="mira" />
      <TextField label="Invite link" copyable readOnly defaultValue="invite-4821-mira" />
      <TextField label="Bio" optional counter maxLength={60} hint="Shown on your profile" />
      <TextField label="Email" error="Enter a valid email address" defaultValue="mira@" />
    </div>
  );
}

function TimePickerDemo() {
  const [time, setTime] = useState<string | null>("14:30");
  return (
    <div className="grid gap-3">
      <TimePicker label="Meeting time" hint="Every 15 minutes" step={15} min="08:00" max="18:00" value={time} onChange={setTime} />
      <TimePicker label="Reminder" optional hourCycle={12} defaultValue="09:00" />
      <TimePicker label="End time" error="Choose an end time" />
    </div>
  );
}

export const DEMOS: readonly AffectDemo[] = [
  { slug: "checkbox", name: "Checkbox", Demo: CheckboxDemo },
  { slug: "color-picker", name: "Color Picker", Demo: ColorPickerDemo, wide: true },
  { slug: "date-picker", name: "Date Picker", Demo: DatePickerDemo },
  { slug: "filter-menu", name: "Filter Menu", Demo: FilterMenuDemo },
  { slug: "form-field", name: "Form Field", Demo: FormFieldDemo },
  { slug: "number-input", name: "Number Input", Demo: NumberInputDemo },
  { slug: "otp-input", name: "OTP Input", Demo: OtpInputDemo },
  { slug: "rating", name: "Rating", Demo: RatingDemo },
  { slug: "select", name: "Select", Demo: SelectDemo },
  { slug: "switch", name: "Switch", Demo: SwitchDemo },
  { slug: "tag-input", name: "Tag Input", Demo: TagInputDemo },
  { slug: "text-area", name: "Text Area", Demo: TextAreaDemo },
  { slug: "text-field", name: "Text Field", Demo: TextFieldDemo },
  { slug: "time-picker", name: "Time Picker", Demo: TimePickerDemo },
];
